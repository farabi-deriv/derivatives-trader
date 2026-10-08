import React from 'react';

import { getGrowthRatePercentage } from '@deriv/shared';
import { localize } from '@deriv-com/translations';

import { useTraderStore } from 'Stores/useTraderStores';

import { TLandscapeParamAdapter } from '../types';

/** A rate as the chip and the wheel show it, e.g. `3%`. */
const formatGrowthRate = (rate: number) => `${Math.round(getGrowthRatePercentage(rate ?? 0))}%`;

/**
 * Growth rate on the landscape pill, a second way into the same value the Accumulators band opens.
 *
 * Unlike the other two parameters there is no ladder to build: `contracts_for` hands back the exact
 * rates the backend will accept, so the wheel is that list and nothing is derived. Sorted rather than
 * trusted in arrival order, so scrolling up always means a higher rate — the same rule the on-chart
 * picker follows, and the two have to agree about which rung is which.
 */
const useLandscapeGrowthRate = (): TLandscapeParamAdapter => {
    const { accumulator_range_list, growth_rate, onChange, is_market_closed, has_open_accu_contract } =
        useTraderStore();

    const rates = React.useMemo(
        () => [...(accumulator_range_list ?? [])].filter(rate => rate > 0).sort((a, b) => a - b),
        [accumulator_range_list]
    );

    const labelAt = React.useCallback((index: number) => formatGrowthRate(rates[index]), [rates]);

    // The chart draws the band at whatever rate the wheel is showing, and needs the number for it.
    const valueAt = React.useCallback((index: number) => rates[index], [rates]);

    const commit = React.useCallback(
        (index: number) => onChange({ target: { name: 'growth_rate', value: rates[index] } }),
        [onChange, rates]
    );

    const selected_index = rates.indexOf(growth_rate);

    return {
        key: 'growth_rate',
        label: localize('Growth rate'),
        display_value: formatGrowthRate(growth_rate),
        // A single rate is not a choice, so the chip goes inert rather than opening a wheel with one
        // rung — the same bar the on-chart picker sets for making the band tappable.
        is_disabled: is_market_closed || has_open_accu_contract || rates.length < 2,
        last_index: Math.max(rates.length - 1, 0),
        // Falls back to the floor rather than -1 when the store holds a rate the list has not caught up
        // with, which would otherwise open the wheel above its own first rung.
        selected_index: selected_index === -1 ? 0 : selected_index,
        labelAt,
        valueAt,
        commit,
        getHint: () => null,
        shouldBlockCommit: () => false,
    };
};

export default useLandscapeGrowthRate;
