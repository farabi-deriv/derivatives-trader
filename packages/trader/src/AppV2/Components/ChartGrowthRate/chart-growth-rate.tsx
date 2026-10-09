import React from 'react';
import { createPortal } from 'react-dom';

import { Text } from '@deriv-com/quill-ui';
import { Localize } from '@deriv-com/translations';

import LandscapeValueRows from 'AppV2/Components/TradeParameters/Landscape/landscape-value-rows';
import useParamDrag from 'AppV2/Components/TradeParameters/Landscape/use-param-drag';
import { TAccumulatorGrowthRatePicker } from 'AppV2/Hooks/useAccumulatorGrowthRatePicker';

import './chart-growth-rate.scss';

type TChartGrowthRate = {
    /** The picker to show, or null when nothing is open. */
    picker: TAccumulatorGrowthRatePicker | null;
    /**
     * Where to render, when the card must escape its own subtree.
     *
     * `.trade__chart` clips its overflow, so a card positioned to clear the params pill is cut off
     * at the top rather than drawn over the stats strip. Landscape hands the page root here so the
     * card is bounded by the viewport and nothing else. Without one it renders in place.
     */
    portal_container?: React.RefObject<HTMLElement | null>;
};

/**
 * The growth-rate picker the Accumulators band opens.
 *
 * A sibling of `<TradeChart />` inside `.trade__chart`, which is the positioning
 * context — the same arrangement `ChartProfitLoss` uses. Built on the same rows
 * and the same drag as the landscape trade params, so it reads and scrolls like
 * the Stake wheel rather than like a second, nearly-identical control.
 *
 * It never commits: the hook owns the draft and writes it to the store when the
 * picker settles.
 */
const ChartGrowthRate = ({ picker, portal_container }: TChartGrowthRate) => {
    // Hooks run before the early return; the handlers are inert without a picker.
    const drag = useParamDrag({
        onStep: picker?.onStep ?? noop,
        onSettle: picker?.onSettle,
    });

    if (!picker) return null;

    const card = (
        <div
            ref={picker.container_ref}
            className='chart-growth-rate'
            data-testid='dt_chart_growth_rate'
            onPointerDown={drag.onPointerDown}
            onWheel={drag.onWheel}
        >
            <Text size='md' bold className='chart-growth-rate__label'>
                <Localize i18n_default_text='Growth rate' />
            </Text>
            <LandscapeValueRows
                last_index={picker.last_index}
                index={picker.index}
                labelAt={picker.labelAt}
                className='chart-growth-rate__rows'
            />
        </div>
    );

    // Read at render rather than held in state: the container is mounted by an ancestor, so it is
    // already there on the first render that has a picker to show.
    const host = portal_container?.current;
    return host ? createPortal(card, host) : card;
};

const noop = () => {
    // The picker is closed, so there is nothing to step.
};

export default ChartGrowthRate;
