import clsx from 'clsx';

import { Skeleton } from '@deriv-com/quill-ui';

type TTradeParamSkeletonProps = {
    /** Matches the chip it replaces: minimized chips take an equal share of the horizontal row. */
    is_minimized?: boolean;
};

/**
 * Placeholder for one trade-param chip while the market's data loads. Carries the chip's own
 * classes, height (border-box) and corner radius, so the row keeps its exact size and shape when
 * the real values land.
 */
const TradeParamSkeleton = ({ is_minimized }: TTradeParamSkeletonProps) => (
    <div
        className={clsx(
            'trade-params__skeleton',
            'trade-params__option',
            is_minimized && 'trade-params__option--minimized'
        )}
        data-testid='dt_trade_param_skeleton'
    >
        <Skeleton.Square className='trade-params__skeleton-block' />
    </div>
);

export default TradeParamSkeleton;
