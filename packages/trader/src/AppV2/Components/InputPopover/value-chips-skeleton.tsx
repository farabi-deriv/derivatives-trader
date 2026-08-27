import clsx from 'clsx';

import { Skeleton } from '@deriv-com/quill-ui';

/** A chip row is six wide everywhere it is used, so the placeholder is too. */
const PLACEHOLDER_COUNT = 6;

type TValueChipsSkeletonProps = {
    /** Variant class of the chip row it stands in for, e.g. `value-chips--pills`. */
    className?: string;
};

/**
 * Placeholder row shown while the quick-pick values are being derived: same grid, full row of
 * chip-sized blocks, so the wait reads as loading and the real chips land without a resize.
 */
const ValueChipsSkeleton = ({ className }: TValueChipsSkeletonProps) => (
    <div className={clsx('value-chips', className)} data-testid='dt_value_chips_skeleton'>
        <div className='value-chips__grid'>
            {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
                <Skeleton.Square key={index} className='value-chips__skeleton-chip' height='4.8rem' />
            ))}
        </div>
    </div>
);

export default ValueChipsSkeleton;
