import { action, computed, makeObservable, observable, override, reaction, runInAction, toJS } from 'mobx';

import {
    CONTRACT_TYPES,
    getAccuBarriersDefaultTimeout,
    getContractTypesConfig,
    isAccumulatorContract,
    isAccumulatorContractOpen,
    isCallPut,
    isDesktop,
    isHighLow,
    isTurbosContract,
    isVanillaContract,
    LocalStore,
    mapErrorMessage,
    setTradeURLParams,
    switch_to_tick_chart,
    TRADE_TYPES,
} from '@deriv/shared';
import { BaseStore } from '@deriv/stores';

import { getAccumulatorMarkers, getPriorTickEpoch } from './Helpers/chart-markers';
import ContractStore from './contract-store';

/**
 * BaseStore's sessionStorage snapshot of the trade store. A cold-load fallback
 * only — see `getActiveTradeState`, which is what the store should ask.
 */
const getStoredTradeState = () => JSON.parse(sessionStorage.getItem('trade_store')) || {};

/**
 * How long a finished Accumulator keeps its band on the trade chart, in ms.
 *
 * Matches the 8-second retention in the Deriv mobile app
 * (`recentlySoldContractsProvider`), so the band survives long enough to be read
 * while the next proposal is already drawing over it.
 */
const ACCUMULATOR_CLOSED_BAND_RETENTION = 8000;

export default class ContractTradeStore extends BaseStore {
    // --- Observable properties ---
    contracts = [];
    contracts_map = {}; // Optimized with observable.ref for better performance
    has_error = false;
    error_message = '';

    // Chart specific observables
    granularity = +LocalStore.get('contract_trade.granularity') || 0;
    chart_type = LocalStore.get('contract_trade.chart_style') || 'line';
    prev_chart_type = '';
    prev_granularity = null;

    // Accumulator barriers data:
    accumulator_barriers_data = {};
    accumulator_contract_barriers_data = {};
    previous_accumulator_barriers_data = {};
    is_barriers_loading = false;

    last_contract_override = null;

    /**
     * The market and trade type the user is on, pushed in by the trade store.
     *
     * Null until it reports one; `getActiveTradeState` falls back to the
     * sessionStorage snapshot until then.
     */
    active_market = null;

    constructor(root_store) {
        super({ root_store });

        makeObservable(this, {
            is_barriers_loading: observable,
            accumulator_barriers_data: observable.struct,
            accumulator_contract_barriers_data: observable.struct,
            previous_accumulator_barriers_data: observable.struct,
            clearAccumulatorBarriersData: action.bound,
            setBarriersLoadingState: action.bound,
            contracts: observable.shallow,
            contracts_map: observable.ref, // Only react to reference changes, not deep property changes
            has_crossed_accu_barriers: computed,
            accumulator_barriers_payload: computed,
            has_error: observable,
            error_message: observable,
            granularity: observable,
            chart_type: observable,
            last_contract_override: observable,
            active_market: observable.struct,
            setActiveMarket: action.bound,
            clearLastContractOverride: action.bound,
            updateAccumulatorBarriersData: action.bound,
            updateChartType: action.bound,
            updateGranularity: action.bound,
            markers_array: computed,
            filtered_contracts: computed,
            addContract: action.bound,
            removeContract: action.bound,
            clearContracts: action.bound,
            onUnmount: override,
            prev_chart_type: observable,
            prev_granularity: observable,
            updateProposal: action.bound,
            last_contract: computed,
            clearError: action.bound,
            getContractById: action.bound,
            prev_contract: computed,
            savePreviousChartMode: action.bound,
            setNewAccumulatorBarriersData: action.bound,
            clearClosedContractMarkers: action.bound,
        });

        this.root_store = root_store;

        reaction(
            () => this.last_contract.contract_info,
            () => {
                if (!isAccumulatorContract(this.last_contract.contract_info?.contract_type)) return;
                const {
                    barrier_spot_distance,
                    current_spot,
                    current_spot_time,
                    current_spot_high_barrier,
                    current_spot_low_barrier,
                    is_sold,
                    underlying,
                } = this.last_contract.contract_info || {};
                if (current_spot && current_spot_high_barrier && !is_sold) {
                    this.updateAccumulatorBarriersData({
                        barrier_spot_distance,
                        current_spot_time,
                        accumulators_high_barrier: current_spot_high_barrier,
                        accumulators_low_barrier: current_spot_low_barrier,
                        should_update_contract_barriers: true,
                        underlying,
                    });
                } else if (!isAccumulatorContractOpen(this.last_contract.contract_info)) {
                    this.clearAccumulatorBarriersData(true);
                }
            }
        );
    }

