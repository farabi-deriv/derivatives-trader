import { act, render, screen } from '@testing-library/react';

import SlideUpPresence, { SLIDE_MS } from '../slide-up-presence';

const Page = ({ is_open, label }: { is_open: boolean; label: string }) => (
    <SlideUpPresence is_open={is_open} data-testid='page'>
        {is_open && <span data-testid='content'>{label}</span>}
    </SlideUpPresence>
);

describe('SlideUpPresence', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('renders nothing until opened', () => {
        render(<Page is_open={false} label='a' />);
        expect(screen.queryByTestId('page')).not.toBeInTheDocument();
    });

    it('mounts when opened after starting closed', () => {
        const { rerender } = render(<Page is_open={false} label='a' />);
        rerender(<Page is_open label='a' />);

        expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('stays mounted while open', () => {
        render(<Page is_open label='a' />);
        act(() => jest.advanceTimersByTime(SLIDE_MS));

        expect(screen.getByTestId('page')).not.toHaveClass('market-selection--closing');
    });

    it('slides down on close, showing the last open content, then unmounts once the slide ends', () => {
        const { rerender } = render(<Page is_open label='last' />);

        rerender(<Page is_open={false} label='reset' />);

        expect(screen.getByTestId('page')).toHaveClass('market-selection--closing');
        expect(screen.getByTestId('content')).toHaveTextContent('last');

        act(() => jest.advanceTimersByTime(SLIDE_MS));
        expect(screen.queryByTestId('page')).not.toBeInTheDocument();
    });

    it('reopening mid-close cancels the close', () => {
        const { rerender } = render(<Page is_open label='a' />);
        rerender(<Page is_open={false} label='a' />);
        rerender(<Page is_open label='b' />);

        act(() => jest.advanceTimersByTime(SLIDE_MS));

        expect(screen.getByTestId('page')).not.toHaveClass('market-selection--closing');
        expect(screen.getByTestId('content')).toHaveTextContent('b');
    });
});
