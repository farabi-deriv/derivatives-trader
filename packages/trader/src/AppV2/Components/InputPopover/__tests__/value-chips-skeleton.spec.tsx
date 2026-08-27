import { render, screen } from '@testing-library/react';

import ValueChipsSkeleton from '../value-chips-skeleton';

// Mock quill-ui's Skeleton so this suite owns its own test IDs and stays decoupled from the
// library's internals (a renamed/removed internal test ID must not silently break it).
jest.mock('@deriv-com/quill-ui', () => ({
    Skeleton: {
        Square: ({ className }: { className?: string }) => <div data-testid='skeleton-square' className={className} />,
    },
}));

describe('ValueChipsSkeleton', () => {
    it('renders a full row of six placeholders, matching the row of chips it stands in for', () => {
        render(<ValueChipsSkeleton />);

        expect(screen.getAllByTestId('skeleton-square')).toHaveLength(6);
    });

    it('offers no selectable chip while it is standing in', () => {
        render(<ValueChipsSkeleton />);

        expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    it('keeps the value-chips styling, so the real chips land in the same place', () => {
        render(<ValueChipsSkeleton />);

        expect(screen.getByTestId('dt_value_chips_skeleton')).toHaveClass('value-chips');
        screen.getAllByTestId('skeleton-square').forEach(placeholder => {
            expect(placeholder).toHaveClass('value-chips__skeleton-chip');
        });
    });

    it('carries the caller variant class, so the pill row is a row of pills', () => {
        render(<ValueChipsSkeleton className='value-chips--pills' />);

        expect(screen.getByTestId('dt_value_chips_skeleton')).toHaveClass('value-chips--pills');
    });
});