    // -------------------
    // ----- Actions -----
    // -------------------

    clearAccumulatorBarriersData(should_clear_contract_data_only) {
        // Always clear contract barriers data regardless of contract state
        this.accumulator_contract_barriers_data = {};

        if (!should_clear_contract_data_only) {
            // Ensure all barrier-related properties are reset
            runInAction(() => {
                this.accumulator_barriers_data = {
                    accumulators_high_barrier: null,
                    accumulators_low_barrier: null,
                    barrier_spot_distance: null,
                    current_spot: null,
                    current_spot_time: null,
                    tick_update_timestamp: null,
                };
            });

            // Reset last contract data for accumulator if no active positions
            const has_active_positions = this.root_store.portfolio?.active_positions?.length > 0;
            if (!has_active_positions && this.last_contract?.contract_info?.contract_type === 'ACCU') {
                // Create a clean copy without profit information
                const clean_contract = { ...this.last_contract };
                if (clean_contract.contract_info) {
                    clean_contract.contract_info = {
                        ...clean_contract.contract_info,
                        profit: 0,
                        status: 'open',
                    };
                }
                this.last_contract_override = clean_contract;
            }
        }
    }

    clearLastContractOverride() {
        this.last_contract_override = null;
    }

    /**
     * Records the market and trade type the user is on.
     *
     * Called by the trade store, which this store cannot reach on its own: the
     * trader root store wraps core, not the other way round, and core's own
     * `modules` is never populated.
     */
    setActiveMarket({ symbol, contract_type }) {
        this.active_market = { symbol, contract_type };
    }

    /**
     * The market everything here is derived against.
     *
     * Observable, which is the whole point. The sessionStorage snapshot below is
     * written by a BaseStore reaction and is invisible to mobx, so a `computed`
     * derived from it never invalidates when the user switches market or trade
     * type — `accumulator_barriers_payload` would keep serving the null it
     * cached on a non-Accumulators tab, and the barriers stayed gone until the
     * page was reloaded. It is kept only as the cold-load fallback, for before
     * the trade store has reported anything.
     */
    getActiveTradeState() {
        return this.active_market ?? getStoredTradeState();
    }

    setNewAccumulatorBarriersData(new_barriers_data, should_update_contract_barriers) {
        if (should_update_contract_barriers) {
            this.accumulator_contract_barriers_data = {
                ...this.accumulator_contract_barriers_data,
                ...new_barriers_data,
            };
        } else {
            this.accumulator_barriers_data = {
                ...this.accumulator_barriers_data,
                ...new_barriers_data,
            };
        }
    }

