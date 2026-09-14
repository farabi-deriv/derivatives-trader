import React from 'react';

import { formatMoney, getCurrencyDisplayCode } from '@deriv/shared';
import { Localize } from '@deriv-com/translations';

/**
 * Mirrors the guard at `AppV2/Components/AccountHeader/account-header.tsx` — `Number('')` is `0`,
 * not `NaN`, so undefined/null/empty must be excluded explicitly before the numeric check.
 * Exported so callers that need to branch on a readable balance before calling
 * `getInsufficientBalanceMessage` parse it exactly the same way.
 */
export const parseAmount = (value?: string | number) =>
    value === undefined || value === null || value === '' ? NaN : Number(String(value).replace(/,/g, ''));

/**
 * Chooses the copy that warns a drafted stake is above the available balance. Consumed by the
 * mobile and desktop stake inputs, which pass `fallback: null` so an affordable stake — or a
 * balance/stake that cannot be read — renders no hint at all.
 *
 * This only chooses the copy; whether anything renders stays with the caller. Both stake inputs
 * surface the empty-balance branch below too, so a zero/negative balance warns as soon as it is
 * known, without waiting for a preset tap or typed amount to register.
 *
 * The finite check runs before any formatting because `formatMoney` coerces `undefined`/`NaN` to
 * `"0.00"`, which would report an empty balance for one that has simply not loaded. The
 * empty-balance branch then runs before the stake is read, so a balance of `0` resolves even
 * when the stake is momentarily unknown.
 */
export const getInsufficientBalanceMessage = ({
    balance,
    stake,
    currency,
    fallback,
}: {
    balance?: string | number;
    stake?: string | number;
    currency?: string;
    fallback: React.ReactNode;
}): React.ReactNode => {
    const parsed_balance = parseAmount(balance);
    if (!Number.isFinite(parsed_balance)) return fallback;

    if (parsed_balance <= 0) {
        return <Localize i18n_default_text='Balance is empty. Deposit funds to buy this contract.' />;
    }

    const parsed_stake = parseAmount(stake);
    if (!Number.isFinite(parsed_stake) || parsed_stake <= 0) return fallback;

    if (parsed_balance < parsed_stake) {
        return (
            <Localize
                i18n_default_text='You only have {{balance}} {{currency}} left. Try a lower stake.'
                values={{
                    balance: formatMoney(currency ?? '', parsed_balance, true),
                    currency: getCurrencyDisplayCode(currency),
                }}
            />
        );
    }

    return fallback;
};
