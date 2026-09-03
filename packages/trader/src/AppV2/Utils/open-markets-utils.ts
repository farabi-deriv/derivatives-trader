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
// Both the STRIP and each tab's trade PARAMETERS (`TAB_TRADE_PARAMS_STORAGE_KEYS` in
// AppV2/Utils/tab-trade-params-utils, keyed by the same (symbol, contract_type) pair) live in
// sessionStorage, so the whole Trade page is scoped to one browser tab: a refresh keeps your tabs
// and their values, while a NEW browser tab starts from a single default tab rather than inheriting
// the tabs another browser tab happens to have open. Deliberate consequence: the strip no longer
// survives closing the browser.
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

let has_cleared_legacy_open_markets = false;

/** MIGRATION of the strip a previous release persisted to localStorage, where it was shared by
 * every browser tab. The strip now lives in sessionStorage; the legacy entry is ADOPTED into
 * sessionStorage (when this browser tab has none of its own yet) before being removed, so the
 * release is lossless for existing users — their tabs carry over once per browser tab — and a
 * rollback still finds the strip where the reverted code expects it for any tab that hasn't
 * migrated yet.
 *
 * Called from {@link readOpenMarkets} rather than from the store, so it cannot be sequenced wrong:
 * `TradeStore` reads the strip in a FIELD INITIALISER, which runs after `super()` and therefore
 * before any constructor-body statement could clean up. Runs at most once per module instance and
 * writes nothing when there is nothing to migrate, so it stays off the hot path — `readOpenMarkets`
 * is called on every market switch, and `barrier-reset.spec.ts` pins that switch's exact
 * `localStorage.removeItem` count. Never touches `localStorage['trade_store']`, which still
 * legitimately holds `currency` and `is_trade_params_expanded`. */
const clearLegacyOpenMarketsFromLocalStorage = () => {
    if (has_cleared_legacy_open_markets) return;
    has_cleared_legacy_open_markets = true;
    try {
        Object.values(OPEN_MARKETS_STORAGE_KEYS).forEach(key => {
            // Only touch storage when there is something to migrate, so the common case (every
            // load after the first) performs no writes at all.
            const legacy = localStorage.getItem(key);
            if (legacy === null) return;
            if (sessionStorage.getItem(key) === null) sessionStorage.setItem(key, legacy);
            localStorage.removeItem(key);
        });
    } catch {
        // Storage unavailable — the stale entries stay, which is no worse than before the cleanup.
    }
};

/** Test seam: lets a spec exercise the one-time eviction more than once per module instance. */
export const resetLegacyOpenMarketsCleanupForTesting = () => {
    has_cleared_legacy_open_markets = false;
};

/** Read + validate a mode's persisted list (a plain cast would let stale/tampered values through).
 * The read itself is guarded like every write: `getItem` THROWS (not returns null) when storage
 * access is denied (Safari "Block all cookies", sandboxed iframes), and this runs in a TradeStore
 * field initialiser — an unguarded throw would take down the whole trade page. */
export const readOpenMarkets = (mode: TOpenMarketsMode): TOpenMarket[] => {
    try {
        clearLegacyOpenMarketsFromLocalStorage();
        const stored = safeParse(sessionStorage.getItem(OPEN_MARKETS_STORAGE_KEYS[mode]) ?? '') as TOpenMarket[] | null;
        return Array.isArray(stored) ? stored.filter(market => market?.symbol && market?.contract_type) : [];
    } catch {
        return [];
    }
};

export const writeOpenMarkets = (mode: TOpenMarketsMode, markets: TOpenMarket[]) => {
    // sessionStorage, matching the params map: a write can throw when the quota is exhausted or the
    // storage is blocked, and losing the strip must never break the page. Degrades to "not saved".
    try {
        sessionStorage.setItem(OPEN_MARKETS_STORAGE_KEYS[mode], JSON.stringify(markets));
    } catch {
        // ignore — the in-memory collection stays authoritative for this session
    }
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
