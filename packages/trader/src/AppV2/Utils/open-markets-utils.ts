import { safeParse } from '@deriv/utils';

/** One open market "tab" on the Trade page strip, identified by the (symbol, contract_type) PAIR. */
export type TOpenMarket = {
    symbol: string;
    contract_type: string;
};

/** Manual and automated trading keep independent tab collections, so switching modes never disturbs
 * the other mode's tabs and each gets its own {@link MAX_OPEN_MARKETS} cap. */
export type TOpenMarketsMode = 'manual' | 'automation';

// Manual keeps the original key so existing users' tabs survive the split; automation gets its own.
export const OPEN_MARKETS_STORAGE_KEYS: Record<TOpenMarketsMode, string> = {
    manual: 'open_markets_v2',
    automation: 'open_markets_automation_v2',
};

// Per-device cap on the strip so it can't grow unbounded: mobile is tighter on horizontal space,
// web allows more. `MAX_OPEN_MARKETS` stays the web value — the absolute backstop for the
// device-agnostic list helpers below; components use `getMaxOpenMarkets(isMobile)` for the live cap.
export const MAX_OPEN_MARKETS_MOBILE = 4;
export const MAX_OPEN_MARKETS_WEB = 7;
export const MAX_OPEN_MARKETS = MAX_OPEN_MARKETS_WEB;

/** Device-dependent tab cap: fewer tabs on mobile, more on web. */
export const getMaxOpenMarkets = (is_mobile: boolean) => (is_mobile ? MAX_OPEN_MARKETS_MOBILE : MAX_OPEN_MARKETS_WEB);

/** Tabs are identified by the (symbol, contract_type) pair — the same symbol can be open under
 * several trade types as distinct tabs (e.g. Bull Market Index · Rise/Fall AND · Higher/Lower). */
export const isSameMarket = (a: TOpenMarket, b: TOpenMarket) =>
    a.symbol === b.symbol && a.contract_type === b.contract_type;

/** Element-wise list equality, so a writer can elide a no-op write instead of reallocating. */
export const isSameOpenMarketList = (a: TOpenMarket[], b: TOpenMarket[]) =>
    a.length === b.length && a.every((market, index) => isSameMarket(market, b[index]));

/** Read + validate a mode's persisted list (a plain cast would let stale/tampered values through). */
export const readOpenMarkets = (mode: TOpenMarketsMode): TOpenMarket[] => {
    const stored = safeParse(localStorage.getItem(OPEN_MARKETS_STORAGE_KEYS[mode]) ?? '') as TOpenMarket[] | null;
    return Array.isArray(stored) ? stored.filter(market => market?.symbol && market?.contract_type) : [];
};

export const writeOpenMarkets = (mode: TOpenMarketsMode, markets: TOpenMarket[]) => {
    localStorage.setItem(OPEN_MARKETS_STORAGE_KEYS[mode], JSON.stringify(markets));
};

/** Append a new pair (no-op if already open — keeps position), most-recent last, capped. */
export const addToOpenMarkets = (list: TOpenMarket[], market: TOpenMarket): TOpenMarket[] => {
    if (!market.symbol || !market.contract_type) return list;
    if (list.some(item => isSameMarket(item, market))) return list;
    return [...list, market].slice(-MAX_OPEN_MARKETS);
};

/** Drop the given pair. */
export const removeFromOpenMarkets = (list: TOpenMarket[], market: TOpenMarket): TOpenMarket[] =>
    list.filter(item => !isSameMarket(item, market));

/** Replace `old` with `next` in place (keeps `old`'s position; dedupes any existing `next`). Used by
 * the long-press "replace this tab" flow. No-op (returns the same list) when `next` is invalid. */
export const replaceInOpenMarkets = (list: TOpenMarket[], old: TOpenMarket, next: TOpenMarket): TOpenMarket[] => {
    if (!next.symbol || !next.contract_type) return list;
    const index = list.findIndex(item => isSameMarket(item, old));
    const without = list.filter(item => !isSameMarket(item, old) && !isSameMarket(item, next));
    const insert_at = index < 0 ? without.length : Math.min(index, without.length);
    return [...without.slice(0, insert_at), next, ...without.slice(insert_at)];
};
