import React from 'react';

import { getInsufficientBalanceMessage, parseAmount } from 'AppV2/Utils/insufficient-balance-utils';

type TStakeBalanceHintArgs = {
    /** The drafted stake being charged. */
    stake?: string | number;
    basis: string;
    balance?: string | number;
    currency?: string;
};

/**
 * Single source of the insufficient-balance hint, shared by the portrait stake editors and the
 * landscape adapter. Silent on a `payout` basis — the drafted amount is only the sum charged when
 * `basis` is `stake`. Returns the hint node, or null.
 */
export const getStakeBalanceHint = ({ stake, basis, balance, currency }: TStakeBalanceHintArgs): React.ReactNode => {
    const parsed_balance = parseAmount(balance);
    return basis === 'stake' && Number.isFinite(parsed_balance)
        ? getInsufficientBalanceMessage({ balance, stake, currency, fallback: null })
        : null;
};

/** Hook form for the portrait stake editors; the landscape stake adapter uses the pure function above. */
const useStakeBalanceHint = (args: TStakeBalanceHintArgs): React.ReactNode => getStakeBalanceHint(args);

export default useStakeBalanceHint;
