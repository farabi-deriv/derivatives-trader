import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import MarketSelectionHeader from '../market-selection-header';

jest.mock('../../Guide', () => {
    const Guide = ({ onTriggerClick }: { onTriggerClick?: () => void }) => (
        <button type='button' data-testid='guide' onClick={onTriggerClick}>
            {onTriggerClick ? 'routed' : 'own-overlay'}
        </button>
    );
    return Guide;
});

describe('MarketSelectionHeader', () => {
    it('renders Close, Guide and Search controls', () => {
        render(<MarketSelectionHeader onClose={jest.fn()} onSearch={jest.fn()} />);
        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
        expect(screen.getByTestId('guide')).toBeInTheDocument();
    });

    it('uses the same Guide trigger in landscape, with the press routed to the shell', async () => {
        // The trigger stays portrait's; only the press is routed.
        const onGuide = jest.fn();
        render(<MarketSelectionHeader onClose={jest.fn()} onSearch={jest.fn()} onGuide={onGuide} />);

        expect(screen.getByTestId('guide')).toHaveTextContent('routed');
        await userEvent.click(screen.getByTestId('guide'));

        expect(onGuide).toHaveBeenCalled();
    });

    it('leaves the Guide to open its own description when the host renders no guide page', () => {
        render(<MarketSelectionHeader onClose={jest.fn()} onSearch={jest.fn()} />);

        expect(screen.getByTestId('guide')).toHaveTextContent('own-overlay');
    });

    it('renders only Close without a search handler', () => {
        render(<MarketSelectionHeader onClose={jest.fn()} />);
        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Search' })).not.toBeInTheDocument();
        expect(screen.queryByTestId('guide')).not.toBeInTheDocument();
    });

    it('calls onClose and onSearch', async () => {
        const onClose = jest.fn();
        const onSearch = jest.fn();
        render(<MarketSelectionHeader onClose={onClose} onSearch={onSearch} />);
        await userEvent.click(screen.getByRole('button', { name: 'Close' }));
        await userEvent.click(screen.getByRole('button', { name: 'Search' }));
        expect(onClose).toHaveBeenCalled();
        expect(onSearch).toHaveBeenCalled();
    });
});
