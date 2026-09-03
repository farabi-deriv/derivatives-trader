import { safeParse } from '@deriv/utils';

import { type TOpenMarket, type TOpenMarketsMode } from './open-markets-utils';

/** The user-editable trade parameters a market tab owns, and the primitive kind each one must be to
 * survive a read. Deliberately EXCLUDED: `currency` and `is_trade_params_expanded` (account- and
 * layout-scoped, so they stay global in `BaseStore`'s localStorage blob), `contract_expiry_type`
 * (derived from the `contracts_for` response by `ContractType.getContractValues`, never chosen by
 * the user — it is recomputed for whichever pair is active), and the offering's choice LISTS
 * (`strike_price_choices`, `long_barriers`, `short_barriers`) — they describe what the market
 * currently offers, not what the user picked, and a restored stale copy overwrote the fresh lists
 * the activation had just loaded, offering strikes the proposal then rejected.
 *
 * This record is the single source of truth: {@link TAB_TRADE_PARAM_KEYS} is the whitelist derived
 * from it and {@link TTabTradeParams} is the shape derived from it, so the list can't drift. */
const TAB_TRADE_PARAM_TYPES = {
    // `numeric`, not `number`: the store's `amount` is declared a number but legitimately holds a
    // STRING at runtime — the stake action sheet commits its raw input (`stake-input.tsx`'s
    // `displayAmount`), and every consumer coerces. A `number`-only check would silently drop the
    // stake the user just typed, which is the headline value this whole feature exists to keep.
    amount: 'numeric',
    basis: 'string',
    barrier_1: 'string',
    barrier_2: 'string',
    duration: 'number',
    duration_unit: 'string',
    expiry_date: 'nullable_string',
    expiry_time: 'nullable_string',
    expiry_type: 'nullable_string',
    // The End Time picker's own copy of the chosen date. It drives what the action sheet shows when
    // reopened AND — because `duration.tsx` seeds the picker from it — whether the tab reopens on the
    // date the user picked. Without it a restored End Time tab kept `expiry_date` in the store but
    // showed an empty picker, and the pipeline re-derived `expiry_date` from TODAY, sending a
    // date_expiry the server rejects — the payout then span forever.
    saved_expiry_date_v2: 'string',
    start_date: 'number',
    start_time: 'nullable_string',
    growth_rate: 'number',
    multiplier: 'number',
    last_digit: 'number',
    payout_per_point: 'string',
    is_equal: 'number',
    has_take_profit: 'boolean',
    take_profit: 'string',
    has_stop_loss: 'boolean',
    stop_loss: 'string',
    has_cancellation: 'boolean',
    cancellation_duration: 'string',
    v2_params_initial_values: 'object',
} as const;

type TParamKind = (typeof TAB_TRADE_PARAM_TYPES)[keyof typeof TAB_TRADE_PARAM_TYPES];
type TKindToValue = {
    number: number;
    numeric: number | string;
    string: string;
    boolean: boolean;
    object: Record<string, unknown>;
    nullable_string: string | null;
};

export type TTabTradeParamKey = keyof typeof TAB_TRADE_PARAM_TYPES;

/** Whitelist of the keys a tab owns — anything else found in storage is dropped on read. */
export const TAB_TRADE_PARAM_KEYS = Object.keys(TAB_TRADE_PARAM_TYPES) as TTabTradeParamKey[];

/** One tab's saved parameters. Every key is optional: a tab only stores what it has been given. */
export type TTabTradeParams = {
    [K in TTabTradeParamKey]?: TKindToValue[(typeof TAB_TRADE_PARAM_TYPES)[K]];
};

/** All tabs' parameters for one mode, keyed by {@link getMarketKey}. */
export type TTabTradeParamsMap = Record<string, TTabTradeParams>;

/** Storage key for a tab's parameters: the (symbol, contract_type) PAIR the tab is recorded under,
 * which is already its identity on the strip. Never the tab's array index — indices shift under
 * `removeFromOpenMarkets` / `replaceInOpenMarkets`, which would silently re-assign one tab's saved
 * parameters to another. */
export const getMarketKey = ({ symbol, contract_type }: TOpenMarket) => `${symbol}|${contract_type}`;

// sessionStorage (not localStorage), one key per mode, mirroring `OPEN_MARKETS_STORAGE_KEYS`: manual
// and automation keep independent tab collections, so their parameters are independent too. The strip
// itself uses the same medium, so a tab and its parameters share one lifetime and one scope — which
// is what makes a NEW browser tab start from a single default tab with default values.
export const TAB_TRADE_PARAMS_STORAGE_KEYS: Record<TOpenMarketsMode, string> = {
    manual: 'tab_trade_params_v2',
    automation: 'tab_trade_params_automation_v2',
};

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const matchesKind = (value: unknown, kind: TParamKind) => {
    switch (kind) {
        case 'number':
            return typeof value === 'number' && Number.isFinite(value);
        // Either representation, but it must actually be a number: a non-numeric string would reach
        // the proposal request as-is. Rejects '' / whitespace (`Number('')` is 0).
        case 'numeric':
            return (
                (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) &&
                Number.isFinite(Number(value))
            );
        case 'string':
            return typeof value === 'string';
        case 'boolean':
            return typeof value === 'boolean';
        case 'nullable_string':
            return value === null || typeof value === 'string';
        case 'object':
            return isPlainObject(value);
        default:
            return false;
    }
};

