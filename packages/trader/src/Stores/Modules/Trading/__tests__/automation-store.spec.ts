import type { TAutoContractItem, TAutoRun } from '@deriv/api';
import { mockStore } from '@deriv/stores';

import { TRootStore } from 'Types';

import AutomationStore from '../automation-store';

const makeRun = (overrides: Partial<TAutoRun> = {}): TAutoRun =>
    ({
        run_id: 'run-1',
        strategy_id: 'martingale',
        strategy_parameters: {},
        contract_template: {} as TAutoRun['contract_template'],
        contracts: [],
        total_stake: 0,
        total_payout: 0,
        status: 'running',
        start_time: 1,
        ...overrides,
    }) as TAutoRun;

const A_CONTRACT = {} as TAutoContractItem;

describe('AutomationStore run-status transitions', () => {
    let store: AutomationStore;

    beforeEach(() => {
        const root = mockStore({ client: { loginid: 'ROT1' } }) as unknown as TRootStore;
        store = new AutomationStore({ root_store: root });
    });

    describe('adoptRun (run recovered on account switch / resync)', () => {
        it("marks a running run as 'running' even before contracts arrive", () => {
            // Regression: auto_list may omit contracts, which previously left the
            // adopted run stuck in 'starting'.
            store.adoptRun(makeRun({ status: 'running', contracts: [] }));
            expect(store.run_status).toBe('running');
            expect(store.active_run_id).toBe('run-1');
        });

        it("marks a paused run as 'paused'", () => {
            store.adoptRun(makeRun({ status: 'paused' }));
            expect(store.run_status).toBe('paused');
        });

        it('ignores a non-live (stopped) run instead of marking it running', () => {
            store.adoptRun(makeRun({ status: 'stopped' }));
            expect(store.run_status).toBe('idle'); // unchanged from initial
            expect(store.active_run_id).toBeNull();
        });

        it('does not demote to starting on a later contract-less running update', () => {
            store.adoptRun(makeRun({ status: 'running', contracts: [] }));
            store.onRunUpdate(makeRun({ status: 'running', contracts: [] }));
            expect(store.run_status).toBe('running');
        });
    });

    describe('onRunStarted (run we initiated)', () => {
        it("stays 'starting' until the first contract is observed", () => {
            store.onRunStarted(makeRun({ status: 'running', contracts: [] }));
            expect(store.run_status).toBe('starting');
        });

        it("promotes to 'running' when the start payload already has a contract", () => {
            store.onRunStarted(makeRun({ contracts: [A_CONTRACT] }));
            expect(store.run_status).toBe('running');
        });
    });

    describe('adoptRun contract preservation (no 0 flash on re-adopt)', () => {
        // net_profit sums (sell_price - buy_price) over settled contracts: 2 + -1 = 1.
        const CONTRACTS = [
            { buy_price: 10, sell_price: 12 },
            { buy_price: 10, sell_price: 9 },
        ] as TAutoContractItem[];

        it('uses the incoming contracts when the payload has them', () => {
            store.adoptRun(makeRun({ contracts: CONTRACTS }));
            expect(store.contracts_count).toBe(2);
            expect(store.net_profit).toBe(1);
        });

        it('keeps contracts across a lean re-adopt via the cached run (reconnect)', () => {
            store.adoptRun(makeRun({ contracts: [] }));
            store.onRunUpdate(makeRun({ contracts: CONTRACTS })); // auto_get fills + caches
            expect(store.contracts_count).toBe(2);
            store.adoptRun(makeRun({ contracts: [] })); // lean re-adopt on reconnect
            expect(store.contracts_count).toBe(2);
            expect(store.net_profit).toBe(1);
        });

        it('restores contracts from the per-account cache (account switch)', () => {
            (store as unknown as { run_by_loginid: Map<string, TAutoRun> }).run_by_loginid.set(
                'ROT1',
                makeRun({ contracts: CONTRACTS })
            );
            store.adoptRun(makeRun({ contracts: [] }));
            expect(store.contracts_count).toBe(2);
        });

        it('does not carry stale contracts across to a different run', () => {
            (store as unknown as { run_by_loginid: Map<string, TAutoRun> }).run_by_loginid.set(
                'ROT1',
                makeRun({ run_id: 'run-old', contracts: CONTRACTS })
            );
            store.adoptRun(makeRun({ run_id: 'run-new', contracts: [] }));
            expect(store.contracts_count).toBe(0);
        });
    });
});

