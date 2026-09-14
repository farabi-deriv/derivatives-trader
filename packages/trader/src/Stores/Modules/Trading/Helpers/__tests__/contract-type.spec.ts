import { dayjs, toMoment, WS } from '@deriv/shared';
import { mockStore } from '@deriv/stores';

import { ContractType } from '../contract-type';

import ServerTime from '_common/base/server_time';

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    WS: {
        contractsFor: jest.fn(() =>
            Promise.resolve({
                contracts_for: {
                    available: [
                        {
                            barriers: 0,
                            contract_category: 'callput',
                            contract_category_display: 'Up/Down',
                            contract_display: 'Higher',
                            contract_type: 'CALL',
                            exchange_name: 'FOREX',
                            expiry_type: 'daily',
                            market: 'forex',
                            max_contract_duration: '365d',
                            min_contract_duration: '1d',
                            sentiment: 'up',
                            start_type: 'spot',
                            submarket: 'major_pairs',
                            underlying_symbol: 'frxAUDJPY',
                        },
                        {
                            barriers: 2,
                            contract_category: 'touchnotouch',
                            contract_category_display: 'Touch/No Touch',
                            contract_display: 'Touch',
                            contract_type: 'ONETOUCH',
                            exchange_name: 'FOREX',
                            expiry_type: 'daily',
                            forward_starting_options: [
                                {
                                    close: '1701302399',
                                    date: '1701216000',
                                    open: '1701216000',
                                },
                                {
                                    close: '1701388799',
                                    date: '1701302400',
                                    open: '1701302400',
                                },
                                {
                                    close: '1701475199',
                                    date: '1701388800',
                                    open: '1701388800',
                                },
                            ],
                            high_barrier: '98.745',
                            low_barrier: '97.672',
                            market: 'forex',
                            max_contract_duration: '365d',
                            min_contract_duration: '1d',
                            sentiment: 'high_vol',
                            start_type: 'spot',
                            submarket: 'major_pairs',
                            underlying_symbol: 'frxAUDJPY',
                        },
                        {
                            barriers: 0,
                            contract_category: 'callputequal',
                            contract_category_display: 'Rise/Fall Equal',
                            contract_display: 'Higher',
                            contract_type: 'CALLE',
                            default_stake: 10,
                            exchange_name: 'FOREX',
                            expiry_type: 'daily',
                            market: 'forex',
                            max_contract_duration: '365d',
                            min_contract_duration: '1d',
                            sentiment: 'up',
                            start_type: 'spot',
                            submarket: 'major_pairs',
                            underlying_symbol: 'frxAUDJPY',
                        },
                        {
                            barrier: '+1.50',
                            barriers: 1,
                            contract_category: 'vanilla',
                            contract_type: 'VANILLALONGCALL',
                            expiry_type: 'intraday',
                            market: 'forex',
                            max_contract_duration: '1d',
                            min_contract_duration: '1m',
                            sentiment: 'up',
                            start_type: 'spot',
                            submarket: 'major_pairs',
                            underlying_symbol: 'frxAUDJPY',
                        },
                        {
                            barrier: '101.389',
                            barriers: 1,
                            contract_category: 'callput',
                            contract_category_display: 'Up/Down',
                            contract_display: 'Higher',
                            contract_type: 'CALL',
                            default_stake: 10,
                            exchange_name: 'FOREX',
                            expiry_type: 'daily',
                            market: 'forex',
                            max_contract_duration: '365d',
                            min_contract_duration: '1d',
                            sentiment: 'up',
                            start_type: 'spot',
                            submarket: 'major_pairs',
                            underlying_symbol: 'frxAUDJPY',
                        },
                    ],
                    close: 1701215999,
                    feed_license: 'realtime',
                    hit_count: 22,
                    non_available: [
                        {
                            contract_category: 'accumulator',
                            contract_display_name: 'Accumulator Up',
                            contract_type: 'ACCU',
                        },
                        {
                            contract_category: 'asian',
                            contract_display_name: 'Asian Down',
                            contract_type: 'ASIAND',
                        },
                    ],
                    open: 1701129600,
                    spot: 98.076,
                },
            })
        ),
        tradingTimes: jest.fn(() =>
            Promise.resolve({
                trading_times: {
                    markets: [
                        {
                            name: 'Forex',
                            submarkets: [
                                {
                                    name: 'Major Pairs',
                                    symbols: [
                                        {
                                            events: [
                                                {
                                                    dates: 'Fridays',
                                                    descrip: 'Closes early (at 20:55)',
                                                },
                                                {
                                                    dates: '2023-12-25',
                                                    descrip: 'Christmas Day',
                                                },
                                                {
                                                    dates: '2024-01-01',
                                                    descrip: "New Year's Day",
                                                },
                                            ],
                                            name: 'AUD/JPY',
                                            underlying_symbol: 'frxAUDJPY',
                                            times: {
                                                close: ['23:59:59'],
                                                open: ['00:00:00'],
                                                settlement: '23:59:59',
                                            },
                                            trading_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                                        },
                                    ],
                                },
                                {
                                    name: 'Minor Pairs',
                                    symbols: [
                                        {
                                            events: [
                                                {
                                                    dates: 'Fridays',
                                                    descrip: 'Closes early (at 20:55)',
                                                },
                                                {
                                                    dates: '2023-12-25',
                                                    descrip: 'Christmas Day',
                                                },
                                                {
                                                    dates: '2024-01-01',
                                                    descrip: "New Year's Day",
                                                },
                                            ],
                                            name: 'AUD/AED',
                                            underlying_symbol: 'frxAUDAED',
                                            times: {
                                                close: ['23:59:59'],
                                                open: ['00:00:00'],
                                                settlement: '23:59:59',
                                            },
                                            trading_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
                echo_req: {
                    trading_times: '2023-12-01',
                },
            })
        ),
    },
}));

jest.mock('_common/base/server_time', () => ({
    get: jest.fn(() => ({
        isBefore: jest.fn(),
        clone: jest.fn(),
        get: jest.fn(),
        format: jest.fn(() => '12:00'),
        hour: jest.fn(),
        minute: jest.fn(),
        add: jest.fn(),
        subtract: jest.fn(),
        diff: jest.fn(),
        isSameOrBefore: jest.fn(),
    })),
}));

const server_time_get_spy = jest.spyOn(ServerTime, 'get');

describe('ContractType Helper Functions', () => {
    beforeEach(async () => {
        // Build contract types config before each test
        await ContractType.buildContractTypesConfig('frxAUDJPY');
    });

    describe('getBarriers', () => {
        it('should return barriers based on contract type and expiry type', () => {
            const result = ContractType.getBarriers('frxAUDJPY', 'touch', 'daily', undefined);

            expect(result.barrier_count).toBe(2);
            expect(result.barrier_1).toBe('98.745');
            expect(result.barrier_2).toBe('97.672');
        });

        it('should use stored barrier value when provided', () => {
            const stored_barrier = '100.000';
            const result = ContractType.getBarriers('frxAUDJPY', 'touch', 'daily', stored_barrier);

            expect(result.barrier_count).toBe(2);
            expect(result.barrier_1).toBe(stored_barrier);
            expect(result.barrier_2).toBe('97.672');
        });

        it('should return empty barriers for contract types without barriers', () => {
            const result = ContractType.getBarriers('frxAUDJPY', 'unknown_type', 'daily', undefined);

            expect(result.barrier_count).toBe(0);
            expect(result.barrier_1).toBe('');
            expect(result.barrier_2).toBe('');
        });
    });

    describe('getContractType', () => {
        it('should return contract_type object from available contract types', () => {
            const list = {
                'Ups & Downs': {
                    name: 'Ups & Downs',
                    categories: [
                        {
                            value: 'rise_fall',
                            text: 'Rise/Fall',
                        },
                        {
                            value: 'rise_fall_equal',
                            text: 'Rise/Fall',
                        },
                    ],
                },
                'Touch & No Touch': {
                    name: 'Touch & No Touch',
                    categories: [
                        {
                            value: 'high_low',
                            text: 'Higher/Lower',
                        },
                        {
                            value: 'touch',
                            text: 'Touch/No Touch',
                        },
                    ],
                },
            };

            const result = ContractType.getContractType(list, 'high_low');
            expect(result).toEqual({ contract_type: 'high_low' });
        });

        it('should return first available contract type when requested type is not found', () => {
            const list = {
                'Ups & Downs': {
                    name: 'Ups & Downs',
                    categories: [
                        {
                            value: 'rise_fall',
                            text: 'Rise/Fall',
                        },
                    ],
                },
            };

            const result = ContractType.getContractType(list, 'non_existent_type');
            expect(result.contract_type).toBe('rise_fall');
        });
    });

    describe('getContractValues', () => {
        let trade_store = mockStore({}).modules.trade;

        beforeEach(() => {
            trade_store = {
                ...mockStore({}).modules.trade,
                symbol: 'frxAUDJPY', // config is loaded for this symbol; lookups resolve per symbol

                contract_type: 'rise_fall',
                basis: 'stake',
                duration_unit: 'm',
                expiry_type: 'duration',
                multiplier: 100,
                start_date: 0,
                cancellation_duration: '60m',
            };
        });

        it('should return empty object if contract_type is null', () => {
            trade_store.contract_type = null;
            const result = ContractType.getContractValues(trade_store);
            expect(result).toEqual({});
        });

        it("derives the barrier from the incoming type's expiry bucket, not the stale one", () => {
            // Mid-switch the store's computed bucket still reflects the outgoing tab's duration
            // fields. Reading it here returned '' for a valid pair, which rapid switching could
            // price as a barrier-less request before the correct cascade repaired it.
            const result = ContractType.getContractValues({
                ...trade_store,
                contract_type: 'touch', // daily bucket only in the fixture (barriers 98.745/97.672)
                contract_expiry_type: 'tick', // stale: left behind by a tick tab
                duration_unit: 'd',
                expiry_type: 'duration',
                root_store: { common: { server_time: toMoment('2026-09-01T12:00:00Z') } },
            } as unknown as Parameters<typeof ContractType.getContractValues>[0]);

            expect((result as { barrier_count?: number }).barrier_count).toBe(2);
            expect((result as { barrier_1?: string }).barrier_1).toBe('98.745');
        });

        it('derives daily from a stale intraday duration_unit, not just a stale bucket', () => {
            const result = ContractType.getContractValues({
                ...trade_store,
                contract_type: 'touch',
                contract_expiry_type: 'intraday',
                duration_unit: 'm', // stale: the outgoing intraday tab's unit
                expiry_type: 'duration',
                root_store: { common: { server_time: toMoment('2026-09-01T12:00:00Z') } },
            } as unknown as Parameters<typeof ContractType.getContractValues>[0]);

            expect((result as { barrier_1?: string }).barrier_1).toBe('98.745');
        });

        it('never blanks an existing barrier when the resolved bucket offers none', () => {
            // Without server_time the bucket re-derivation is skipped and the stale 'tick' bucket
            // survives; 'touch' offers no tick barriers. The old shape returned barrier_1: '' next to
            // barrier_count: 2 — the blank the proposal then priced. Now the keys are dropped so the
            // store's existing value is left alone.
            const result = ContractType.getContractValues({
                ...trade_store,
                contract_type: 'touch',
                contract_expiry_type: 'tick',
                duration_unit: 'd',
                expiry_type: 'duration',
                root_store: undefined,
            } as unknown as Parameters<typeof ContractType.getContractValues>[0]);

            expect((result as { barrier_count?: number }).barrier_count).toBe(2);
            expect(result).not.toHaveProperty('barrier_1');
        });

        it("derives nothing for a contract type the symbol's catalogue does not offer", () => {
            // Mid tab-switch the store briefly pairs the new symbol with the outgoing contract_type.
            // Deriving from that mismatch blanked barrier_1, and rapid switching could price the
            // empty field (the last_digit fallback then sent 5) before the correct pair repaired it.
            const result = ContractType.getContractValues({
                ...trade_store,
                contract_type: 'accumulator', // not in the frxAUDJPY fixture
            });

            expect(result).toEqual({});
        });

        it('should return contract values for valid contract type', () => {
            const result = ContractType.getContractValues(trade_store);

            expect(result).toHaveProperty('form_components');
            expect(result).toHaveProperty('basis_list');
            expect(result).toHaveProperty('basis');
            expect(result).toHaveProperty('trade_types');
            expect(result).toHaveProperty('barrier_count');
            expect(result).toHaveProperty('duration_unit');
            expect(result).toHaveProperty('duration_units_list');
            expect(result).toHaveProperty('duration_min_max');
            expect(result).toHaveProperty('expiry_type');
        });

        it('should use strike value from v2_params_initial_values for Vanillas on mobile', () => {
            trade_store.contract_type = 'vanillalongcall';
            trade_store.v2_params_initial_values = { strike: '+1.80' };
            trade_store.root_store = { ui: { is_mobile: true } };

            const result = ContractType.getContractValues(trade_store);

            expect(result.barrier_1).toBe('+1.80');
        });

        it('should not use strike value for non-mobile or non-vanilla contracts', () => {
            trade_store.contract_type = 'rise_fall';
            trade_store.v2_params_initial_values = { strike: '+1.80' };
            trade_store.root_store = { ui: { is_mobile: false } };

            const result = ContractType.getContractValues(trade_store);

            expect(result.barrier_1).not.toBe('+1.80');
        });
    });

    describe('getDurationMinMax', () => {
        it('should return empty duration_min_max when contract_expiry_type is provided', () => {
            const result = ContractType.getDurationMinMax('frxAUDJPY', 'touch', 'daily');
            expect(result).toEqual({ duration_min_max: {} });
        });

        it('should return duration_min_max from config when no contract_expiry_type', () => {
            const result = ContractType.getDurationMinMax('frxAUDJPY', 'touch');
            // Returns whatever is in the config, which may be empty for this contract type
            expect(result).toHaveProperty('duration_min_max');
            expect(typeof result.duration_min_max).toBe('object');
        });

        it('should return empty object for unknown contract types', () => {
            const result = ContractType.getDurationMinMax('frxAUDJPY', 'unknown_contract');
            expect(result).toEqual({ duration_min_max: {} });
        });
    });

    describe('getDurationUnit', () => {
        it('should return requested duration_unit for non-vanilla contracts', () => {
            const result = ContractType.getDurationUnit('frxAUDJPY', 'h', 'multiplier');
            expect(result.duration_unit).toBe('h');
        });

        it('should validate duration_unit for vanilla contracts', () => {
            // For vanilla contracts, it checks if the duration_unit is available
            const result = ContractType.getDurationUnit('frxAUDJPY', 'd', 'rise_fall');
            expect(result.duration_unit).toBe('d');
        });

        it('should return available duration_unit for vanilla contracts when valid', () => {
            // If the vanilla contract has the requested unit available, it should return it
            const result = ContractType.getDurationUnit('frxAUDJPY', 'm', 'rise_fall');
            expect(result.duration_unit).toBe('m');
        });

        it('should handle edge cases gracefully', () => {
            // Test with null/undefined contract types
            const nullResult = ContractType.getDurationUnit('frxAUDJPY', 'd', null as any);
            expect(nullResult.duration_unit).toBe('d');

            const undefinedResult = ContractType.getDurationUnit('frxAUDJPY', 'd', undefined as any);
            expect(undefinedResult.duration_unit).toBe('d');

            // Test with empty string
            const emptyResult = ContractType.getDurationUnit('frxAUDJPY', 'd', '');
            expect(emptyResult.duration_unit).toBe('d');
        });

        it('should handle case sensitivity correctly', () => {
            // Vanilla contract types are case-sensitive
            const result = ContractType.getDurationUnit('frxAUDJPY', 'd', 'RISE_FALL');
            expect(result.duration_unit).toBe('d'); // Not recognized as vanilla, returns input
        });
    });

    describe('getDurationUnitsList', () => {
        it('should return duration units list for valid contract type', () => {
            const result = ContractType.getDurationUnitsList('frxAUDJPY', 'touch');
            expect(result).toHaveProperty('duration_units_list');
            expect(Array.isArray(result.duration_units_list)).toBe(true);
        });

        it('should return empty array for unknown contract types', () => {
            const result = ContractType.getDurationUnitsList('frxAUDJPY', 'unknown_contract');
            expect(result.duration_units_list).toEqual([]);
        });
    });

    describe('getFullContractTypes', () => {
        it('should return available contract types object', () => {
            const result = ContractType.getFullContractTypes('frxAUDJPY');
            expect(typeof result).toBe('object');
            expect(result).not.toEqual({});
        });
    });

    describe('getExpiryDate', () => {
        it('keeps a same-day end date when the catalogue is not loaded yet', () => {
            // Empty units = contracts_for not cached (first cascade after reload). Treating that as
            // daily-only advanced a restored same-day end date to tomorrow on every refresh.
            const today = new Date().toISOString().split('T')[0];
            const result = ContractType.getExpiryDate([], today, 'endtime', 0);
            expect(result.expiry_date).toBe(today);
        });

        const duration_units_list = [
            { text: 'Minutes', value: 'm' },
            { text: 'Hours', value: 'h' },
            { text: 'Days', value: 'd' },
        ];

        it('should return null for non-endtime expiry types', () => {
            const result = ContractType.getExpiryDate(duration_units_list, '2023-11-30', 'duration', 0);
            expect(result.expiry_date).toBe(null);
        });

        it('should return proper expiry date for endtime expiry type', () => {
            const start_date = dayjs('2023-12-01T11:00:00').unix();
            const result = ContractType.getExpiryDate(duration_units_list, '2023-12-01', 'endtime', start_date);
            expect(result.expiry_date).toBe('2023-12-01');
        });

        it('should handle intraday duration units correctly', () => {
            const start_date = dayjs('2023-12-01T11:00:00').unix();
            const result = ContractType.getExpiryDate(duration_units_list, '2023-12-01', 'endtime', start_date);
            // With intraday units, it should return the expiry date as-is
            expect(result.expiry_date).toBe('2023-12-01');
        });

        it('should handle non-intraday duration units correctly', () => {
            const duration_units_list_daily = [{ text: 'Days', value: 'd' }];
            const start_date = dayjs('2023-12-01T11:00:00').unix();
            const result = ContractType.getExpiryDate(duration_units_list_daily, '2022-11-30', 'endtime', start_date);
            // Without intraday units, invalid dates get adjusted to start_date + 1 day
            expect(result.expiry_date).toBe('2023-12-02');
        });
    });

    describe('getExpiryTime', () => {
        beforeEach(() => {
            (server_time_get_spy as jest.Mock).mockReturnValue({
                isBefore: jest.fn(() => false),
                clone: jest.fn(() => ({
                    add: jest.fn(() => ({
                        format: jest.fn(() => '12:05'),
                    })),
                    subtract: jest.fn(),
                })),
                get: jest.fn(() => 12),
                format: jest.fn(() => '12:00'),
                hour: jest.fn(),
                minute: jest.fn(),
                diff: jest.fn(() => 10),
                isSameOrBefore: jest.fn(() => false),
            });
        });

        it('should return null if expiry_type is not endtime', () => {
            const result = ContractType.getExpiryTime(null, '21:00:00', 'duration', undefined, 0, null);
            expect(result.expiry_time).toBe(null);
        });

        it('should return market close time when available', () => {
            (server_time_get_spy as jest.Mock).mockReturnValue({
                isBefore: jest.fn(() => true),
            });

            const result = ContractType.getExpiryTime('2023-12-14', '21:00:00', 'endtime', ['21:00:00'], 0, null);
            expect(result.expiry_time).toBe('21:00:00');
        });

        it('should calculate proper expiry time based on start time', () => {
            const mockMoment = {
                isBefore: jest.fn(() => true),
                clone: jest.fn(() => ({
                    add: jest.fn(() => ({
                        format: jest.fn(() => '12:05'),
                    })),
                })),
                format: jest.fn(() => '12:00'),
                diff: jest.fn(() => 10),
                isSameOrBefore: jest.fn(() => false),
                get: jest.fn(() => 12),
            };
            (server_time_get_spy as jest.Mock).mockReturnValue(mockMoment);

            const result = ContractType.getExpiryTime(null, '21:00:00', 'endtime', undefined, 1701388800, '03:03');

            // The function should return a calculated time
            expect(typeof result.expiry_time).toBe('string');
        });

        describe('same-day 5-minute rounding window', () => {
            // start_date=0 so the branch reads `ServerTime.get()` directly as "now"; expiry_date is
            // the same day so the future-day branch (:620) is skipped and the same-day clamp runs.
            it('[DCE-005] does not roll a 23:56 clamp into the next day', () => {
                (server_time_get_spy as jest.Mock).mockReturnValue(dayjs.utc('2024-06-10T23:56:00Z'));

                const result = ContractType.getExpiryTime('2024-06-10', null, 'endtime', undefined, 0, null);

                expect(result.expiry_time).toBe('23:56');
            });

            it('[DCE-005] does not roll a 23:58 clamp into the next day', () => {
                (server_time_get_spy as jest.Mock).mockReturnValue(dayjs.utc('2024-06-10T23:58:00Z'));

                const result = ContractType.getExpiryTime('2024-06-10', null, 'endtime', undefined, 0, null);

                expect(result.expiry_time).toBe('23:58');
            });

            // Below the is_end_of_day threshold (minute < 55) the 5-minute add still runs, and
            // rounding *that* up can independently overflow to `.minute(60)` — e.g. 23:51 + 5 =
            // 23:56, which rounds up to "23:60". Clamp to 23:59 rather than roll into the next day.
            it('[DCE-005] clamps a 23:51 clamp to the end of the day instead of rolling over', () => {
                (server_time_get_spy as jest.Mock).mockReturnValue(dayjs.utc('2024-06-10T23:51:00Z'));

                const result = ContractType.getExpiryTime('2024-06-10', null, 'endtime', undefined, 0, null);

                expect(result.expiry_time).toBe('23:59');
            });

            it('[DCE-005] clamps a 23:54 clamp to the end of the day instead of rolling over', () => {
                (server_time_get_spy as jest.Mock).mockReturnValue(dayjs.utc('2024-06-10T23:54:00Z'));

                const result = ContractType.getExpiryTime('2024-06-10', null, 'endtime', undefined, 0, null);

                expect(result.expiry_time).toBe('23:59');
            });

            it('[DCE-005] leaves ordinary rounding just below the clamp window unaffected', () => {
                (server_time_get_spy as jest.Mock).mockReturnValue(dayjs.utc('2024-06-10T23:50:00Z'));

                const result = ContractType.getExpiryTime('2024-06-10', null, 'endtime', undefined, 0, null);

                expect(result.expiry_time).toBe('23:55');
            });

            // Characterization: pins the pre-existing (unaffected) rounding behaviour away from
            // end-of-day — this path never went red, it must simply survive the DCE-005 fix.
            it('characterizes ordinary rounding away from end-of-day', () => {
                (server_time_get_spy as jest.Mock).mockReturnValue(dayjs.utc('2024-06-10T14:33:00Z'));

                const result = ContractType.getExpiryTime('2024-06-10', null, 'endtime', undefined, 0, null);

                expect(result.expiry_time).toBe('14:40');
            });
        });
    });

    describe('getStartTime', () => {
        beforeEach(() => {
            (server_time_get_spy as jest.Mock).mockReturnValue({
                hour: jest.fn(() => 12),
                minute: jest.fn(() => 0),
                format: jest.fn(() => '12:00'),
            });
        });

        it('should return null if start_date is 0', () => {
            const result = ContractType.getStartTime(0, '03:03');
            expect(result.start_time).toBe(null);
        });

        it('should return formatted time if start_date is valid', () => {
            const result = ContractType.getStartTime(1701388800, '03:03');
            expect(typeof result.start_time).toBe('string');
            expect(result.start_time).toMatch(/^\d{2}:\d{2}$/);
        });

        it('should handle null start_time gracefully', () => {
            const result = ContractType.getStartTime(1701388800, null);
            expect(typeof result.start_time).toBe('string');
        });
    });

    describe('getTradingEvents', () => {
        it('should return empty array if date is empty', async () => {
            const result = await ContractType.getTradingEvents('', 'frxAUDJPY');
            expect(result).toEqual([]);
        });

        it('should return proper arrays of dates and description if date is not empty', async () => {
            const result = await ContractType.getTradingEvents('2023-12-01', 'frxAUDJPY');
            expect(result).toEqual([
                { dates: 'Fridays', descrip: 'Closes early (at 20:55)' },
                { dates: '2023-12-25', descrip: 'Christmas Day' },
                { dates: '2024-01-01', descrip: "New Year's Day" },
            ]);
        });

        it('should handle null underlying symbol', async () => {
            const result = await ContractType.getTradingEvents('2023-12-01', null);
            expect(Array.isArray(result) || result === undefined).toBe(true);
        });
    });

    describe('getTradingTimes', () => {
        const expected_response = { close: ['23:59:59'], open: ['00:00:00'] };

        it('should return empty object if date is empty', async () => {
            const result = await ContractType.getTradingTimes('', 'frxAUDJPY');
            expect(result).toEqual({});
        });

        it('should return proper trading times for specific symbol', async () => {
            const result = await ContractType.getTradingTimes('2023-12-01', 'frxAUDJPY');
            expect(result).toEqual(expected_response);
        });

        it('should return trading times for all symbols if underlying is empty', async () => {
            const result = await ContractType.getTradingTimes('2023-12-01', '');
            expect(result).toEqual({
                frxAUDAED: expected_response,
                frxAUDJPY: expected_response,
            });
        });

        it('should handle null date', async () => {
            const result = await ContractType.getTradingTimes(null, 'frxAUDJPY');
            expect(result).toEqual({});
        });
    });

    describe('getNextTradingDayDate', () => {
        const mockTradingTimesByDate = (close_by_date: Record<string, string[] | undefined>) => {
            (WS.tradingTimes as jest.Mock).mockImplementation((date: string) =>
                Promise.resolve({
                    trading_times: {
                        markets: [
                            {
                                name: 'Forex',
                                submarkets: [
                                    {
                                        name: 'Major Pairs',
                                        symbols: [
                                            {
                                                underlying_symbol: 'frxUSDJPY',
                                                times: { open: ['00:00:00'], close: close_by_date[date] },
                                                trading_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                    echo_req: { trading_times: date },
                })
            );
        };

        afterEach(() => {
            (WS.tradingTimes as jest.Mock).mockReset();
        });

        it('[DCE-003] steps a Friday seed forward past a closed weekend to Monday', async () => {
            mockTradingTimesByDate({
                '2024-06-08': ['--'],
                '2024-06-09': ['--'],
                '2024-06-10': ['23:59:59'],
            });

            const friday = dayjs('2024-06-07');
            const result = await ContractType.getNextTradingDayDate('frxUSDJPY', friday, false);

            expect(result).toBe('2024-06-10');
        });

        it('[DCE-003] seeds the current server day when the contract has an intraday unit', async () => {
            mockTradingTimesByDate({ '2024-06-11': ['23:59:59'] });

            const tuesday = dayjs('2024-06-11');
            const result = await ContractType.getNextTradingDayDate('frxUSDJPY', tuesday, true);

            expect(result).toBe('2024-06-11');
        });

        it('degrades to the unmodified candidate when trading_times has no data for the date', async () => {
            (WS.tradingTimes as jest.Mock).mockImplementation(() => Promise.resolve({}));

            const wednesday = dayjs('2024-06-12');
            const result = await ContractType.getNextTradingDayDate('frxUSDJPY', wednesday, false);

            expect(result).toBe('2024-06-13');
        });

        it('degrades to the unmodified candidate when the symbol has no close time', async () => {
            mockTradingTimesByDate({ '2024-06-20': undefined });

            const thursday = dayjs('2024-06-19');
            const result = await ContractType.getNextTradingDayDate('frxUSDJPY', thursday, false);

            expect(result).toBe('2024-06-20');
        });
    });

    describe('getExpiryType', () => {
        it('should return duration as expiry type if expiry_type is null and duration_units_list has items', () => {
            const duration_units_list = [
                { text: 'Minutes', value: 'm' },
                { text: 'Hours', value: 'h' },
            ];
            const result = ContractType.getExpiryType(duration_units_list, '');
            expect(result).toEqual({ expiry_type: 'duration' });
        });

        it('should return duration as expiry type if duration_units_list has only ticks', () => {
            const duration_units_list = [{ text: 'Ticks', value: 't' }];
            const result = ContractType.getExpiryType(duration_units_list, 'test');
            expect(result).toEqual({ expiry_type: 'duration' });
        });

        it('keeps the current expiry_type when duration_units_list is empty', () => {
            // An empty list means the catalogue is not loaded yet; nulling here erased a restored
            // 'endtime' on cold load, one cascade before contracts_for arrived.
            const result = ContractType.getExpiryType([], 'endtime');
            expect(result).toEqual({ expiry_type: 'endtime' });
        });

        it('should preserve expiry_type when conditions are not met', () => {
            const duration_units_list = [
                { text: 'Minutes', value: 'm' },
                { text: 'Hours', value: 'h' },
            ];
            const result = ContractType.getExpiryType(duration_units_list, 'endtime');
            expect(result).toEqual({ expiry_type: 'endtime' });
        });
    });

    describe('getContractCategories', () => {
        it('should return non-empty contract categories', () => {
            const result = ContractType.getContractCategories('frxAUDJPY');
            expect(result).toHaveProperty('contract_types_list');
            expect(result).toHaveProperty('non_available_contract_types_list');
            expect(typeof result.contract_types_list).toBe('object');
            expect(typeof result.non_available_contract_types_list).toBe('object');
        });
    });
});
