import { action, computed, makeObservable, observable, reaction } from 'mobx';

import type { TAutoRun, TAutoStopReasonCode, TAutoStrategyDescriptor } from '@deriv/api';
import { trackStrategySessionCompleted, type TStrategyRunPayload } from '@deriv/shared';
import { BaseStore } from '@deriv/stores';
import { localize } from '@deriv-com/translations';

import { TRootStore } from 'Types';

import {
    DEFAULT_AUTOMATION_CONFIG,
    TAutomationConfig,
} from '../../../AppV2/Components/AutomationPanel/automation-config';

type TAutoRunStatus = 'idle' | 'starting' | 'running' | 'paused' | 'stopping' | 'stopped';

type TStopEvent = {
    run_id: string;
    stop_reason: 'condition_triggered' | 'error';
    code: TAutoStopReasonCode;
};

export default class AutomationStore extends BaseStore<TRootStore> {
    config: TAutomationConfig = { ...DEFAULT_AUTOMATION_CONFIG };
    active_run_id: string | null = null;
    active_run: TAutoRun | null = null;
    run_status: TAutoRunStatus = 'idle';
    last_error: { code: string; message: string } | null = null;
    available_strategies: TAutoStrategyDescriptor[] = [];
    last_stop_event: TStopEvent | null = null;
    is_recovering = false;
    /**
     * Analytics snapshot of the run config captured at start (set by `useRunControls`),
     * replayed on completion so `strategy_session_completed` reports what the run actually
     * ran with — not the live form, which may have changed by the time it stops. Not
     * observable: it never drives rendering. Null for runs we didn't start (e.g. adopted
     * from another device), which therefore don't emit a completion event.
     */
    active_run_analytics: TStrategyRunPayload | null = null;
    /**
     * Last-known run per account, kept fresh from the auto_get stream. On
     * re-adopting a run (account switch / reconnect), `adoptRun` restores its
     * contracts so Contracts/P&L don't flash 0 while the lean auto_list payload is
     * topped up by auto_get. Not observable — it only seeds `active_run`.
     */
    private run_by_loginid = new Map<string, TAutoRun>();

    constructor(options: { root_store: TRootStore }) {
        super({
            ...options,
            local_storage_properties: ['config'],
            store_name: 'automation_store',
        });

        makeObservable(this, {
            config: observable,
            active_run_id: observable,
            active_run: observable,
            run_status: observable,
            last_error: observable,
            available_strategies: observable,
            last_stop_event: observable.ref,
            is_recovering: observable,
            active_run_analytics: observable.ref,

            is_running: computed,
            is_paused: computed,
            can_start: computed,
            is_active: computed,
            net_profit: computed,
            contracts_count: computed,
            setConfig: action.bound,
            setStrategyParam: action.bound,
            setRunStatus: action.bound,
            setIsRecovering: action.bound,
            setActiveRunAnalytics: action.bound,
            onRunStarted: action.bound,
            adoptRun: action.bound,
            onRunUpdate: action.bound,
            onRunStopped: action.bound,
            recoverStoppedRun: action.bound,
            setStrategies: action.bound,
            setError: action.bound,
            resetError: action.bound,
            acknowledgeStopEvent: action.bound,
            resetRunState: action.bound,
            reset: action.bound,
        });

        this.logout_listener = async () => {
            this.reset();
        };

        // Runs are per-account on the BE — clear the run state on account
        // switch so the previous account's run isn't surfaced while
        // `AutomationSubscriptionManager` fetches the new account's runs.
        reaction(
            () => this.root_store.client.loginid,
            (loginid, prev_loginid) => {
                if (prev_loginid && loginid !== prev_loginid) {
                    this.resetRunState();
                    // Sync set closes the render gap between
                    // `is_switching_account` flipping false and the recovery
                    // effect running. Cleared in the manager's finally.
                    this.is_recovering = true;
                }
            }
        );
    }

    get is_running() {
        return this.run_status === 'running';
    }

    get is_paused() {
        return this.run_status === 'paused';
    }

    get can_start() {
        return this.run_status === 'idle' || this.run_status === 'stopped';
    }

    // A run is active (starting/running/paused/stopping) — the complement of
    // `can_start`. Consumers use this for lock/disable logic.
    get is_active() {
        return !this.can_start;
    }

    get net_profit() {
        // Only count contracts that have actually settled (`won`/`lost`, i.e. `sell_price` is defined).
        if (!this.active_run?.contracts) return 0;
        return this.active_run.contracts.reduce((sum, contract) => {
            if (contract.sell_price === undefined) return sum;
            return sum + (contract.sell_price - contract.buy_price);
        }, 0);
    }

