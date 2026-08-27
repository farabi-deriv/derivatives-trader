import { render, screen } from '@testing-library/react';

import TradeParamSkeleton from '../trade-param-skeleton';

// Mock quill-ui's Skeleton so this suite owns its own test ID and stays decoupled from the
// library's internals (a renamed/removed internal test ID must not silently break it).
jest.mock('@deriv-com/quill-ui', () => ({
    Skeleton: {
        Square: ({ height, className }: { height?: string; className?: string }) => (
            <div data-testid='skeleton-square' data-height={height} className={className} />
        ),
    },
}));

describe('TradeParamSkeleton', () => {
    it('keeps the chip styling, so the real param lands in the same place', () => {
        render(<TradeParamSkeleton />);

        expect(screen.getByTestId('dt_trade_param_skeleton')).toHaveClass('trade-params__option');
    });

    it('takes the minimized chip class, so it gets its share of the horizontal row', () => {
        render(<TradeParamSkeleton is_minimized />);

        expect(screen.getByTestId('dt_trade_param_skeleton')).toHaveClass('trade-params__option--minimized');
    });

    it('holds the chip height from its own class, so the row does not resize when the values land', () => {
        render(<TradeParamSkeleton />);

        // The height lives on the wrapper (`trade-params__skeleton`, border-box) rather than on the
        // inner square, so the chip border is counted inside the 56px instead of added on top of it.
        expect(screen.getByTestId('dt_trade_param_skeleton')).toHaveClass('trade-params__skeleton');
        expect(screen.getByTestId('skeleton-square')).not.toHaveAttribute('data-height');
    });

    it('rounds the inner block with the chip, so the placeholder is the chip’s shape', () => {
        render(<TradeParamSkeleton />);

        // `trade-params__skeleton` sets quill's field radius and `-block` inherits it, so the
        // placeholder does not show square corners inside the rounded slot it stands in.
        expect(screen.getByTestId('skeleton-square')).toHaveClass('trade-params__skeleton-block');
    });

    it('offers nothing to interact with while it is standing in', () => {
        render(<TradeParamSkeleton is_minimized />);

        expect(screen.queryAllByRole('button')).toHaveLength(0);
        expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    });
});
