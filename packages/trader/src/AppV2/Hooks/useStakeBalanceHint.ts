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
 * The insufficient-balance hint for the portrait stake editors. Silent on a `payout` basis — the
 * drafted amount is only the sum charged when `basis` is `stake`. Returns the hint node, or null.
 */
const useStakeBalanceHint = ({ stake, basis, balance, currency }: TStakeBalanceHintArgs): React.ReactNode =>
    basis === 'stake' && Number.isFinite(parseAmount(balance))
        ? getInsufficientBalanceMessage({ balance, stake, currency, fallback: null })
        : null;

export default useStakeBalanceHint;