    updateAccumulatorBarriersData({
        accumulators_high_barrier,
        accumulators_low_barrier,
        barrier_spot_distance,
        current_spot,
        current_spot_time,
        prev_spot_time,
        should_update_contract_barriers,
        underlying,
    }) {
        const { symbol } = this.getActiveTradeState();

        // Reject updates from wrong market or missing underlying
        if (underlying && symbol && underlying !== symbol) {
            return;
        }

        // If we have new barrier data, update and set loading to false
        if (accumulators_high_barrier || accumulators_low_barrier) {
            this.setBarriersLoadingState(false);
        }

        if (current_spot) {
            const ticks_history_prev_spot_time = prev_spot_time ?? this.accumulator_barriers_data.current_spot_time;
            // update current tick coming from ticks_history while skipping an update for duplicate data
            if (current_spot_time === ticks_history_prev_spot_time) return;
            const current_spot_data = {
                current_spot,
                current_spot_time,
                ticks_history_prev_spot_time,
                tick_update_timestamp: Date.now(),
            };
            this.setNewAccumulatorBarriersData(current_spot_data, true);
            this.setNewAccumulatorBarriersData(current_spot_data);
            return;
        }
        const new_barriers_data = {
            accumulators_high_barrier,
            accumulators_low_barrier,
            barrier_spot_distance,
            should_update_contract_barriers,
            proposal_prev_spot_time: current_spot_time,
        };
        // Check if we have existing barrier data that should be preserved
        const has_existing_barriers = should_update_contract_barriers
            ? this.accumulator_contract_barriers_data.accumulators_high_barrier
            : this.accumulator_barriers_data.accumulators_high_barrier;

        // Skip update for duplicate data, or when waiting for tick synchronization
        // BUT always accept new barriers when there are no existing barriers
        // (e.g., after contract is closed and barriers were cleared)
        if (
            (has_existing_barriers &&
                this.accumulator_barriers_data.current_spot_time &&
                this.accumulator_barriers_data.current_spot_time !== current_spot_time &&
                !this.accumulator_barriers_data.accumulators_high_barrier) ||
            Object.keys(new_barriers_data).every(key =>
                should_update_contract_barriers
                    ? this.accumulator_contract_barriers_data[key] === new_barriers_data[key]
                    : this.accumulator_barriers_data[key] === new_barriers_data[key]
            )
        ) {
            // skip an update for duplicate data, or when a tick, which current barriers are related to, was not returned from ticks_history
            return;
        }

        // Applied straight away: holding the barriers back until the tick they
        // belong to has rendered is the chart's job now (it is the only side
        // that knows when that happened), driven by `barrierDelayMs` in
        // `accumulator_barriers_payload`. Delaying here as well would stack two
        // waits on top of each other.
        this.setNewAccumulatorBarriersData(new_barriers_data, should_update_contract_barriers);
    }

    updateChartType(type) {
        LocalStore.set('contract_trade.chart_style', type);
        this.chart_type = type;
        setTradeURLParams({ chartType: this.chart_type });
    }

    updateGranularity(granularity) {
        const tick_chart_types = ['line', 'candles', 'hollow', 'ohlc'];

        if (granularity === 0 && tick_chart_types.indexOf(this.chart_type) === -1) {
            this.chart_type = 'line';
        }

        LocalStore.set('contract_trade.granularity', granularity);
        this.granularity = granularity;
        if (this.granularity === 0) {
            this.root_store.notifications.removeNotificationMessage(switch_to_tick_chart);
        }
        setTradeURLParams({ granularity: this.granularity });
    }

    savePreviousChartMode(chart_type, granularity) {
        this.prev_chart_type = chart_type;
        this.prev_granularity = granularity;
    }

