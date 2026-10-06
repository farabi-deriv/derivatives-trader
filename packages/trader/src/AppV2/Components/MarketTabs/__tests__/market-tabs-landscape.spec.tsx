import React from 'react';

import { render, screen } from '@testing-library/react';

import useIsPhoneLandscape from 'AppV2/Hooks/useIsPhoneLandscape';
import { TOpenMarket } from 'AppV2/Utils/open-markets-utils';

import MarketTabs from '../market-tabs';

let mockIsMobile = false;
jest.mock('@deriv-com/ui', () => ({ useDevice: () => ({ isMobile: mockIsMobile }) }));
jest.mock('AppV2/Hooks/useIsPhoneLandscape', () => jest.fn(() => false));

jest.mock('@deriv-com/quill-ui', () => ({
    ...jest.requireActual('@deriv-com/quill-ui'),
    useSnackbar: () => ({ addSnackbar: jest.fn() }),
}));

jest.mock('@deriv/stores', () => ({
    ...jest.requireActual('@deriv/stores'),
    useStore: () => ({ client: { currency: 'USD' }, portfolio: { active_positions: [] } }),
}));

jest.mock('AppV2/Utils/positions-utils', () => ({
    filterPositionsBySymbolAndTradeType: () => [],
    getTotalPositionsProfit: () => 0,
}));

jest.mock('AppV2/Hooks/useAvailableContracts', () => ({ __esModule: true, default: jest.fn(() => []) }));
jest.mock('AppV2/Hooks/useTradeTypeSymbols', () => ({
    __esModule: true,
    default: () => ({ symbols: [], underlying_symbols: [], isSymbolAvailable: () => false, isLoading: false }),
}));

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    getViewMarketsFromURL: () => false,
    removeViewMarketsFromURL: jest.fn(),
    pickDefaultSymbol: jest.fn(() => Promise.resolve('1HZ100V')),
}));

// Reassigned per test; the `mock` prefix is what lets the jest.mock factory reference it.
let mock_open_markets: TOpenMarket[] = [];

jest.mock('Stores/useTraderStores', () => ({
    useTraderStore: () => ({
        active_symbols: [],
        symbol: '1HZ100V',
        contract_type: 'accumulator',
        open_markets: mock_open_markets,
        is_selecting_market: false,
        is_automation_mode: false,
        is_automation_market_locked: false,
        automation_run_market: null,
        addOpenMarket: jest.fn(),
        removeOpenMarket: jest.fn(),
        replaceOpenMarket: jest.fn(),
        setAutomationSupportedTradeTypes: jest.fn(),
        selectMarketAndTradeType: jest.fn(),
        setReplacingMarket: jest.fn(),
        is_market_selector_open: false,
        setMarketSelectorOpen: jest.fn(),
    }),
}));

jest.mock('../../MarketSelection', () => {
    const MarketSelection = () => null;
    return MarketSelection;
});

jest.mock('../market-tab', () => {
    const MarketTab = ({ market }: { market: TOpenMarket }) => <div data-testid={`tab-${market.symbol}`} />;
    return MarketTab;
});

const mockUseIsPhoneLandscape = useIsPhoneLandscape as jest.Mock;

const THREE_MARKETS: TOpenMarket[] = [
    { symbol: '1HZ100V', contract_type: 'accumulator' },
    { symbol: '1HZ50V', contract_type: 'accumulator' },
    { symbol: '1HZ75V', contract_type: 'accumulator' },
];
const FOUR_MARKETS: TOpenMarket[] = [...THREE_MARKETS, { symbol: 'R_100', contract_type: 'accumulator' }];

describe('MarketTabs layout mode', () => {
    beforeEach(() => {
        mockIsMobile = false;
        mockUseIsPhoneLandscape.mockReturnValue(false);
        mock_open_markets = THREE_MARKETS;
    });

    it('[MTL-001] takes the icon-only strip in landscape, not the desktop tabs', () => {
        // `isMobile` is width-only and reads false at 844px, so landscape used to get the desktop
        // Chrome-style strip — 264px per tab inside ~420px, crushing every inactive tab to an icon.
        mockUseIsPhoneLandscape.mockReturnValue(true);

        render(<MarketTabs />);

        const tabs = screen.getByTestId('dt_market_tabs');
        expect(tabs).not.toHaveClass('market-tabs--desktop');
        expect(tabs).toHaveClass('market-tabs--landscape');
    });

    it('[MTL-001] keeps the desktop strip on a real desktop', () => {
        render(<MarketTabs />);

        const tabs = screen.getByTestId('dt_market_tabs');
        expect(tabs).toHaveClass('market-tabs--desktop');
        expect(tabs).not.toHaveClass('market-tabs--landscape');
    });

    it('[MTL-002] caps landscape at the phone limit of 4 tabs, not the web limit of 7', () => {
        // The cap keyed on width-only `isMobile`, so a rotated phone got the 7-tab web allowance.
        mockUseIsPhoneLandscape.mockReturnValue(true);
        mock_open_markets = FOUR_MARKETS;

        render(<MarketTabs />);

        expect(screen.getByRole('button', { name: 'Add market' })).toHaveAttribute('aria-disabled', 'true');
    });

    it('[MTL-002] still allows a 5th tab on desktop, where the limit is 7', () => {
        mock_open_markets = FOUR_MARKETS;

        render(<MarketTabs />);

        expect(screen.getByRole('button', { name: 'Add market' })).toHaveAttribute('aria-disabled', 'false');
    });

    it('[MTL-003] leaves the capped "+" tappable in landscape, so its reason can be surfaced', () => {
        // A `disabled` button explains itself on hover, which a touch device cannot do.
        mockUseIsPhoneLandscape.mockReturnValue(true);
        mock_open_markets = FOUR_MARKETS;

        render(<MarketTabs />);

        expect(screen.getByRole('button', { name: 'Add market' })).toBeEnabled();
    });

    it('[MTL-003] still natively disables the capped "+" on desktop, where hover works', () => {
        mock_open_markets = [...FOUR_MARKETS, ...FOUR_MARKETS].slice(0, 7);

        render(<MarketTabs />);

        expect(screen.getByRole('button', { name: 'Add market' })).toBeDisabled();
    });

    it('[MTL-002] leaves room below the cap in landscape', () => {
        mockUseIsPhoneLandscape.mockReturnValue(true);

        render(<MarketTabs />);

        expect(screen.getByRole('button', { name: 'Add market' })).toHaveAttribute('aria-disabled', 'false');
    });

    it('[MTL-001] keeps the plain mobile strip in portrait', () => {
        mockIsMobile = true;

        render(<MarketTabs />);

        const tabs = screen.getByTestId('dt_market_tabs');
        expect(tabs).not.toHaveClass('market-tabs--desktop');
        expect(tabs).not.toHaveClass('market-tabs--landscape');
    });
});