/** The keys that only make sense together: an End Time selection is the full tuple. A partial
 * tuple (per-key validation dropped one member of a corrupt entry, or a writer set the date
 * without the picker seed) reconstructs exactly the expiry_date/picker-seed desync the
 * `saved_expiry_date_v2` whitelist comment documents as the forever-spinner bug — so the tuple is
 * validated as a unit and degrades to "nothing saved". */
const END_TIME_TUPLE_KEYS = ['expiry_type', 'expiry_date', 'expiry_time', 'saved_expiry_date_v2'] as const;

/** Presence is PER-KEY, not a blanket null check: `expiry_time` is legitimately `null` (a Days
 * tab's auto-seeded 23:59:59 end time never sets a time), while `expiry_date` and the picker seed
 * must be non-empty strings — the store's absent-value sentinel for `saved_expiry_date_v2` is `''`,
 * which a `== null` test would wave through, restoring exactly the empty-seed desync. */
const hasCompleteEndTimeTuple = (entry: TTabTradeParams) =>
    typeof entry.expiry_date === 'string' &&
    entry.expiry_date !== '' &&
    typeof entry.saved_expiry_date_v2 === 'string' &&
    entry.saved_expiry_date_v2 !== '';

/** Keep only whitelisted keys holding a value of the expected kind — corrupt or stale storage
 * degrades to "nothing saved" rather than injecting a wrongly-typed value into the store. */
const filterParams = (entry: Record<string, unknown>): TTabTradeParams => {
    const result = TAB_TRADE_PARAM_KEYS.reduce<TTabTradeParams>((filtered, key) => {
        if (key in entry && matchesKind(entry[key], TAB_TRADE_PARAM_TYPES[key])) {
            (filtered as Record<string, unknown>)[key] = entry[key];
        }
        return filtered;
    }, {});
    if (result.expiry_type === 'endtime' && !hasCompleteEndTimeTuple(result)) {
        END_TIME_TUPLE_KEYS.forEach(key => delete result[key]);
    }
    return result;
};

/** Read + validate a mode's persisted parameters (a plain cast would let stale/tampered values
 * through — this map feeds straight into the trade store). Guarded like the write below: `getItem`
 * THROWS (not returns null) when storage access is denied (Safari "Block all cookies", sandboxed
 * iframes), and this runs in a TradeStore field initialiser — an unguarded throw would take down
 * the whole trade page. */
export const readTabTradeParams = (mode: TOpenMarketsMode): TTabTradeParamsMap => {
    let stored: unknown;
    try {
        stored = safeParse(sessionStorage.getItem(TAB_TRADE_PARAMS_STORAGE_KEYS[mode]) ?? '');
    } catch {
        return {};
    }
    if (!isPlainObject(stored)) return {};
    return Object.entries(stored).reduce<TTabTradeParamsMap>((result, [market_key, entry]) => {
        if (isPlainObject(entry)) result[market_key] = filterParams(entry);
        return result;
    }, {});
};

export const writeTabTradeParams = (mode: TOpenMarketsMode, map: TTabTradeParamsMap) => {
    try {
        sessionStorage.setItem(TAB_TRADE_PARAMS_STORAGE_KEYS[mode], JSON.stringify(map));
    } catch {
        // Quota exceeded / storage disabled: degrade to "not saved" rather than breaking the commit
        // that triggered the write.
    }
};

/** A source `pickTabTradeParams` can project: anything that declares the whitelisted keys it has.
 * The store passes `this`; the guarantee that these keys still EXIST on the store is enforced
 * separately by `TTabTradeParamKeysExistOnStore` in `trade-store.ts`, which is where
 * `TradeStore` is in scope (this util must not import it — the store imports this file). */
type TTabTradeParamSource = { [K in TTabTradeParamKey]?: unknown };

/** Project a store-shaped object down to the whitelisted keys, skipping values the store hasn't set
 * (`undefined`) so a restore never writes `undefined` over a live value. */
export const pickTabTradeParams = <T extends TTabTradeParamSource>(source: T): TTabTradeParams =>
    TAB_TRADE_PARAM_KEYS.reduce<TTabTradeParams>((result, key) => {
        if (source[key] !== undefined) (result as Record<string, unknown>)[key] = source[key];
        return result;
    }, {});

/** Drop entries whose tab is no longer on the strip (closed, replaced, or filtered out by the
 * automation guard). Returns the SAME reference when nothing was dropped, matching the no-op
 * convention in `addToOpenMarkets`. */
export const pruneTabTradeParams = (map: TTabTradeParamsMap, open_markets: TOpenMarket[]): TTabTradeParamsMap => {
    const live_keys = new Set(open_markets.map(getMarketKey));
    const kept = Object.keys(map).filter(market_key => live_keys.has(market_key));
    if (kept.length === Object.keys(map).length) return map;
    return kept.reduce<TTabTradeParamsMap>((result, market_key) => {
        result[market_key] = map[market_key];
        return result;
    }, {});
};