describe('AutomationStore stop-event delivery', () => {
    let store: AutomationStore;

    const stopRun = (overrides: Partial<TAutoRun> = {}) =>
        makeRun({
            status: 'stopped',
            stop_reason: 'condition_triggered',
            stop_reason_code: 'StopLoss',
            ...overrides,
        } as Partial<TAutoRun>);

    beforeEach(() => {
        const root = mockStore({ client: { loginid: 'CR1' } }) as unknown as TRootStore;
        store = new AutomationStore({ root_store: root });
    });

    it('records a stop event when a run stops on a triggered condition', () => {
        store.onRunStarted(makeRun());
        store.onRunUpdate(stopRun());

        expect(store.last_stop_event).toEqual({
            run_id: 'run-1',
            stop_reason: 'condition_triggered',
            code: 'StopLoss',
        });
    });

    it('acknowledgeStopEvent clears the event without touching the rest of the run state', () => {
        store.onRunStarted(makeRun());
        store.onRunUpdate(stopRun());
        const { run_status, active_run_id } = store;

        store.acknowledgeStopEvent();

        expect(store.last_stop_event).toBeNull();
        expect(store.run_status).toBe(run_status);
        expect(store.active_run_id).toBe(active_run_id);
    });

    it('does not re-raise an acknowledged stop event', () => {
        // Regression (#893): the snackbar consumer unmounts with the trader module
        // on a Reports round trip while this store survives, so an unacknowledged
        // event was re-announced on every return.
        store.onRunStarted(makeRun());
        store.onRunUpdate(stopRun());
        store.acknowledgeStopEvent();

        store.onRunUpdate(stopRun());

        expect(store.last_stop_event).toBeNull();
    });

    it('clears a pending stop event when a new run starts', () => {
        store.onRunStarted(makeRun());
        store.onRunUpdate(stopRun());

        store.onRunStarted(makeRun({ run_id: 'run-2' }));

        expect(store.last_stop_event).toBeNull();
    });
});

describe('AutomationStore buildStrategyParameters', () => {
    let store: AutomationStore;

    // Mirrors auto_list_strategies: `multiplier` is declared `number`, everything
    // else the UI edits is `string`.
    const martingale = {
        strategy_id: 'martingale',
        display_name: 'Martingale',
        supported_contract_types: ['CALL'],
        parameters: {
            type: 'object',
            properties: {
                initial_stake: { type: 'string' },
                multiplier: { type: 'number', exclusiveMinimum: 1, maximum: 10 },
                take_profit: { type: 'string' },
                stop_loss: { type: 'string' },
                max_stake: { type: 'string' },
                max_contracts: { type: 'integer' },
            },
            required: [],
        },
    } as unknown as Parameters<AutomationStore['setStrategies']>[0][number];

    beforeEach(() => {
        const root = mockStore({ client: { loginid: 'ROT1' } }) as unknown as TRootStore;
        store = new AutomationStore({ root_store: root });
        store.setStrategies([martingale]);
        store.setConfig('strategy', 'martingale');
    });

    it('emits a schema `number` parameter as a number, not a string', () => {
        store.setStrategyParam('multiplier', '2.5');
        expect(store.buildStrategyParameters().multiplier).toBe(2.5);
    });

    it('emits a schema `integer` parameter as a number', () => {
        store.setStrategyParam('max_contracts', '10');
        expect(store.buildStrategyParameters().max_contracts).toBe(10);
    });

    it('leaves schema `string` parameters as strings', () => {
        store.setStrategyParam('initial_stake', '1.00');
        store.setStrategyParam('take_profit', '10');
        const params = store.buildStrategyParameters();
        expect(params.initial_stake).toBe('1.00');
        expect(params.take_profit).toBe('10');
    });

    it('passes an unparseable numeric value through untouched for the server to reject', () => {
        store.setStrategyParam('multiplier', 'abc');
        expect(store.buildStrategyParameters().multiplier).toBe('abc');
    });

    it('still drops empty values and keys outside the strategy schema', () => {
        store.setStrategyParam('multiplier', '2');
        store.setStrategyParam('max_stake', '');
        store.setStrategyParam('unit', '3');
        const params = store.buildStrategyParameters();
        expect(params).not.toHaveProperty('max_stake');
        expect(params).not.toHaveProperty('unit');
        expect(params.multiplier).toBe(2);
    });
});
