import { localize } from '@deriv-com/translations';

/**
 * Labels for the raw API parameter names a backend rejection can name, so a message shown to a
 * user points at a control they can find instead of at a wire identifier (issue #1247).
 *
 * The keys are the request fields this app actually sends (see `createProposalRequestForContract`
 * and `buildContractTemplate` in the trader package). Only identifiers whose label differs from
 * the identifier are listed: `duration`, `multiplier`, `barrier` and `currency` already read as
 * their own labels. `amount` is deliberately absent — its meaning flips with `basis` (stake vs
 * payout), so a fixed label would be wrong half the time.
 *
 * This is a function rather than a module-level constant so `localize` resolves in the active
 * language on every call. A constant would freeze every label in the language the app booted in.
 * Mirrors `getLocalizedBasis` in `utils/constants/contract.ts`.
 */
export const getApiParameterLabels = (): Record<string, string> => ({
    ask_price: localize('price'),
    barrier2: localize('second barrier'),
    contract_type: localize('trade type'),
    date_expiry: localize('end time'),
    date_start: localize('start time'),
    duration_unit: localize('duration unit'),
    growth_rate: localize('growth rate'),
    last_digit: localize('last digit prediction'),
    limit_order: localize('take profit or stop loss'),
    payout_per_point: localize('payout per point'),
    selected_tick: localize('tick prediction'),
    stop_loss: localize('stop loss'),
    stop_out: localize('stop out'),
    take_profit: localize('take profit'),
    underlying_symbol: localize('market'),
});

/**
 * Replaces every known API parameter name in `text` with its label.
 *
 * Token-level replacement rather than whole-string equality, so one function covers a bare
 * argument (`'date_expiry'`), a comma-joined argument (`'take_profit, stop_loss'`) and prose
 * (`'Please specify either duration or date_expiry.'`). Keys are matched longest first so a
 * shorter key can never partially consume a longer one, and word-boundary anchored so a key is
 * never rewritten inside a longer identifier.
 *
 * Text that contains no key is returned unchanged — amounts, currencies, dates, symbol codes and
 * contract-type codes pass through byte-for-byte.
 */
export const humanizeApiParameterNames = (text: string): string => {
    const labels = getApiParameterLabels();
    const keys = Object.keys(labels).sort((a, b) => b.length - a.length);
    const pattern = new RegExp(`\\b(${keys.join('|')})\\b`, 'g');

    return text.replace(pattern, key => labels[key]);
};

/**
 * Whether `text` still reads like it carries a raw API parameter name — a lowercase snake_case
 * wire identifier the glossary has no label for.
 *
 * The lowercase anchoring is load-bearing: it is what exempts the values a message legitimately
 * quotes. Market symbol codes (`R_100`, `1HZ100V`) and contract-type codes (`MULTUP`,
 * `DIGITMATCH`) are uppercase, so they cannot match and cannot trigger a fallback.
 */
export const hasRawApiParameterName = (text: string): boolean => /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/.test(text);