    applicable_contracts = (trade_store_state = this.getActiveTradeState()) => {
        const { contract_type: trade_type, symbol: underlying } = trade_store_state;

        if (!trade_type || !underlying) {
            return [];
        }
        // Guard against invalid/corrupted trade_type from sessionStorage.
        // This prevents crashes when:
        // 1. Race condition: trade_type not initialized yet (empty string)
        // 2. Stale data: invalid URL params persisted from previous session
        const contract_config = getContractTypesConfig()[trade_type];
        if (!contract_config || !contract_config.trade_types) {
            return [];
        }
        let { trade_types } = contract_config;
        const is_call_put = isCallPut(trade_type);
        if (is_call_put) {
            // treat CALLE/PUTE and CALL/PUT the same
            trade_types = [CONTRACT_TYPES.CALLE, CONTRACT_TYPES.PUTE, CONTRACT_TYPES.CALL, CONTRACT_TYPES.PUT];
        } else if (isTurbosContract(trade_type)) {
            //to show both Long and Short recent contracts on DTrader chart
            trade_types = [CONTRACT_TYPES.TURBOS.LONG, CONTRACT_TYPES.TURBOS.SHORT];
        } else if (isVanillaContract(trade_type)) {
            //to show both Call and Put recent contracts on DTrader chart
            trade_types = [CONTRACT_TYPES.VANILLA.CALL, CONTRACT_TYPES.VANILLA.PUT];
        }
        return (
            this.contracts
                .filter(c => {
                    const contract_underlying = c.contract_info.underlying_symbol;
                    return contract_underlying === underlying;
                })
                .filter(c => {
                    const info = c.contract_info;

                    const trade_type_is_supported = trade_types.indexOf(info.contract_type) !== -1;
                    // both high_low & rise_fall have the same contract_types in POC response
                    // entry_spot=barrier means it is rise_fall contract (blame the api)
                    const entry_value = info.entry_spot;
                    if (trade_type_is_supported && is_call_put && ((info.barrier && entry_value) || info.shortcode)) {
                        if (`${+entry_value}` === `${+info.barrier}` && !isHighLow(info)) {
                            return trade_type === TRADE_TYPES.RISE_FALL || trade_type === TRADE_TYPES.RISE_FALL_EQUAL;
                        }
                        return trade_type === TRADE_TYPES.HIGH_LOW;
                    }
                    return trade_type_is_supported;
                })
                // Sort by date_start to ensure newest contract is always last
                .sort((a, b) => (a.contract_info.date_start || 0) - (b.contract_info.date_start || 0))
        );
    };

    getHasCrossedAccuBarriers(symbol, last_contract) {
        const contract_info = last_contract.contract_info;
        const { current_spot: contract_current_spot, entry_spot, underlying } = contract_info || {};
        const {
            accumulators_high_barrier,
            accumulators_low_barrier,
            current_spot,
            proposal_prev_spot_time,
            ticks_history_prev_spot_time,
        } =
            (isAccumulatorContractOpen(contract_info)
                ? this.accumulator_contract_barriers_data
                : this.accumulator_barriers_data) || {};
        const is_knock_out =
            current_spot &&
            accumulators_high_barrier &&
            accumulators_low_barrier &&
            (current_spot >= accumulators_high_barrier || current_spot <= accumulators_low_barrier);
        const is_relevant_barrier =
            ticks_history_prev_spot_time && ticks_history_prev_spot_time === proposal_prev_spot_time;
        const should_highlight_contract_barriers =
            entry_spot && entry_spot !== contract_current_spot && underlying === symbol;
        return !!(
            is_knock_out &&
            is_relevant_barrier &&
            (!isAccumulatorContractOpen(contract_info) || should_highlight_contract_barriers)
        );
    }

    get has_crossed_accu_barriers() {
        const trade_store_state = this.getActiveTradeState();
        return this.getHasCrossedAccuBarriers(trade_store_state.symbol, this.getLastContract(trade_store_state));
    }

    get filtered_contracts() {
        return this.applicable_contracts();
    }

    /**
     * Picks which barrier set is currently authoritative: the per-tick barriers
     * from `proposal_open_contract` while a contract is running, or the ones from
     * `proposal` before and after it.
     *
     * Takes the trade-store state so a caller reads it once and threads it, the
     * way `markers_array` and `has_crossed_accu_barriers` do. `last_contract` is
     * returned alongside because resolving it needs that same state.
     */
    getAccumulatorBarriersSource(trade_store_state = this.getActiveTradeState()) {
        const last_contract = this.getLastContract(trade_store_state);
        const { current_spot_time, entry_spot_time, exit_spot_time } = last_contract.contract_info || {};

        const should_show_poc_barriers =
            (entry_spot_time && entry_spot_time !== current_spot_time) ||
            (exit_spot_time && current_spot_time <= exit_spot_time);

        // Check if there are active accumulator positions - don't trust stale last_contract data
        const has_active_accu_positions = this.root_store.portfolio?.active_positions?.some(pos =>
            isAccumulatorContract(pos.contract_info?.contract_type)
        );
        // Only consider contract as open if there are actually active positions AND the contract info shows open
        const is_open_for_barriers =
            has_active_accu_positions && isAccumulatorContractOpen(last_contract.contract_info);
        const use_contract_barriers =
            is_open_for_barriers &&
            should_show_poc_barriers &&
            this.accumulator_contract_barriers_data?.accumulators_high_barrier;

        return {
            barriers_source: use_contract_barriers
                ? this.accumulator_contract_barriers_data
                : this.accumulator_barriers_data,
            is_open_for_barriers,
            last_contract,
        };
    }

