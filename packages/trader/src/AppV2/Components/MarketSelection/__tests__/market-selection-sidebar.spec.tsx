import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CONTRACT_LIST } from 'AppV2/Utils/trade-types-utils';

import MarketSelectionSidebar from '../market-selection-sidebar';

// The sidebar's trade-type list now comes from this hook, which fetches availability.
jest.mock('AppV2/Hooks/useAvailableContracts', () => ({
    __esModule: true,
    default: () => jest.requireActual('AppV2/Utils/trade-types-utils').AVAILABLE_CONTRACTS,
}));

jest.mock('../../Guide', () => {
    const Guide = () => <div data-testid='guide' />;
    return Guide;
});

jest.mock('../../FireIcon', () => {
    const FireIcon = () => <span data-testid='fire-icon' />;
    return FireIcon;
});

const baseProps = {
    selected_trade_type_id: CONTRACT_LIST.RISE_FALL,
    is_favourites_selected: false,
    favourites_count: 3,
    onSelectTradeType: jest.fn(),
    onSelectFavourites: jest.fn(),
};

describe('MarketSelectionSidebar', () => {
    it('renders the category groups and the trade types', () => {
        render(<MarketSelectionSidebar {...baseProps} />);
        expect(screen.getByText('Directional')).toBeInTheDocument();
        expect(screen.getByText('Growth based')).toBeInTheDocument();
        expect(screen.getByText('Digit based')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Rise\/Fall/ })).toBeInTheDocument();
    });

    it('renders the Favourite entry with its count', () => {
        render(<MarketSelectionSidebar {...baseProps} />);
        expect(screen.getByRole('button', { name: /Favourite \(3\)/ })).toBeInTheDocument();
    });

    it('marks the selected trade type as pressed', () => {
        render(<MarketSelectionSidebar {...baseProps} />);
        expect(screen.getByRole('button', { name: /Rise\/Fall/ })).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls onSelectTradeType with the contract when a trade type is clicked', async () => {
        const onSelectTradeType = jest.fn();
        render(<MarketSelectionSidebar {...baseProps} onSelectTradeType={onSelectTradeType} />);
        await userEvent.click(screen.getByRole('button', { name: /Higher\/Lower/ }));
        expect(onSelectTradeType).toHaveBeenCalledWith(expect.objectContaining({ id: CONTRACT_LIST.HIGHER_LOWER }));
    });

    it('calls onSelectFavourites when the Favourite entry is clicked', async () => {
        const onSelectFavourites = jest.fn();
        render(<MarketSelectionSidebar {...baseProps} onSelectFavourites={onSelectFavourites} />);
        await userEvent.click(screen.getByRole('button', { name: /Favourite/ }));
        expect(onSelectFavourites).toHaveBeenCalled();
    });

    it('marks Favourite (not a trade type) as pressed when favourites is selected', () => {
        render(<MarketSelectionSidebar {...baseProps} is_favourites_selected />);
        expect(screen.getByRole('button', { name: /Favourite/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: /Rise\/Fall/ })).toHaveAttribute('aria-pressed', 'false');
    });

    it('bolds the Favourite label only when favourites is selected', () => {
        const { rerender } = render(<MarketSelectionSidebar {...baseProps} />);
        expect(screen.getByText(/Favourite \(3\)/).className).not.toMatch(/weight--bold/);

        rerender(<MarketSelectionSidebar {...baseProps} is_favourites_selected />);
        expect(screen.getByText(/Favourite \(3\)/).className).toMatch(/weight--bold/);
    });

    it('renders no tooltip when with_tooltips is off, while selection still works', async () => {
        const onSelectTradeType = jest.fn();
        render(<MarketSelectionSidebar {...baseProps} onSelectTradeType={onSelectTradeType} with_tooltips={false} />);
        const item = screen.getByRole('button', { name: /Higher\/Lower/ });

        await userEvent.hover(item);
        await userEvent.click(item);

        expect(screen.queryByText(/Earn when exit price is above or below barrier/)).not.toBeInTheDocument();
        expect(onSelectTradeType).toHaveBeenCalledTimes(1);
    });

    it('restricts the trade types to supported_trade_types when provided (e.g. Automate)', () => {
        render(<MarketSelectionSidebar {...baseProps} supported_trade_types={new Set(['rise_fall'])} />);
        expect(screen.getByRole('button', { name: /Rise\/Fall/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Higher\/Lower/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Accumulators/ })).not.toBeInTheDocument();
    });
});
