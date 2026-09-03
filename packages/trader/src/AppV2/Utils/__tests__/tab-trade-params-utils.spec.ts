import {
    getMarketKey,
    pickTabTradeParams,
    pruneTabTradeParams,
    readTabTradeParams,
    TAB_TRADE_PARAMS_STORAGE_KEYS,
    type TTabTradeParamsMap,
    writeTabTradeParams,
} from '../tab-trade-params-utils';

const rise = { symbol: 'frxEURUSD', contract_type: 'rise_fall' };
const high_low = { symbol: 'frxEURUSD', contract_type: 'high_low' };

describe('tab-trade-params-utils', () => {
    beforeEach(() => sessionStorage.clear());

    it('getMarketKey distinguishes the same symbol under two trade types', () => {
        expect(getMarketKey(rise)).toBe('frxEURUSD|rise_fall');
        expect(getMarketKey(high_low)).toBe('frxEURUSD|high_low');
        expect(getMarketKey(rise)).not.toBe(getMarketKey(high_low));
    });

    it("read/write round-trips a mode's params through sessionStorage", () => {
        const map: TTabTradeParamsMap = {
            [getMarketKey(rise)]: { amount: 25, duration: 8, duration_unit: 't' },
            [getMarketKey(high_low)]: { amount: 10, barrier_1: '+0.1' },
        };
        writeTabTradeParams('manual', map);

        expect(readTabTradeParams('manual')).toEqual(map);
    });

    it('readTabTradeParams degrades to {} when storage access throws (blocked storage)', () => {
        // Safari "Block all cookies" / sandboxed iframes make getItem THROW rather than return
        // null — and this read runs in a TradeStore field initialiser, so it must never propagate.
        const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('SecurityError: The operation is insecure.');
        });

        expect(readTabTradeParams('manual')).toEqual({});

        spy.mockRestore();
    });

    it('readTabTradeParams yields {} for missing, non-JSON, non-object and array payloads', () => {
        expect(readTabTradeParams('manual')).toEqual({});

        ['not-json', JSON.stringify(null), JSON.stringify('a string'), JSON.stringify([rise])].forEach(payload => {
            sessionStorage.setItem(TAB_TRADE_PARAMS_STORAGE_KEYS.manual, payload);
            expect(readTabTradeParams('manual')).toEqual({});
        });
    });

    it('readTabTradeParams drops an End Time tuple missing its date or picker seed, as a unit', () => {
        // A missing date — or an EMPTY picker seed, the store's absent-value sentinel for
        // saved_expiry_date_v2 — reconstructs the picker/date desync the whitelist exists to
        // prevent. The whole selection degrades to "nothing saved" while unrelated keys survive.
        const partial_tuples = [
            { expiry_type: 'endtime', saved_expiry_date_v2: '2024-02-27' }, // no date
            { expiry_type: 'endtime', expiry_date: '2024-02-27' }, // no picker seed
            { expiry_type: 'endtime', expiry_date: '2024-02-27', saved_expiry_date_v2: '' }, // empty seed
        ];
        partial_tuples.forEach(tuple => {
            sessionStorage.setItem(
                TAB_TRADE_PARAMS_STORAGE_KEYS.manual,
                JSON.stringify({ [getMarketKey(rise)]: { amount: 25, ...tuple } })
            );

            expect(readTabTradeParams('manual')).toEqual({ [getMarketKey(rise)]: { amount: 25 } });
        });
    });

    it('readTabTradeParams keeps a complete End Time tuple — including a null expiry_time', () => {
        // expiry_time null is legitimate: a Days tab's auto-seeded 23:59:59 end time never sets a
        // time, so a blanket null check here silently threw away valid End Time selections.
        const entries = [
            {
                amount: 25,
                expiry_type: 'endtime',
                expiry_date: '2024-02-27',
                expiry_time: '23:59',
                saved_expiry_date_v2: '2024-02-27',
            },
            {
                amount: 25,
                expiry_type: 'endtime',
                expiry_date: '2024-02-27',
                expiry_time: null,
                saved_expiry_date_v2: '2024-02-27',
            },
        ];
        entries.forEach(entry => {
            sessionStorage.setItem(
                TAB_TRADE_PARAMS_STORAGE_KEYS.manual,
                JSON.stringify({ [getMarketKey(rise)]: entry })
            );

            expect(readTabTradeParams('manual')).toEqual({ [getMarketKey(rise)]: entry });
        });
    });

    it('readTabTradeParams drops malformed entries and keeps well-formed ones', () => {
        sessionStorage.setItem(
            TAB_TRADE_PARAMS_STORAGE_KEYS.manual,
            JSON.stringify({
                [getMarketKey(rise)]: { amount: 25 },
                'frxGBPUSD|rise_fall': 'not-an-object',
                'frxUSDJPY|rise_fall': null,
                'frxAUDUSD|rise_fall': [1, 2, 3],
            })
        );

        expect(readTabTradeParams('manual')).toEqual({ [getMarketKey(rise)]: { amount: 25 } });
    });

    it('readTabTradeParams drops keys outside the whitelist and values of the wrong type', () => {
        sessionStorage.setItem(
            TAB_TRADE_PARAMS_STORAGE_KEYS.manual,
            JSON.stringify({
                [getMarketKey(rise)]: {
                    amount: 25,
                    // Not tab-scoped — account/layout/derived state must never come back from here.
                    currency: 'BTC',
                    is_trade_params_expanded: false,
                    contract_expiry_type: 'daily',
                    // Wrong types for whitelisted keys.
                    duration: '8',
                    has_take_profit: 'yes',
                    short_barriers: [],
                    duration_unit: null,
                },
            })
        );

        expect(readTabTradeParams('manual')).toEqual({ [getMarketKey(rise)]: { amount: 25 } });
    });

    // The stake action sheet commits its raw input, so a stake the user typed is stored as a STRING.
    // A number-only check silently dropped it, which lost the stake on every refresh.
    it('readTabTradeParams keeps a stake stored as a numeric string', () => {
        sessionStorage.setItem(
            TAB_TRADE_PARAMS_STORAGE_KEYS.manual,
            JSON.stringify({ [getMarketKey(rise)]: { amount: '25.50' } })
        );

        expect(readTabTradeParams('manual')).toEqual({ [getMarketKey(rise)]: { amount: '25.50' } });
    });

    it('readTabTradeParams drops a stake that is not a number in either representation', () => {
        ['abc', '', '  ', null, {}, Number.POSITIVE_INFINITY].forEach(amount => {
            sessionStorage.setItem(
                TAB_TRADE_PARAMS_STORAGE_KEYS.manual,
                JSON.stringify({ [getMarketKey(rise)]: { amount, basis: 'stake' } })
            );

            expect(readTabTradeParams('manual')).toEqual({ [getMarketKey(rise)]: { basis: 'stake' } });
        });
    });

    it('readTabTradeParams keeps nullable string params set to null', () => {
        writeTabTradeParams('manual', { [getMarketKey(rise)]: { expiry_time: null, expiry_type: 'duration' } });

        expect(readTabTradeParams('manual')).toEqual({
            [getMarketKey(rise)]: { expiry_time: null, expiry_type: 'duration' },
        });
    });

    it('keeps manual and automation params in separate storage keys', () => {
        writeTabTradeParams('manual', { [getMarketKey(rise)]: { amount: 25 } });
        writeTabTradeParams('automation', { [getMarketKey(rise)]: { amount: 100 } });

        // Each mode round-trips independently — writing one never clobbers the other.
        expect(readTabTradeParams('manual')).toEqual({ [getMarketKey(rise)]: { amount: 25 } });
        expect(readTabTradeParams('automation')).toEqual({ [getMarketKey(rise)]: { amount: 100 } });
        expect(TAB_TRADE_PARAMS_STORAGE_KEYS.manual).not.toBe(TAB_TRADE_PARAMS_STORAGE_KEYS.automation);
    });

    it('pruneTabTradeParams drops entries whose tab is no longer on the strip', () => {
        const map: TTabTradeParamsMap = {
            [getMarketKey(rise)]: { amount: 25 },
            [getMarketKey(high_low)]: { amount: 10 },
        };

        expect(pruneTabTradeParams(map, [high_low])).toEqual({ [getMarketKey(high_low)]: { amount: 10 } });
    });

    it('pruneTabTradeParams returns the same reference when nothing was dropped', () => {
        const map: TTabTradeParamsMap = { [getMarketKey(rise)]: { amount: 25 } };

        expect(pruneTabTradeParams(map, [rise, high_low])).toBe(map);
        expect(pruneTabTradeParams({}, [])).toEqual({});
    });

    it('pickTabTradeParams whitelist-projects a store-shaped object and skips undefined', () => {
        expect(
            pickTabTradeParams({
                amount: 25,
                duration: 8,
                take_profit: undefined,
                has_take_profit: false,
                expiry_time: null,
                currency: 'USD',
                symbol: 'frxEURUSD',
            })
        ).toEqual({ amount: 25, duration: 8, has_take_profit: false, expiry_time: null });
    });
});
