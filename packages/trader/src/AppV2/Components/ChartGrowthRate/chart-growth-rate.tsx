import { Text } from '@deriv-com/quill-ui';
import { Localize } from '@deriv-com/translations';

import LandscapeValueRows from 'AppV2/Components/TradeParameters/Landscape/landscape-value-rows';
import useParamDrag from 'AppV2/Components/TradeParameters/Landscape/use-param-drag';
import { TAccumulatorGrowthRatePicker } from 'AppV2/Hooks/useAccumulatorGrowthRatePicker';

import './chart-growth-rate.scss';

type TChartGrowthRate = {
    /** The picker to show, or null when nothing is open. */
    picker: TAccumulatorGrowthRatePicker | null;
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
const ChartGrowthRate = ({ picker }: TChartGrowthRate) => {
    // Hooks run before the early return; the handlers are inert without a picker.
    const drag = useParamDrag({
        onStep: picker?.onStep ?? noop,
        onSettle: picker?.onSettle,
    });

    if (!picker) return null;

    return (
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
};

const noop = () => {
    // The picker is closed, so there is nothing to step.
};

export default ChartGrowthRate;