    get contracts_count() {
        return this.active_run?.contracts?.length ?? 0;
    }

    private getSelectedStrategy() {
        return this.available_strategies.find(s => s.strategy_id === this.config.strategy);
    }

    setConfig<K extends keyof TAutomationConfig>(key: K, value: TAutomationConfig[K]) {
        this.config = { ...this.config, [key]: value };
    }

    /** Update a single strategy parameter value by its schema key. */
    setStrategyParam(key: string, value: string) {
        this.config = {
            ...this.config,
            strategy_params: { ...this.config.strategy_params, [key]: value },
        };
    }

    setRunStatus(status: TAutoRunStatus) {
        this.run_status = status;
    }

    setIsRecovering(value: boolean) {
        this.is_recovering = value;
    }

    /** Stash the analytics snapshot for the run we're starting, replayed on completion. */
    setActiveRunAnalytics(payload: TStrategyRunPayload | null) {
        this.active_run_analytics = payload;
    }

    onRunStarted(run: TAutoRun) {
        this.active_run = run;
        this.active_run_id = run.run_id;
        // Stay in 'starting' until a contract is observed so an immediate
        // BE stop (e.g. InsufficientBalance) doesn't flash Pause/Stop UI.
        // Only for runs we start here — adopted runs use `adoptRun`.
        this.run_status = (run.contracts?.length ?? 0) > 0 ? 'running' : 'starting';
        this.last_error = null;
        // A new run supersedes the previous run's stop announcement.
        this.last_stop_event = null;
    }

    /**
     * Adopt a run that's already live on the server (account switch, resync,
     * reconnect). `onRunStarted` would hold it in 'starting' until the next contract.
     * Recovery payload may not include `contracts` yet, so trust the BE `status` instead.
     */
    adoptRun(run: TAutoRun) {
        // Only adopt live runs; ignore anything else so a stopped run can't be
        // surfaced as active. Guard before mutating to avoid a half-updated state.
        if (run.status !== 'running' && run.status !== 'paused') return;

        // auto_list is lean (no contracts). Reuse this account's last-known run
        // contracts so Contracts/P&L don't flash 0 until auto_get repopulates them.
        const cached_run = this.run_by_loginid.get(this.root_store.client.loginid ?? '');
        const fallback = cached_run?.run_id === run.run_id ? cached_run.contracts : [];
        this.active_run = { ...run, contracts: run.contracts?.length ? run.contracts : fallback };
        this.active_run_id = run.run_id;
        this.run_status = run.status;
        this.last_error = null;
    }

    onRunUpdate(run: TAutoRun) {
        // Don't process stale subscription data after the run has been stopped
        if (this.run_status === 'stopping' || this.run_status === 'stopped' || this.run_status === 'idle') return;

        // Ignore updates from a different run (stale data from a previous subscription)
        if (this.active_run_id && run.run_id !== this.active_run_id) return;

        this.active_run = run;
        this.active_run_id = run.run_id;
        // Cache this account's latest run so a later re-adopt (account switch /
        // reconnect) can restore contracts before auto_get re-delivers them.
        if (this.root_store.client.loginid) this.run_by_loginid.set(this.root_store.client.loginid, run);

        if (run.status === 'stopped') {
            // Surface BE-triggered stops to the snackbar/popup consumer.
            // `user_stopped` is silent — the user clicked Stop themselves.
            if ((run.stop_reason === 'condition_triggered' || run.stop_reason === 'error') && run.stop_reason_code) {
                this.last_stop_event = {
                    run_id: run.run_id,
                    stop_reason: run.stop_reason,
                    code: run.stop_reason_code,
                };
            }
            this.onRunStopped({
                status: run.status,
                stop_reason: run.stop_reason,
                stop_reason_code: run.stop_reason_code,
            });
        } else if (run.status === 'paused') {
            this.run_status = 'paused';
        } else if (run.status === 'running') {
            // See `onRunStarted` — require a real contract before promoting.
            if ((run.contracts?.length ?? 0) > 0) {
                this.run_status = 'running';
            }
        }
    }