    /**
     * The newest accumulator contract for the current symbol, read past
     * `last_contract_override` so a just-settled contract keeps its real profit
     * for the closed band. `applicable_contracts` already filters by symbol and
     * trade type.
     *
     * A method rather than a `computed`, so it is recomputed on every read. The
     * active market is observable now (see `getActiveTradeState`), so a computed
     * would invalidate correctly — but there is nothing to gain from caching a
     * lookup this cheap, and a method cannot go stale.
     */
    getAccumulatorContractInfo() {
        const applicable_contracts = this.applicable_contracts();
        const contract_info = applicable_contracts[applicable_contracts.length - 1]?.contract_info;

        return isAccumulatorContract(contract_info?.contract_type) ? contract_info : null;
    }

    /**
     * The Accumulators barrier bands, shaped for SmartCharts' `accumulatorBarriers`
     * prop. Null when there is nothing to draw.
     *
     * Mirrors deriv_trader's chart, which renders up to two bands at once: the
     * `live` one tracking the spot (a running contract, or the pre-trade proposal)
     * and the frozen `closed` one of a contract that has just finished. The chart
     * holds the closed band for 8s, so both are on screen while the next proposal
     * is already drawing.
     *
     * `symbol` rides along so consumers can tell which market these bands belong
     * to. This store resolves the active market through `sessionStorage`, which
     * mobx cannot observe: switching market tabs updates it through a reaction,
     * but this computed has no reason to re-run, so it can keep serving bands for
     * the market the user just left. Resolving the symbol here — inside the same
     * computation, from the same read — means it can never disagree with the
     * bands beside it, so TradeChart (which does observe the symbol) can drop a
     * payload that isn't for the chart on screen. The chart itself ignores it.
     */
    get accumulator_barriers_payload() {
        const { contract_type: trade_type, symbol } = this.getActiveTradeState();
        if (trade_type !== TRADE_TYPES.ACCUMULATOR) return null;

        const live = this.getAccumulatorLiveBand();
        const closed = this.getAccumulatorClosedBand();

        if (!live && !closed) return null;

        return {
            symbol: symbol ?? null,
            live,
            closed,
            // The chart applies the hold; this only says how long it should be.
            barrierDelayMs: getAccuBarriersDefaultTimeout(symbol),
        };
    }

