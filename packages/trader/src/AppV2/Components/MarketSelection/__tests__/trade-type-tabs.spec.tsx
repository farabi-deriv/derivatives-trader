import { fireEvent, render, screen } from '@testing-library/react';

import useAvailableContracts from 'AppV2/Hooks/useAvailableContracts';

import TradeTypeTabs from '../trade-type-tabs';

jest.mock('AppV2/Hooks/useAvailableContracts', () => jest.fn());

const CONTRACTS = [
    { id: 'accumulator', tradeType: 'Accumulators', for: ['accumulator'], category: 'growth_based' },
    { id: 'rise_fall', tradeType: 'Rise/Fall', for: ['rise_fall'], category: 'directional' },
];

const renderTabs = (props = {}) =>
    render(
        <TradeTypeTabs
            selected_id='accumulator'
            onSelect={jest.fn()}
            is_favourites_selected={false}
            favourites_count={0}
            onSelectFavourites={jest.fn()}
            {...props}
        />
    );

describe('TradeTypeTabs', () => {
    beforeEach(() => {
        (useAvailableContracts as jest.Mock).mockReturnValue(CONTRACTS);
    });

    afterEach(() => jest.clearAllMocks());

    it('[LTM-008] lets the trade type be changed regardless of orientation', () => {
        // The tabs used to be disabled in landscape, since only Accumulators has a landscape layout.
        // Selecting another type now has to land: PortraitPrompt is what asks the user to rotate, and
        // it can only do that once `contract_type` has actually changed.
        const onSelect = jest.fn();
        renderTabs({ onSelect });

        const rise_fall = screen.getByRole('tab', { name: 'Rise/Fall' });
        expect(rise_fall).toBeEnabled();

        fireEvent.click(rise_fall);
        expect(onSelect).toHaveBeenCalled();
    });

    it('[LTM-008] keeps the Favourites tab available', () => {
        const onSelectFavourites = jest.fn();
        renderTabs({ onSelectFavourites });

        const favourites = screen.getByRole('tab', { name: /Favourite/ });
        expect(favourites).toBeEnabled();

        fireEvent.click(favourites);
        expect(onSelectFavourites).toHaveBeenCalled();
    });
});
