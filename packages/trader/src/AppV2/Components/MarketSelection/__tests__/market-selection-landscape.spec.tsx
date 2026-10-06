import { mockStore, StoreProvider } from '@deriv/stores';
import { render, screen } from '@testing-library/react';

import MarketSelectionHeader from '../market-selection-header';
import MarketSelectionMobile from '../market-selection-mobile';
import MarketSelectionSidebar from '../market-selection-sidebar';

jest.mock('../market-selection-sidebar', () => jest.fn(() => <div data-testid='sidebar' />));
jest.mock('../trade-type-tabs', () => jest.fn(() => <div data-testid='trade-type-tabs' />));
jest.mock('../market-category-chips', () => jest.fn(() => <div data-testid='chips' />));
jest.mock('../market-selection-list', () => jest.fn(() => <div data-testid='list' />));
jest.mock('../discovery-view', () => jest.fn(() => <div data-testid='discovery' />));
jest.mock('../market-selection-header', () =>
    jest.fn(({ onGuide }: { onGuide?: () => void }) => (
        <div data-testid='header' data-routes-guide={String(Boolean(onGuide))} />
    ))
);
jest.mock('../../Guide', () => jest.fn(() => <div data-testid='guide-page' />));
jest.mock('../market-info-screen', () => jest.fn(() => <div data-testid='info' />));

const mockToggleGuide = jest.fn();
const mockHandleClose = jest.fn();
let mock_is_guide_open = false;
let mock_info_item: { underlying_symbol: string } | null = null;

jest.mock('AppV2/Hooks/useMarketSelection', () => ({
    __esModule: true,
    default: () => ({
        is_guide_open: mock_is_guide_open,
        toggleGuide: mockToggleGuide,
        handleClose: mockHandleClose,
        info_item: mock_info_item,
        current_trade_type: 'accumulator',
        selected_category: 'all',
        setSelectedCategory: jest.fn(),
        is_favourites_tab: false,
        setIsFavouritesTab: jest.fn(),
        is_searching: false,
        setIsSearching: jest.fn(),
        setInfoSymbol: jest.fn(),
        showInfo: jest.fn(),
        list_window: '5m',
        setListWindow: jest.fn(),
        symbols: [],
        isLoading: false,
        favourites: [],
        categories: [],
        favourite_groups: [],
        visible_symbols: [],
        change_by_symbol: {},
        series_by_symbol: {},
        revealListSymbols: jest.fn(),
        show_discovery: false,
        symbols_by_trade_type: {},
        is_all_symbols_loading: false,
        handleSelectSymbol: jest.fn(),
        handleSelectFavourite: jest.fn(),
        handleSelectSymbolForTradeType: jest.fn(),
        handleSelectTradeType: jest.fn(),
    }),
}));

const renderShell = (is_landscape?: boolean) =>
    render(
        <StoreProvider store={mockStore({})}>
            <MarketSelectionMobile isOpen setIsOpen={jest.fn()} is_landscape={is_landscape} />
        </StoreProvider>
    );

const headerProps = () => (MarketSelectionHeader as jest.Mock).mock.lastCall[0];

describe('Market selection landscape layout', () => {
    beforeEach(() => {
        mock_is_guide_open = false;
        mock_info_item = null;
    });

    it('[MSL-001] lays the trade types out in a sidebar, not stacked tabs', () => {
        renderShell(true);

        // 390px of height has no room for a row of tabs above the list, so they move beside it.
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
        expect(screen.queryByTestId('trade-type-tabs')).not.toBeInTheDocument();
    });

    it('[MSL-001] switches the sidebar tooltips off, matching portrait, which has none', () => {
        renderShell(true);

        expect((MarketSelectionSidebar as jest.Mock).mock.lastCall[0]).toEqual(
            expect.objectContaining({ with_tooltips: false })
        );
    });

    it('[MSL-001] keeps stacked tabs in portrait', () => {
        renderShell(false);

        expect(screen.getByTestId('trade-type-tabs')).toBeInTheDocument();
        expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    });

    it('[MSL-003] routes the header Guide press back to the shell in landscape', () => {
        // Landscape renders the guide as a page here, so the header must hand the press up rather
        // than letting Guide open its own overlay.
        renderShell(true);
        expect(screen.getByTestId('header')).toHaveAttribute('data-routes-guide', 'true');
    });

    it('[MSL-003] leaves the Guide to its own overlay in portrait', () => {
        renderShell(false);
        expect(screen.getByTestId('header')).toHaveAttribute('data-routes-guide', 'false');
    });

    it('[MSL-003] gives the landscape guide page its own Close-only header, over the selector one', () => {
        // Its own header lets the page slide up over the selector's, rather than stopping under it.
        mock_is_guide_open = true;
        renderShell(true);

        expect(screen.getByTestId('dt_market_selection_guide')).toContainElement(screen.getByTestId('guide-page'));
        expect(screen.getAllByTestId('header')).toHaveLength(2);
        expect(headerProps().onSearch).toBeUndefined();
    });

    it('[MSL-003] lays the guide page over the columns, which stay mounted beneath it', () => {
        mock_is_guide_open = true;
        renderShell(true);

        expect(screen.getByTestId('guide-page')).toBeInTheDocument();
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
        expect(screen.getByTestId('list')).toBeInTheDocument();
    });

    it.each([true, false])(
        'lays the info page over the selector, which stays mounted (landscape: %s)',
        is_landscape => {
            mock_info_item = { underlying_symbol: 'R_100' };
            renderShell(is_landscape);

            expect(screen.getByTestId('info')).toBeInTheDocument();
            expect(screen.getByTestId('list')).toBeInTheDocument();
        }
    );

    it('[MSL-003] steps the guide page ✕ back to the selector, while the selector ✕ still closes', () => {
        mock_is_guide_open = true;
        renderShell(true);

        const [selector_header, guide_header] = (MarketSelectionHeader as jest.Mock).mock.calls
            .slice(-2)
            .map(([props]) => props);
        expect(guide_header.onClose).toBe(mockToggleGuide);
        expect(selector_header).toEqual(
            expect.objectContaining({ onClose: mockHandleClose, onSearch: expect.any(Function) })
        );
    });

    it('[MSL-002] shares the header and browse content across both layouts', () => {
        renderShell(true);

        expect(screen.getByTestId('header')).toBeInTheDocument();
        expect(screen.getByTestId('chips')).toBeInTheDocument();
        expect(screen.getByTestId('list')).toBeInTheDocument();
    });
});