    /**
     * The band tracking the current spot: a running contract's per-tick barriers
     * with its P/L, or — when nothing is running — the pre-trade proposal.
     */
    getAccumulatorLiveBand() {
        const { is_open_for_barriers } = this.getAccumulatorBarriersSource();
        const contract_info = this.getAccumulatorContractInfo();

        // Running contract. Read straight off the POC — the same fields
        // `AccumulatorAnnotationBuilder.buildRunningAnnotation` uses — so the P/L
        // and the profit-driven colouring survive even while the barrier store is
        // being reset around the contract ending.
        if (contract_info && is_open_for_barriers && !contract_info.exit_spot) {
            const {
                barrier_spot_distance,
                currency,
                current_spot,
                current_spot_high_barrier,
                current_spot_low_barrier,
                current_spot_time,
                entry_spot_time,
                high_barrier,
                is_sold,
                low_barrier,
                profit,
            } = contract_info;

            const contract_high = current_spot_high_barrier ?? high_barrier;
            const contract_low = current_spot_low_barrier ?? low_barrier;
            const barrier_epoch = current_spot_time ?? entry_spot_time;

            if (contract_high && contract_low && current_spot && barrier_epoch) {
                return {
                    highBarrier: String(contract_high),
                    lowBarrier: String(contract_low),
                    barrierEpoch: barrier_epoch,
                    barrierSpotDistance: barrier_spot_distance || undefined,
                    spot: +current_spot,
                    spotEpoch: barrier_epoch,
                    ...(profit == null ? {} : { profit: +profit, currency }),
                    ...(is_sold ? { isSold: true } : {}),
                };
            }
        }

        // Pre-trade proposal.
        const { accumulators_high_barrier, accumulators_low_barrier, barrier_spot_distance, proposal_prev_spot_time } =
            this.accumulator_barriers_data || {};
        const { current_spot, current_spot_time } = this.accumulator_barriers_data || {};

        if (
            !accumulators_high_barrier ||
            !accumulators_low_barrier ||
            !proposal_prev_spot_time ||
            !current_spot ||
            !current_spot_time
        ) {
            return null;
        }

        return {
            highBarrier: String(accumulators_high_barrier),
            lowBarrier: String(accumulators_low_barrier),
            barrierEpoch: proposal_prev_spot_time,
            barrierSpotDistance: barrier_spot_distance || undefined,
            spot: +current_spot,
            spotEpoch: current_spot_time,
        };
    }

    /**
     * The frozen band of a contract that has just finished, bounded by its exit
     * tick. Null until the exit spot arrives.
     */
    getAccumulatorClosedBand() {
        const contract_info = this.getAccumulatorContractInfo();
        if (!contract_info) return null;

        const {
            currency,
            exit_spot,
            exit_spot_time,
            high_barrier,
            low_barrier,
            profit,
            tick_stream = [],
        } = contract_info;

        if (!exit_spot || !exit_spot_time) return null;

        // A settled contract's barriers live in high_barrier/low_barrier, not in
        // current_spot_*: the latter are the last per-tick values from while it
        // was still running, and the API stops updating them once it ends. This
        // is the same rule `getAccuBarriersForContractDetails` applies, and what
        // the pre-annotation marker band used.
        //
        // Reading current_spot_* here pins the band to the wrong price level and,
        // because the painter forces red when the exit spot sits outside the
        // barriers it was given, paints a won contract as a loss.
        if (!high_barrier || !low_barrier) return null;

        return {
            highBarrier: String(high_barrier),
            lowBarrier: String(low_barrier),
            // The tick before the exit — where the band starts. Picked by epoch
            // rather than by position: the exit tick is appended to tick_stream a
            // beat after exit_spot_time arrives, so indexing from the end would
            // pick a different tick on the first POC than on the next one and the
            // band would visibly shift.
            barrierEpoch: getPriorTickEpoch(tick_stream, exit_spot_time),
            // No barrierSpotDistance: the contract's is measured against the
            // live spot, so the chart recomputes it against the exit spot —
            // same as `AccumulatorAnnotationBuilder.buildClosedAnnotation`.
            exitSpot: +exit_spot,
            exitEpoch: exit_spot_time,
            ...(profit == null ? {} : { profit: +profit, currency }),
            retentionMs: ACCUMULATOR_CLOSED_BAND_RETENTION,
        };
    }

    get markers_array() {
        const trade_store_state = this.getActiveTradeState();
        const { contract_type: trade_type } = trade_store_state;

        const markers = this.applicable_contracts(trade_store_state)
            .map(c => c.marker)
            .filter(m => m)
            .map(m => toJS(m));

        const { is_open_for_barriers } = this.getAccumulatorBarriersSource(trade_store_state);

        if (trade_type === TRADE_TYPES.ACCUMULATOR && is_open_for_barriers) {
            // Start-time and entry-spot only; the band is an annotation now.
            const accumulator_marker = getAccumulatorMarkers({
                contract_info: this.getAccumulatorContractInfo(),
            });
            if (accumulator_marker) markers.push(accumulator_marker);
        }

        return markers;
    }

