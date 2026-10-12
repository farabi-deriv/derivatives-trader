import React from 'react';

import { CONTRACT_TYPES } from '@deriv/shared';
import { localize } from '@deriv-com/translations';

import { formatAmountWithSymbol } from 'AppV2/Utils/currency-utils';
import { buildLadder } from 'AppV2/Utils/landscape-wheel-utils';
import { useTraderStore } from 'Stores/useTraderStores';

import { TLandscapeParamAdapter } from '../types';

import useRetainedBounds from './use-retained-bounds';

const MIN_TP_FALLBACK = 1;
// Chip display while off, matching the portrait take-profit chip.
const OFF_LABEL = '-';

/**
 * Take profit is switched on/off from its panel, and the off state is NOT a rung of the wheel. The
 * ladder holds real amounts only, so switching off is a deliberate tap, never a scroll past the bottom.
 */
const useLandscapeTakeProfit = (): TLandscapeParamAdapter => {
    const {
        currency,
        validation_params,
        has_take_profit,
        take_profit,
        onChangeMultiple,
        is_market_closed,
        has_open_accu_contract,
    } = useTraderStore();

    const bounds = validation_params?.[CONTRACT_TYPES.ACCUMULATOR]?.take_profit;
    // Retained across the in-flight proposal a commit triggers — see use-retained-bounds.
    const { min, max } = useRetainedBounds({
        min: bounds?.min,
        max: bounds?.max,
        fallback_min: MIN_TP_FALLBACK,
        fallback_value: take_profit,
    });
    const ladder = React.useMemo(() => buildLadder({ min, max }), [min, max]);

    // Switching off clears the store's amount, as every take-profit editor does, so remember the last
    // one: the panel reopens on it, and switches back on at it, instead of the floor.
    const last_amount = React.useRef<number | null>(null);
    if (has_take_profit && take_profit) last_amount.current = Number(take_profit);

    const labelAt = React.useCallback(
        (index: number) => formatAmountWithSymbol(currency, ladder.valueAt(index)),
        [currency, ladder]
    );

    // Mirrors RiskManagement/take-profit-and-stop-loss-input: has_cancellation only when enabled.
    const enableWith = React.useCallback(
        (value: number) =>
            onChangeMultiple({ has_take_profit: true, take_profit: String(value), has_cancellation: false }),
        [onChangeMultiple]
    );

    // Only ever called while enabled — the panel does not scroll while off.
    const commit = React.useCallback((index: number) => enableWith(ladder.valueAt(index)), [enableWith, ladder]);

    const toggle = React.useCallback(
        (index = 0) => {
            if (has_take_profit) {
                onChangeMultiple({ has_take_profit: false, take_profit: '' });
            } else {
                enableWith(ladder.valueAt(index));
            }
        },
        [has_take_profit, onChangeMultiple, enableWith, ladder]
    );

    return {
        key: 'take_profit',
        label: localize('Take profit'),
        display_value: has_take_profit ? formatAmountWithSymbol(currency, Number(take_profit)) : OFF_LABEL,
        is_disabled: is_market_closed || has_open_accu_contract,
        last_index: ladder.last_index,
        selected_index: last_amount.current === null ? 0 : ladder.indexOf(last_amount.current),
        labelAt,
        commit,
        is_on: has_take_profit,
        toggle,
    };
};

export default useLandscapeTakeProfit;