    onRunStopped(completion?: { status?: string; stop_reason?: string; stop_reason_code?: string }) {
        // Emit the completion event for runs we started (snapshot present). Reasons other
        // than a BE-reported one mean the user pressed Stop. Captured before the state is
        // cleared below; `active_run_analytics` is nulled to guard against a double-fire.
        if (this.active_run_analytics && this.active_run_id) {
            trackStrategySessionCompleted({
                ...this.active_run_analytics,
                session_id: this.active_run_id,
                // Outcome — read from the final run state before it's cleared below.
                trades_completed: this.contracts_count,
                cumulative_pnl: this.net_profit,
                status: completion?.status ?? 'stopped',
                stop_reason: completion?.stop_reason ?? 'user_stopped',
                stop_reason_code: completion?.stop_reason_code,
            });
        }
        this.run_status = 'stopped';
        this.active_run_id = null;
        this.active_run = null;
        this.active_run_analytics = null;
    }

    // Recovers stale run state when the `auto_get` subscription missed the
    // stop event. Surfaces the stop_reason if matched, then resets.
    recoverStoppedRun(stopped_run?: TAutoRun) {
        if (
            stopped_run &&
            (stopped_run.stop_reason === 'condition_triggered' || stopped_run.stop_reason === 'error') &&
            stopped_run.stop_reason_code
        ) {
            this.last_stop_event = {
                run_id: stopped_run.run_id,
                stop_reason: stopped_run.stop_reason,
                code: stopped_run.stop_reason_code,
            };
        }
        this.onRunStopped({
            status: stopped_run?.status,
            stop_reason: stopped_run?.stop_reason,
            stop_reason_code: stopped_run?.stop_reason_code,
        });
    }

    setStrategies(strategies: TAutoStrategyDescriptor[]) {
        this.available_strategies = strategies;
    }

    setError(error: { code: string; message: string }) {
        this.last_error = error;
    }

    resetError() {
        this.last_error = null;
    }

    /**
     * Marks `last_stop_event` as delivered so it is announced exactly once.
     *
     * The consumer (`AutomationStopSnackbar`) unmounts whenever the trader module
     * does — e.g. a round trip to Reports — while this store is a module-level
     * singleton that outlives it. A component-local "already shown" ref therefore
     * cannot dedupe across remounts, and the same stop was re-announced on every
     * return. Exactly-once delivery has to be owned here.
     */
    acknowledgeStopEvent() {
        this.last_stop_event = null;
    }

    /**
     * Returns the strategy_parameters for auto_start.
     *
     * Filters out:
     *   - empty / undefined values
     *   - keys that don't belong to the selected strategy's schema
     *
     * The store's `config.strategy_params` retains defaults for every known
     * parameter across all strategies (e.g. both `multiplier` for Martingale
     * and `unit` for D'Alembert), so without this filter Martingale would
     * send a stray `unit` and D'Alembert would send a stray `multiplier`.
     */
    buildStrategyParameters(): Record<string, string> {
        const strategy = this.getSelectedStrategy();
        const allowed_keys = strategy?.parameters?.properties
            ? new Set(Object.keys(strategy.parameters.properties))
            : null;

        return Object.entries(this.config.strategy_params).reduce<Record<string, string>>((params, [key, value]) => {
            if (value === '' || value === undefined) return params;
            if (allowed_keys && !allowed_keys.has(key)) return params;
            params[key] = value;
            return params;
        }, {});
    }

    /**
     * Validates that all required strategy parameters are filled in.
     * Returns an error message or null if valid.
     */
    validateStrategyParams(): string | null {
        const strategy = this.getSelectedStrategy();
        if (!strategy) return null;

        const required = strategy.parameters.required ?? [];
        const missing = required.find(key => {
            const value = this.config.strategy_params[key];
            return !value || value.trim() === '';
        });

        if (missing) {
            const label = strategy.parameters.properties[missing]?.description ?? missing;
            return localize('{{label}} is required', { label });
        }

        return null;
    }

    /**
     * Validates that the current contract type is supported by the selected strategy.
     */
    validateContractTypeSupport(contract_type: string): string | null {
        const strategy = this.getSelectedStrategy();
        if (!strategy) return null;

        if (!strategy.supported_contract_types.includes(contract_type)) {
            return localize('{{strategy_name}} does not support this trade type', {
                strategy_name: strategy.display_name,
            });
        }
        return null;
    }

    resetRunState() {
        this.active_run = null;
        this.active_run_id = null;
        this.run_status = 'idle';
        this.last_error = null;
        this.last_stop_event = null;
        this.active_run_analytics = null;
    }

    /** Full reset including user config — used on logout. */
    reset() {
        this.config = { ...DEFAULT_AUTOMATION_CONFIG };
        this.run_by_loginid.clear();
        this.resetRunState();
    }
}
