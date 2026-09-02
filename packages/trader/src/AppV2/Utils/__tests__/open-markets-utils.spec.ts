import {
    addToOpenMarkets,
    getMaxOpenMarkets,
    isSameMarket,
    isSameOpenMarketList,
    MAX_OPEN_MARKETS,
    MAX_OPEN_MARKETS_MOBILE,
    MAX_OPEN_MARKETS_WEB,
    OPEN_MARKETS_STORAGE_KEYS,
    readOpenMarkets,
    removeFromOpenMarkets,
    replaceInOpenMarkets,
    writeOpenMarkets,
} from '../open-markets-utils';

const rise = { symbol: 'frxEURUSD', contract_type: 'rise_fall' };
const high_low = { symbol: 'frxEURUSD', contract_type: 'high_low' };

describe('open-markets-utils', () => {
    beforeEach(() => localStorage.clear());

    it('getMaxOpenMarkets returns the device-dependent cap (4 mobile / 7 web)', () => {
        expect(getMaxOpenMarkets(true)).toBe(MAX_OPEN_MARKETS_MOBILE);
        expect(getMaxOpenMarkets(false)).toBe(MAX_OPEN_MARKETS_WEB);
        expect(MAX_OPEN_MARKETS_MOBILE).toBe(4);
        expect(MAX_OPEN_MARKETS_WEB).toBe(7);
    });

    it('isSameOpenMarketList compares lists element-wise, ignoring array identity', () => {
        // Powers the writer's no-op-write elision, so a fresh but equal array must compare equal.
        expect(isSameOpenMarketList([rise, high_low], [{ ...rise }, { ...high_low }])).toBe(true);
        expect(isSameOpenMarketList([], [])).toBe(true);
        expect(isSameOpenMarketList([rise], [rise, high_low])).toBe(false);
        expect(isSameOpenMarketList([rise, high_low], [high_low, rise])).toBe(false); // order matters
        expect(isSameOpenMarketList([rise], [high_low])).toBe(false);
    });

    it('isSameMarket compares the (symbol, contract_type) pair', () => {
        expect(isSameMarket(rise, { ...rise })).toBe(true);
        expect(isSameMarket(rise, high_low)).toBe(false);
        expect(isSameMarket(rise, { symbol: 'R_100', contract_type: 'rise_fall' })).toBe(false);
    });

    it('addToOpenMarkets keeps the same symbol under different trade types as separate entries', () => {
        const list = addToOpenMarkets(addToOpenMarkets([], rise), high_low);
        expect(list).toEqual([rise, high_low]);
    });

    it('addToOpenMarkets is a no-op for an already-present pair or an invalid market', () => {
        const list = [rise];
        expect(addToOpenMarkets(list, { ...rise })).toBe(list);
        expect(addToOpenMarkets(list, { symbol: '', contract_type: 'rise_fall' })).toBe(list);
        expect(addToOpenMarkets(list, { symbol: 'R_100', contract_type: '' })).toBe(list);
    });

    it(`addToOpenMarkets caps at ${MAX_OPEN_MARKETS}, keeping the most recent`, () => {
        let list: ReturnType<typeof addToOpenMarkets> = [];
        const total = MAX_OPEN_MARKETS + 2;
        for (let i = 0; i < total; i++) list = addToOpenMarkets(list, { symbol: `S${i}`, contract_type: 'rise_fall' });
        expect(list).toHaveLength(MAX_OPEN_MARKETS);
        expect(list[list.length - 1].symbol).toBe(`S${total - 1}`);
        expect(list.find(m => m.symbol === 'S0')).toBeUndefined();
    });

    it('removeFromOpenMarkets drops only the matching pair', () => {
        expect(removeFromOpenMarkets([rise, high_low], rise)).toEqual([high_low]);
    });

    it('replaceInOpenMarkets swaps a pair in place, keeping its position', () => {
        const gbp = { symbol: 'frxGBPUSD', contract_type: 'rise_fall' };
        expect(replaceInOpenMarkets([rise, high_low], high_low, gbp)).toEqual([rise, gbp]);
    });

    it('replaceInOpenMarkets dedupes when the replacement already exists elsewhere', () => {
        const jpy = { symbol: 'frxUSDJPY', contract_type: 'rise_fall' };
        // Replace `rise` with `jpy` which is already open last → `jpy` lands at `rise`'s slot, no dupe.
        expect(replaceInOpenMarkets([rise, high_low, jpy], rise, jpy)).toEqual([jpy, high_low]);
    });

    it('replaceInOpenMarkets is a no-op for an invalid replacement', () => {
        const list = [rise, high_low];
        expect(replaceInOpenMarkets(list, rise, { symbol: '', contract_type: 'rise_fall' })).toBe(list);
    });

    it('read/write round-trips and filters out malformed entries', () => {
        writeOpenMarkets('manual', [rise, high_low]);
        expect(readOpenMarkets('manual')).toEqual([rise, high_low]);
        localStorage.setItem(
            OPEN_MARKETS_STORAGE_KEYS.manual,
            JSON.stringify([rise, { symbol: 'x' }, { contract_type: 'y' }])
        );
        expect(readOpenMarkets('manual')).toEqual([rise]);
    });

    it('readOpenMarkets returns [] when nothing (or garbage) is stored', () => {
        expect(readOpenMarkets('manual')).toEqual([]);
        localStorage.setItem(OPEN_MARKETS_STORAGE_KEYS.manual, 'not-json');
        expect(readOpenMarkets('manual')).toEqual([]);
    });

    it('keeps manual and automation collections in separate storage keys', () => {
        writeOpenMarkets('manual', [rise]);
        writeOpenMarkets('automation', [high_low]);
        // Each mode round-trips independently — writing one never clobbers the other.
        expect(readOpenMarkets('manual')).toEqual([rise]);
        expect(readOpenMarkets('automation')).toEqual([high_low]);
        expect(OPEN_MARKETS_STORAGE_KEYS.manual).not.toBe(OPEN_MARKETS_STORAGE_KEYS.automation);
    });
});
