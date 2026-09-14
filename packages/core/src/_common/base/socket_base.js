const DerivAPIBasic = require('@deriv/deriv-api/dist/DerivAPIBasic');
const { getCompleteWebSocketURL, getAccountId, cloneObject, State } = require('@deriv/shared');
const { when } = require('mobx');
const SocketCache = require('./socket_cache');
const APIMiddleware = require('./api_middleware');

/*
 * An abstraction layer over native javascript WebSocket,
 * which provides additional functionality like
 * reopen the closed connection and process the buffered requests
 */
const BinarySocketBase = (() => {
    let deriv_api, binary_socket, client_store;

    let config = {};
    let is_disconnect_called = false;
    let is_connected_before = false;
    let reconnect_handlers = []; // Array to store multiple reconnection handlers
    let reconnect_attempt_count = 0; // Track number of reconnect attempts

    // Consecutive connection failures (while apparently online and visible) before invoking
    // onConnectionError. This is an auth heuristic by design: the WS server refuses the handshake
    // when the session cookies are stale, so repeated refusals suggest an invalid session —
    // onConnectionError then verifies via whoami before acting, since a refused handshake is
    // indistinguishable from plain network trouble at this layer.
    const MAX_CONSECUTIVE_CONNECTION_FAILURES = 3;

    // Keep-alive proof-of-life: periodically ping and, if no inbound message of any kind arrives
    // within the grace window, treat the socket as dead. A socket can report OPEN while being dead
    // (proxy-dropped or OS-suspended), so the verdict comes from traffic, not readyState.
    const KEEP_ALIVE_INTERVAL_MS = 30 * 1000;
    const KEEP_ALIVE_GRACE_MS = 10 * 1000;
    let received_message_since_ping = false;
    let keep_alive_interval = null;
    let keep_alive_grace_timeout = null;
    // Connection-death signal, one per connection. APIMiddleware races every send's response
    // promise against it and settles with a synthetic ConnectionLost error-response, so no
    // request — buy, sell, api-hooks query, ping — can hang forever on a dead connection.
    let signal_connection_death = null;
    let connection_death = null;

    const settlePendingRequests = () => {
        if (signal_connection_death) {
            signal_connection_death();
            signal_connection_death = null;
        }
    };

    const armConnectionDeath = () => {
        // A new connection is taking over: everything still pending on the old one is dead.
        settlePendingRequests();
        connection_death = new Promise(resolve => {
            signal_connection_death = resolve;
        });
    };

    // Report the loss of the current connection exactly once. `is_disconnect_called` is reset per
    // connection in openNewConnection, so a socket that already reported its own close cannot
    // report again when it is later replaced.
    const notifyDisconnect = () => {
        if (typeof config.onDisconnect === 'function' && !is_disconnect_called) {
            config.onDisconnect();
            is_disconnect_called = true;
        }
    };

    // Gate for actions that require an authorized session. Auth is established at the WS
    // handshake (session cookies in the URL); the first balance response merely CONFIRMS it by
    // flipping client_store.is_authorize. Waiting on that observable — instead of an
    // expectResponse('balance') pinned to a connection instance that may die before its balance
    // arrives — makes the gate reconnect-proof.
    const waitForAuth = options => {
        // Pre-init there is no store to observe (and nothing to wait on) — matches the legacy
        // wait('balance') behavior of not gating before the socket layer is initialized.
        if (!client_store) return Promise.resolve();
        // `|| {}` keeps mobx on the promise-returning form — an explicit `undefined` second arg
        // would be treated as an effect function.
        return when(() => !!client_store.is_authorize, options || {});
    };

    const getSocketUrl = (is_mock_server = false) => {
        if (is_mock_server) {
            return 'ws://127.0.0.1:42069';
        }

        return getCompleteWebSocketURL();
    };

    const isReady = () => hasReadyState(1);

    const isClose = () => !binary_socket || hasReadyState(2, 3);

    const close = () => {
        binary_socket?.close();
    };

    const closeAndOpenNewConnection = () => {
        // The old connection's keep-alive must not probe (and tear down) the incoming handshake;
        // the new socket's onOpen re-arms the loop.
        stopKeepAlive();

        // close() moves an OPEN/CONNECTING socket to CLOSING synchronously (and is a no-op on a
        // CLOSED or never-created one). The outgoing socket's late close event is harmless: each
        // connection's onClose acts only when its instance is still the current one.
        close();
        openNewConnection();
    };

    // Send a keep-alive and arm the proof-of-life check. Any inbound message counts as proof of
    // life, so a socket that is actively receiving is never torn down.
    const sendKeepAlive = () => {
        // Only probe a socket that reports OPEN — a CONNECTING handshake must be left to finish,
        // and after a genuine close the reconnect is owned by the network monitor.
        if (!hasReadyState(1)) return;

        received_message_since_ping = false;
        // The grace timeout, not this promise, decides the outcome — swallow the rejection that
        // deriv-api emits if the socket dies while this request is pending.
        deriv_api?.send({ time: 1 })?.catch(() => {});
        clearTimeout(keep_alive_grace_timeout);
        keep_alive_grace_timeout = setTimeout(() => {
            if (!received_message_since_ping) {
                // No reply of any kind: the socket is dead even though it reports OPEN. Close it for
                // real (no switch counted) so onClose stops this loop and fires the 'close' wsEvent —
                // the network monitor then owns the reconnect with its bounded backoff.
                close();
            }
        }, KEEP_ALIVE_GRACE_MS);
    };

    const startKeepAlive = () => {
        stopKeepAlive(); // Own a single fresh loop: clear any prior interval before arming a new one.
        keep_alive_interval = setInterval(sendKeepAlive, KEEP_ALIVE_INTERVAL_MS);
    };

    const stopKeepAlive = () => {
        clearInterval(keep_alive_interval);
        clearTimeout(keep_alive_grace_timeout);
        keep_alive_interval = null;
        keep_alive_grace_timeout = null;
    };

    const hasReadyState = (...states) => binary_socket && states.some(s => binary_socket.readyState === s);

    const init = ({ options, client }) => {
        if (typeof options === 'object' && config !== options) {
            config = options;
        }
        client_store = client;
    };

    const getMockServerConfig = () => {
        const mock_server_config = localStorage.getItem('mock_server_data');
        return mock_server_config
            ? JSON.parse(mock_server_config)
            : {
                  session_id: '',
                  is_mockserver_enabled: false,
              };
    };

    const openNewConnection = () => {
        const mock_server_config = getMockServerConfig();
        const session_id = mock_server_config?.session_id || '';

        // Suppress the 'init' status blink when this open is a deliberate replacement of a socket
        // that is still mid-close-handshake (a switch), as opposed to a fresh/reconnect open.
        if (!hasReadyState(2)) config.wsEvent('init');

        if (isClose()) {
            // The outgoing connection is being replaced. Its own close event is identity-gated out
            // below — correctly, a replaced instance must never touch its successor — but that gate
            // also swallows the disconnect signal whenever the event has not been delivered yet:
            // an account switch (close() + openNewConnection() run synchronously, the close event
            // dispatches a task later), a CLOSING socket rebuilt by the network monitor, or a
            // CLOSED socket whose close is still queued after a tab freeze.
            //
            // Consumers keyed on connect/disconnect transitions still need to see it. SmartCharts
            // rebuilds its tick streams only on isConnectionOpened false -> true (driven by
            // common_store.is_socket_opened), so without this the chart stays bound to the dead
            // connection's stream and never re-requests ticks_history.
            if (deriv_api) notifyDisconnect();

            is_disconnect_called = false;
            // Reject everything still pending on the previous connection before the new one
            // takes over, and arm the death promise for the connection created below.
            armConnectionDeath();
            binary_socket = new WebSocket(getSocketUrl(session_id));

            // Add error event listener for connection failures
            binary_socket.addEventListener('error', error_event => {
                // eslint-disable-next-line no-console
                console.error('WebSocket error:', error_event);

                reconnect_attempt_count++;

                if (
                    reconnect_attempt_count >= MAX_CONSECUTIVE_CONNECTION_FAILURES &&
                    typeof config.onConnectionError === 'function'
                ) {
                    config.onConnectionError(error_event);
                    reconnect_attempt_count = 0; // Reset counter after throwing error
                }
            });

            deriv_api = new DerivAPIBasic({
                connection: binary_socket,
                storage: SocketCache,
                // connection_death was just armed above for THIS connection — the middleware races
                // every send against it, so a replaced instance's death can't touch the successor.
                middleware: new APIMiddleware(config, connection_death),
            });
            // Which instance the subscriptions below belong to — a replaced instance's late
            // close event must not settle the CURRENT connection's pending requests.
            const created_api = deriv_api;

            // Subscribe exactly once per `deriv_api` instance. `deriv_api` is only recreated inside
            // this `isClose()` guard, so keeping the subscriptions here prevents them from stacking
            // when openNewConnection() is called against a live socket.
            deriv_api.onOpen().subscribe(() => {
                config.wsEvent('open');

                // Reset reconnect attempt counter on successful connection
                reconnect_attempt_count = 0;

                // Start the keep-alive proof-of-life loop for this connection.
                startKeepAlive();

                // Remove automatic authorization - server handles it via account_id
                // Balance subscription will serve as auth confirmation
                const account_id = getAccountId();

                if (account_id) {
                    // Only reset authorization state on initial connection, not on reconnection
                    // On reconnection, user is still logged in and is_authorize should remain true
                    // This allows stores' reaction() to work correctly on reconnection
                    if (client_store && !is_connected_before) {
                        client_store.setIsAuthorize(false);
                    }

                    // Subscribe to balance immediately - this also confirms authorization
                    subscribeBalance();
                }

                // Call all reconnection handlers on reconnection (same timing as old system).
                // Subscriptions will be queued by deriv-api until authorization completes.
                // Deliberately NOT gated on account_id: logged-out sessions use public endpoints
                // (e.g. proposal) that need the same post-reconnect recovery.
                if (is_connected_before && reconnect_handlers.length > 0) {
                    reconnect_handlers.forEach(handler => {
                        if (typeof handler === 'function') {
                            handler();
                        }
                    });
                }

                if (typeof config.onOpen === 'function') {
                    config.onOpen(isReady());
                }

                if (!is_connected_before) {
                    is_connected_before = true;
                }
            });

            deriv_api.onMessage().subscribe(({ data: response }) => {
                // Any inbound message is proof of life for the keep-alive check above.
                received_message_since_ping = true;

                const msg_type = response.msg_type;
                State.set(['response', msg_type], cloneObject(response));

                config.wsEvent('message');

                if (typeof config.onMessage === 'function') {
                    config.onMessage(response);
                }
            });

            deriv_api.onClose().subscribe(() => {
                // Genuine-vs-stale is decided by INSTANCE IDENTITY: only the CURRENT connection's
                // close is genuine. A replaced instance's close — however late it arrives,
                // including a close queued across a tab freeze whose event only dispatches after
                // the replacement already happened — must not settle the new connection's
                // requests, stop its keep-alive, flag a disconnect, or fire a spurious 'close'
                // event (which would schedule a needless reconnect). Its own pending requests
                // were already settled when its successor was armed.
                if (deriv_api !== created_api) return;

                // The current connection is dead: reject its in-flight requests so callers can
                // react instead of hanging, stop the keep-alive so no loop runs without a socket,
                // and let the network monitor own the reconnect.
                settlePendingRequests();
                stopKeepAlive();
                config.wsEvent('close');

                notifyDisconnect();
            });
        }
    };

    const excludeAuthorize = type => !(type === 'authorize' && !client_store.is_logged_in);

    const wait = (...responses) => deriv_api?.expectResponse(...responses.filter(excludeAuthorize));

    const subscribe = (request, cb) => deriv_api.subscribe(request).subscribe(cb, cb); // Delegate error handling to the callback

    const subscribeBalance = cb => subscribe({ balance: 1 }, cb);

    const subscribeProposal = (req, cb) => subscribe({ proposal: 1, ...req }, cb);

    const subscribeProposalOpenContract = (contract_id = null, cb) =>
        subscribe({ proposal_open_contract: 1, ...(contract_id && { contract_id }) }, cb);

    const subscribeTicks = (symbol, cb) => subscribe({ ticks: symbol }, cb);

    const subscribeTicksHistory = (request_object, cb) => subscribe(request_object, cb);

    const subscribeTransaction = cb => subscribe({ transaction: 1 }, cb);

    const getTicksHistory = request_object => deriv_api.send(request_object);

    const buy = ({ proposal_id, price }) => deriv_api.send({ buy: proposal_id, price });

    const sell = (contract_id, bid_price) => deriv_api.send({ sell: contract_id, price: bid_price });

    const profitTable = (limit, offset, date_boundaries) =>
        deriv_api.send({ profit_table: 1, description: 1, limit, offset, ...date_boundaries });

    const statement = (limit, offset, other_properties) =>
        deriv_api.send({ statement: 1, description: 1, limit, offset, ...other_properties });

    const activeSymbols = (mode = 'brief') => deriv_api.activeSymbols(mode);

    const forgetStream = id => deriv_api.forget(id);

    const contractUpdate = (contract_id, limit_order) =>
        deriv_api.send({
            contract_update: 1,
            contract_id,
            limit_order,
        });

    const contractUpdateHistory = contract_id =>
        deriv_api.send({
            contract_update_history: 1,
            contract_id,
        });

    const cancelContract = contract_id => deriv_api.send({ cancel: contract_id });

    return {
        init,
        openNewConnection,
        forgetStream,
        wait,
        hasReadyState,
        get: () => deriv_api,
        setOnDisconnect: onDisconnect => {
            config.onDisconnect = onDisconnect;
        },
        setOnReconnect: onReconnect => {
            // Add handler to array if it's not already there
            if (typeof onReconnect === 'function' && !reconnect_handlers.includes(onReconnect)) {
                reconnect_handlers.push(onReconnect);
            }
        },
        removeOnReconnect: onReconnect => {
            // If a specific handler is provided, remove only that one
            if (typeof onReconnect === 'function') {
                const index = reconnect_handlers.indexOf(onReconnect);
                if (index > -1) {
                    reconnect_handlers.splice(index, 1);
                }
            } else {
                // If no handler provided, clear all handlers (backward compatibility)
                reconnect_handlers = [];
            }
        },
        cache: delegateToObject({}, () => deriv_api.cache),
        storage: delegateToObject({}, () => deriv_api.storage),
        buy,
        sell,
        cancelContract,
        close,
        contractUpdate,
        contractUpdateHistory,
        profitTable,
        statement,
        getTicksHistory,
        activeSymbols,
        subscribeBalance,
        subscribeProposal,
        subscribeProposalOpenContract,
        subscribeTicks,
        subscribeTicksHistory,
        subscribeTransaction,
        closeAndOpenNewConnection,
        sendKeepAlive,
        waitForAuth,
    };
})();

