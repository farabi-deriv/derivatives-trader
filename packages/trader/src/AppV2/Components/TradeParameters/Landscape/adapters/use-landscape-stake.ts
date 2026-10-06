import React from 'react';

import { CONTRACT_TYPES } from '@deriv/shared';
import { useStore } from '@deriv/stores';
import { localize } from '@deriv-com/translations';

import { getStakeBalanceHint } from 'AppV2/Hooks/useStakeBalanceHint';
import { formatAmountWithSymbol } from 'AppV2/Utils/currency-utils';
import { buildLadder, STAKE_FINE_LIMIT } from 'AppV2/Utils/landscape-wheel-utils';
import { useTraderStore } from 'Stores/useTraderStores';

import { TLandscapeParamAdapter } from '../types';

import useRetainedBounds from './use-retained-bounds';

const MIN_STAKE_FALLBACK = 0.4;

// The only adapter that may touch client.balance and the stake balance hint (LTP-008).
const useLandscapeStake = (): TLandscapeParamAdapter => {
    const {
        client: { balance },
    } = useStore();
    const { amount, basis, currency, validation_params, onChange, is_market_closed, has_open_accu_contract } =
        useTraderStore();

    const bounds = validation_params?.[CONTRACT_TYPES.ACCUMULATOR]?.stake;
    // Retained across the in-flight proposal a commit triggers, so the ladder never reshapes mid-scroll.
    const { min, max } = useRetainedBounds({
        min: bounds?.min,
        max: bounds?.max,
        fallback_min: MIN_STAKE_FALLBACK,
        fallback_value: amount,
    });
    const ladder = React.useMemo(() => buildLadder({ min, max, fine_limit: STAKE_FINE_LIMIT }), [min, max]);

    const labelAt = React.useCallback(
        (index: number) => formatAmountWithSymbol(currency, ladder.valueAt(index)),
        [currency, ladder]
    );

    const commit = React.useCallback(
        (index: number) => onChange({ target: { name: 'amount', value: ladder.valueAt(index) } }),
        [onChange, ladder]
    );

    const getHint = React.useCallback(
        (index: number) => getStakeBalanceHint({ stake: ladder.valueAt(index), basis, balance, currency }),
        [ladder, basis, balance, currency]
    );

    const shouldBlockCommit = React.useCallback((index: number) => !!getHint(index), [getHint]);

    return {
        key: 'stake',
        label: localize('Stake'),
        display_value: formatAmountWithSymbol(currency, Number(amount)),
        is_disabled: is_market_closed || has_open_accu_contract,
        last_index: ladder.last_index,
        selected_index: ladder.indexOf(Number(amount)),
        labelAt,
        commit,
        getHint,
        shouldBlockCommit,
    };
};

export default useLandscapeStake;