    addContract({
        barrier,
        contract_id,
        contract_type,
        start_time,
        longcode,
        underlying,
        is_tick_contract,
        limit_order = {},
    }) {
        const existing_contract = this.contracts_map[contract_id];
        if (existing_contract) {
            if (this.contracts.every(c => c.contract_id !== contract_id)) {
                this.contracts.push(existing_contract);
            }
            return;
        }
        const is_last_contract = contract_id === this.last_contract.contract_id;

        const contract = new ContractStore(this.root_store, { contract_id });
        contract.populateConfig(
            {
                date_start: start_time,
                barrier,
                contract_type,
                longcode,
                underlying,
                limit_order,
            },
            is_last_contract
        );

        this.contracts.push(contract);
        this.contracts_map = { ...this.contracts_map, [contract_id]: contract };

        // Clear any override when adding a new contract
        this.clearLastContractOverride();

        if (is_tick_contract && !this.root_store.portfolio.is_multiplier && this.granularity !== 0 && isDesktop()) {
            this.root_store.notifications.addNotificationMessage(switch_to_tick_chart);
        }
    }

    removeContract({ contract_id }) {
        this.contracts = this.contracts.filter(c => c.contract_id !== contract_id);
        const { [contract_id]: _, ...rest } = this.contracts_map;
        this.contracts_map = rest;
    }

    /**
     * Clear all contracts and related data
     * Called when switching accounts to prevent showing markers from previous account
     */
    clearContracts() {
        this.contracts = [];
        this.contracts_map = {};
        this.clearAccumulatorBarriersData(false);
        this.clearLastContractOverride();
    }

    setBarriersLoadingState(is_loading) {
        this.is_barriers_loading = is_loading;
    }

    onUnmount() {
        // TODO: don't forget the tick history when switching to contract-replay-store
    }

    // Clear markers for closed contracts
    clearClosedContractMarkers() {
        if (this.contracts && this.contracts.length > 0) {
            // Clear markers for all contracts, not just sold ones
            // This ensures entry spot markers and other persistent markers are also cleared
            runInAction(() => {
                this.contracts.forEach(contract => {
                    if (contract) {
                        contract.markers_array = [];
                        contract.marker = null;
                    }
                });

                // Force a refresh of the markers array
                this.last_contract_override = null;
            });
        }
    }

    // Called from portfolio
    updateProposal(response) {
        if ('error' in response) {
            this.has_error = true;
            this.error_message = mapErrorMessage(response.error);
            return;
        }
        // Update the contract-store corresponding to this POC
        if (response.proposal_open_contract) {
            const contract_id = +response.proposal_open_contract.contract_id;
            const contract = this.contracts_map[contract_id];
            if (!contract) return;

            // Update contract_info before calculating is_last_contract
            contract.contract_info = response.proposal_open_contract;
            const is_last_contract = contract_id === this.last_contract.contract_id;
            contract.populateConfig(response.proposal_open_contract, is_last_contract);
            if (response.proposal_open_contract.is_sold) {
                this.root_store.notifications.removeNotificationMessage(switch_to_tick_chart);
                contract.cacheProposalOpenContractResponse(response);
            }
        }
    }

    getLastContract(trade_store_state = this.getActiveTradeState()) {
        if (this.last_contract_override) {
            return this.last_contract_override;
        }

        const applicable_contracts = this.applicable_contracts(trade_store_state);
        const length = this.contracts[0]?.contract_info.current_spot_time ? applicable_contracts.length : -1;
        return length > 0 ? applicable_contracts[length - 1] : {};
    }

    get last_contract() {
        return this.getLastContract();
    }

    get prev_contract() {
        const applicable_contracts = this.applicable_contracts();
        const length = this.contracts[0]?.contract_info.current_spot_time ? applicable_contracts.length : -1;
        return applicable_contracts[length - 2];
    }

    clearError() {
        this.error_message = '';
        this.has_error = false;
    }

    getContractById(contract_id) {
        return (
            this.contracts_map[contract_id] ||
            // or get contract from contract_replay store when user is on the contract details page
            this.root_store.contract_replay.contract_store
        );
    }
}