function delegateToObject(base_obj, extending_obj_getter) {
    return new Proxy(base_obj, {
        get(target, field) {
            if (target[field]) return target[field];

            const extending_obj =
                typeof extending_obj_getter === 'function' ? extending_obj_getter() : extending_obj_getter;

            if (!extending_obj) return undefined;

            const value = extending_obj[field];
            if (value) {
                if (typeof value === 'function') {
                    return value.bind(extending_obj);
                }
                return value;
            }

            return undefined;
        },
    });
}

const proxied_socket_base = delegateToObject(BinarySocketBase, () => BinarySocketBase.get());

const proxyForAuthorize = obj =>
    new Proxy(obj, {
        get(target, field) {
            if (target[field] && typeof target[field] !== 'function') {
                return proxyForAuthorize(target[field]);
            }
            return (...args) => {
                const account_id = getAccountId();
                if (account_id) {
                    // Gate on auth confirmation (is_authorize, flipped by the first balance
                    // response) — reconnect-proof, unlike an expectResponse pinned to one
                    // connection instance.
                    return BinarySocketBase.waitForAuth().then(() => target[field](...args));
                }
                // Not logged in, execute without waiting
                return target[field](...args);
            };
        },
    });

BinarySocketBase.authorized = proxyForAuthorize(proxied_socket_base);

module.exports = proxied_socket_base;
