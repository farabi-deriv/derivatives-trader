import React from 'react';

import { pickDefaultSymbol } from '@deriv/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { MAX_OPEN_MARKETS, TOpenMarket } from 'AppV2/Utils/open-markets-utils';

import MarketTabs from '../market-tabs';

const mockPickDefaultSymbol = pickDefaultSymbol as jest.Mock;

const mockSelect = jest.fn();
const mockAdd = jest.fn();
const mockRemove = jest.fn();
const mockReplace = jest.fn();
const mockSetSupported = jest.fn();
const mockSetReplacing = jest.fn();
let mockIsMarketSelectorOpen = false;
const mockSetMarketSelectorOpen = jest.fn((open: boolean) => {
    mockIsMarketSelectorOpen = open;
});

let mockOpenMarkets: TOpenMarket[] = [];
let mockStoreSymbol = 'frxEURUSD';
let mockStoreContractType = 'rise_fall';
let mockIsSelectingMarket = false;
// The live mode the async seed re-reads at commit time; tests flip it to model leaving Automate.
let mockIsAutomationMode = true;
let mockIsMarketLocked = false;
let mockAutomationRunMarket: { symbol: string; contract_type: string | null } | null = null;

jest.mock('@deriv-com/ui', () => ({ useDevice: () => ({ isMobile: true }) }));

// Spy on snackbars (mobile surfaces the disabled-"+" reason this way) while keeping the rest of
// quill-ui real (Tooltip, Text, …).
const mockAddSnackbar = jest.fn();
jest.mock('@deriv-com/quill-ui', () => ({
    ...jest.requireActual('@deriv-com/quill-ui'),
    useSnackbar: () => ({ addSnackbar: mockAddSnackbar }),
}));

jest.mock('@deriv/stores', () => ({
    ...jest.requireActual('@deriv/stores'),
    useStore: () => ({ client: { currency: 'USD' }, portfolio: { active_positions: [] } }),
}));

// No running positions in these tests, so the per-tab P/L is always null.
jest.mock('AppV2/Utils/positions-utils', () => ({
    filterPositionsBySymbolAndTradeType: () => [],
    getTotalPositionsProfit: () => 0,
}));

// The URL trade-type resolver runs on mount; stub its symbol fetch so it stays a no-op here (no URL
// params in jsdom → nothing to resolve).
// Called by MarketTabs purely to warm the trade-type availability lookup.
jest.mock('AppV2/Hooks/useAvailableContracts', () => ({
    __esModule: true,
    default: jest.fn(() => []),
}));

jest.mock('AppV2/Hooks/useTradeTypeSymbols', () => ({
    __esModule: true,
    default: () => ({ symbols: [], underlying_symbols: [], isSymbolAvailable: () => false, isLoading: false }),
}));

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    getViewMarketsFromURL: () => false,
    removeViewMarketsFromURL: jest.fn(),
    // A jest.fn so individual tests can defer its resolution (to reproduce the seed-vs-churn race).
    pickDefaultSymbol: jest.fn(() => Promise.resolve('1HZ100V')),
}));

jest.mock('Stores/useTraderStores', () => ({
    useTraderStore: () => ({
        active_symbols: [],
        symbol: mockStoreSymbol,
        contract_type: mockStoreContractType,
        open_markets: mockOpenMarkets,
        is_selecting_market: mockIsSelectingMarket,
        get is_automation_mode() {
            return mockIsAutomationMode;
        },
        is_automation_market_locked: mockIsMarketLocked,
        automation_run_market: mockAutomationRunMarket,
        addOpenMarket: mockAdd,
        removeOpenMarket: mockRemove,
        replaceOpenMarket: mockReplace,
        setAutomationSupportedTradeTypes: mockSetSupported,
        selectMarketAndTradeType: mockSelect,
        setReplacingMarket: mockSetReplacing,
        is_market_selector_open: mockIsMarketSelectorOpen,
        setMarketSelectorOpen: mockSetMarketSelectorOpen,
    }),
}));

// Expose whether the selector was opened so the tap-the-active-tab test can assert it.
jest.mock('../../MarketSelection', () => {
    const MarketSelection = ({ isOpen }: { isOpen: boolean }) =>
        isOpen ? <div data-testid='market-selection-open' /> : null;
    return MarketSelection;
});

// Expose the props the container computes per tab so we can assert on the removability rule, and
// wire onSelect so the tap behaviour (activate vs open-selector) can be exercised.
jest.mock('../market-tab', () => {
    const MarketTab = ({
        market,
        is_active,
        is_removable,
        is_disabled,
        opens_selector,
        onSelect,
        onRemove,
    }: TMockTab) => (
        <div
            data-testid={`tab-${market.symbol}__${market.contract_type}`}
            data-active={String(is_active)}
            data-removable={String(is_removable)}
            data-disabled={String(is_disabled)}
            data-opens-selector={String(opens_selector)}
            onClick={() => onSelect(market)}
        >
            <button
                type='button'
                data-testid={`close-${market.symbol}__${market.contract_type}`}
                onClick={event => {
                    event.stopPropagation();
                    onRemove?.(market);
                }}
            />
        </div>
    );
    return MarketTab;
});

type TMockTab = {
    market: TOpenMarket;
    is_active: boolean;
    is_removable?: boolean;
    is_disabled?: boolean;
    opens_selector?: boolean;
    onSelect: (market: TOpenMarket) => void;
    onRemove?: (market: TOpenMarket) => void;
};

const rise_market = { symbol: 'frxEURUSD', contract_type: 'rise_fall' };
const gbp_market = { symbol: 'frxGBPUSD', contract_type: 'rise_fall' };
const jpy_market = { symbol: 'frxUSDJPY', contract_type: 'rise_fall' };
const turbos_market = { symbol: 'frxGBPUSD', contract_type: 'turboslong' };

describe('MarketTabs', () => {
    beforeEach(() => {
        mockStoreSymbol = 'frxEURUSD';
        mockStoreContractType = 'rise_fall';
        mockIsSelectingMarket = false;
        mockIsAutomationMode = true;
        mockIsMarketLocked = false;
        mockAutomationRunMarket = null;
        mockIsMarketSelectorOpen = false;
    });
    afterEach(() => jest.clearAllMocks());

    it('disables the add button once the open-markets cap is reached', () => {
        mockOpenMarkets = Array.from({ length: MAX_OPEN_MARKETS }, (_, i) => ({
            symbol: `S${i}`,
            contract_type: 'rise_fall',
        }));
        // Active market already has a tab, so the seed doesn't fire a replace.
        mockStoreSymbol = 'S0';
        render(<MarketTabs />);
        // On mobile the button stays tappable (to surface the reason as a snackbar) but reads as
        // disabled via aria-disabled, rather than being natively disabled.
        expect(screen.getByRole('button', { name: 'Add market' })).toHaveAttribute('aria-disabled', 'true');
    });

    it('keeps the add button enabled below the cap', () => {
        mockOpenMarkets = [rise_market];
        render(<MarketTabs />);
        expect(screen.getByRole('button', { name: 'Add market' })).toBeEnabled();
    });

    it('on mobile, tapping the capped add button surfaces a snackbar instead of opening the selector', () => {
        mockOpenMarkets = Array.from({ length: MAX_OPEN_MARKETS }, (_, i) => ({
            symbol: `S${i}`,
            contract_type: 'rise_fall',
        }));
        mockStoreSymbol = 'S0';
        render(<MarketTabs />);
        fireEvent.click(screen.getByRole('button', { name: 'Add market' }));
        expect(mockAddSnackbar).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('up to') })
        );
        expect(mockSetMarketSelectorOpen).not.toHaveBeenCalledWith(true);
    });

    it('does not allow closing the only tradeable tab when a disabled tab is also open', () => {
        // Automate mode: only rise_fall is supported, so the Turbos tab is disabled.
        mockOpenMarkets = [rise_market, turbos_market];
        render(<MarketTabs supported_trade_types={new Set(['rise_fall'])} />);

        const rise_tab = screen.getByTestId('tab-frxEURUSD__rise_fall');
        const turbos_tab = screen.getByTestId('tab-frxGBPUSD__turboslong');
        // Sole tradeable tab is active but NOT removable.
        expect(rise_tab).toHaveAttribute('data-active', 'true');
        expect(rise_tab).toHaveAttribute('data-removable', 'false');
        // Disabled tab is greyed and never active.
        expect(turbos_tab).toHaveAttribute('data-disabled', 'true');
        expect(turbos_tab).toHaveAttribute('data-active', 'false');
    });

    it('allows closing a tradeable tab when more than one tradeable tab is open', () => {
        mockOpenMarkets = [rise_market, { symbol: 'frxUSDJPY', contract_type: 'rise_fall' }];
        render(<MarketTabs supported_trade_types={new Set(['rise_fall'])} />);
        expect(screen.getByTestId('tab-frxEURUSD__rise_fall')).toHaveAttribute('data-removable', 'true');
    });

    it('activates the right-hand neighbour when the active middle tab is closed', () => {
        mockOpenMarkets = [rise_market, gbp_market, jpy_market];
        mockStoreSymbol = 'frxGBPUSD'; // the middle tab is active
        render(<MarketTabs />);
        fireEvent.click(screen.getByTestId('close-frxGBPUSD__rise_fall'));
        expect(mockSelect).toHaveBeenCalledWith('frxUSDJPY', 'rise_fall'); // right neighbour
    });

    it('activates the left-hand neighbour when the active last tab is closed', () => {
        mockOpenMarkets = [rise_market, gbp_market, jpy_market];
        mockStoreSymbol = 'frxUSDJPY'; // the last tab is active
        render(<MarketTabs />);
        fireEvent.click(screen.getByTestId('close-frxUSDJPY__rise_fall'));
        expect(mockSelect).toHaveBeenCalledWith('frxGBPUSD', 'rise_fall'); // left neighbour
    });

    it('switches to the most-recent tradeable tab when the active market becomes unsupported', () => {
        // Active market (Turbos) is unsupported in Automate, but a Rise/Fall tab is available.
        mockStoreSymbol = turbos_market.symbol;
        mockStoreContractType = turbos_market.contract_type;
        mockOpenMarkets = [turbos_market, { symbol: 'frxAUDUSD', contract_type: 'turboslong' }, rise_market];
        render(<MarketTabs supported_trade_types={new Set(['rise_fall'])} />);
        expect(mockSelect).toHaveBeenCalledWith(rise_market.symbol, rise_market.contract_type);
    });

    it('hands the supported set to the store so unsupported tabs are guarded in Automate', () => {
        // A Turbos tab carried over/persisted into Automate would otherwise linger permanently
        // disabled (never active → its remove ✕ never shows). Passing the supported set to the store
        // lets its tab-strip writer drop/block unsupported pairs.
        mockStoreSymbol = rise_market.symbol;
        mockStoreContractType = rise_market.contract_type;
        mockOpenMarkets = [rise_market, turbos_market];
        render(<MarketTabs supported_trade_types={new Set(['rise_fall'])} />);
        expect(mockSetSupported).toHaveBeenCalledWith(new Set(['rise_fall']));
    });

    it('does not set a supported set in unfiltered (manual) mode', () => {
        mockStoreSymbol = rise_market.symbol;
        mockStoreContractType = rise_market.contract_type;
        mockOpenMarkets = [rise_market, turbos_market];
        render(<MarketTabs />);
        expect(mockSetSupported).not.toHaveBeenCalled();
    });

    it('adds a default supported market when no tradeable tab exists', async () => {
        mockStoreSymbol = turbos_market.symbol;
        mockStoreContractType = turbos_market.contract_type;
        mockOpenMarkets = [turbos_market, { symbol: 'frxAUDUSD', contract_type: 'turboslong' }];
        render(<MarketTabs supported_trade_types={new Set(['rise_fall'])} />);
        // Falls back to the app default symbol paired with a supported trade type.
        await waitFor(() => expect(mockSelect).toHaveBeenCalledWith('1HZ100V', 'rise_fall'));
    });

    it('does not hop tabs while a selection is mid-commit (regression: non-adjacent tab glitch)', () => {
        // selectMarketAndTradeType writes symbol first, then trade type, so mid-commit there's a beat
        // where the active (symbol, trade type) matches no open tab. The automation effect must not
        // react then — otherwise it hops to the last tradeable tab and hijacks the user's selection.
        mockIsSelectingMarket = true;
        mockStoreSymbol = 'frxGBPUSD'; // transient symbol, not yet an open tab
        mockStoreContractType = 'rise_fall';
        mockOpenMarkets = [
            rise_market,
            { symbol: 'frxUSDJPY', contract_type: 'rise_fall' },
            { symbol: 'frxAUDCAD', contract_type: 'rise_fall' },
        ];
        render(<MarketTabs supported_trade_types={new Set(['rise_fall'])} />);
        expect(mockSelect).not.toHaveBeenCalled();
    });

    it('does not spill the carried-over active market into a fresh automate collection', async () => {
        // Switching into Automate: the active market is still the (automation-supported) one carried
        // from manual, but the automate collection is empty. It must NOT be seeded as an automate tab
        // — automate seeds its own default instead.
        mockStoreSymbol = rise_market.symbol;
        mockStoreContractType = rise_market.contract_type; // rise_fall — a supported type
        mockOpenMarkets = [];
        render(<MarketTabs supported_trade_types={new Set(['rise_fall'])} />);
        // The default supported market is added on the app default symbol (not the carried one)...
        await waitFor(() => expect(mockSelect).toHaveBeenCalledWith('1HZ100V', 'rise_fall'));
        // ...and the carried market was never added as a tab.
        expect(mockAdd).not.toHaveBeenCalledWith(rise_market);
    });

    it('renders the same symbol under different trade types as two distinct tabs', () => {
        mockStoreSymbol = 'frxEURUSD';
        mockStoreContractType = 'high_low';
        mockOpenMarkets = [
            { symbol: 'frxEURUSD', contract_type: 'rise_fall' },
            { symbol: 'frxEURUSD', contract_type: 'high_low' },
        ];
        render(<MarketTabs />);
        // Both pair-tabs exist; only the one matching the store's trade type is active.
        expect(screen.getByTestId('tab-frxEURUSD__rise_fall')).toHaveAttribute('data-active', 'false');
        expect(screen.getByTestId('tab-frxEURUSD__high_low')).toHaveAttribute('data-active', 'true');
    });

    it('keeps the Rise/Fall tab active when the store resolves to rise_fall_equal', () => {
        // "Allow equals" turns the store's contract_type into rise_fall_equal, but the tab is always
        // recorded as the canonical rise_fall (equal is filtered out of the selectable list). The tab
        // must still read as active — matched by trade-type category, not exact value.
        mockStoreSymbol = 'frxEURUSD';
        mockStoreContractType = 'rise_fall_equal';
        mockOpenMarkets = [rise_market];
        render(<MarketTabs />);
        expect(screen.getByTestId('tab-frxEURUSD__rise_fall')).toHaveAttribute('data-active', 'true');
    });

    it('NEVER derives a tab from the active store state (root cause of phantom "random" tabs)', () => {
        // The seed effect was removed: tabs are only created explicitly (selectMarketAndTradeType /
        // resolveInitialMarket). An active pair with no matching tab must NOT grow the strip —
        // regardless of guard flags, list length, or cap.
        mockStoreSymbol = 'frxBOOM300';
        mockStoreContractType = 'rise_fall';
        mockOpenMarkets = [{ symbol: 'frxBOOM300', contract_type: 'accumulator' }];
        render(<MarketTabs />);
        expect(mockAdd).not.toHaveBeenCalled();
        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('never replaces a tab from the strip itself at the cap (explicit flows only)', () => {
        mockStoreSymbol = 'R_100';
        mockStoreContractType = 'rise_fall';
        mockOpenMarkets = Array.from({ length: MAX_OPEN_MARKETS }, (_, i) => ({
            symbol: `S${i}`,
            contract_type: 'accumulator',
        }));
        render(<MarketTabs />);
        expect(mockReplace).not.toHaveBeenCalled();
        expect(mockAdd).not.toHaveBeenCalled();
    });

    it('keeps every tab removable in manual mode (no supported filter)', () => {
        mockOpenMarkets = [rise_market, turbos_market];
        render(<MarketTabs />);
        expect(screen.getByTestId('tab-frxEURUSD__rise_fall')).toHaveAttribute('data-removable', 'true');
        expect(screen.getByTestId('tab-frxGBPUSD__turboslong')).toHaveAttribute('data-removable', 'true');
    });

    it('locks the strip during an automation run: add disabled, other tabs greyed, active tab pinned', () => {
        mockIsMarketLocked = true;
        mockStoreSymbol = rise_market.symbol;
        mockStoreContractType = rise_market.contract_type;
        mockOpenMarkets = [rise_market, turbos_market];
        render(<MarketTabs />);

        // On mobile the button stays tappable (to surface the reason as a snackbar) but reads as
        // disabled via aria-disabled, rather than being natively disabled.
        expect(screen.getByRole('button', { name: 'Add market' })).toHaveAttribute('aria-disabled', 'true');

        // Active (running) tab keeps its highlight and can't be closed — its market can't be swapped.
        const active_tab = screen.getByTestId('tab-frxEURUSD__rise_fall');
        expect(active_tab).toHaveAttribute('data-active', 'true');
        expect(active_tab).toHaveAttribute('data-disabled', 'false');
        expect(active_tab).toHaveAttribute('data-removable', 'false');
        // …but its tap can't open the selector either (handleSelect shows the locked snackbar), so it
        // must not advertise one: no chevron cue, no aria-haspopup.
        expect(active_tab).toHaveAttribute('data-opens-selector', 'false');
        // Every other tab greys out so the strip stays pinned to the running market.
        const other_tab = screen.getByTestId('tab-frxGBPUSD__turboslong');
        expect(other_tab).toHaveAttribute('data-disabled', 'true');
        expect(other_tab).toHaveAttribute('data-active', 'false');
        expect(other_tab).toHaveAttribute('data-opens-selector', 'false');
    });

    it('leaves the strip fully interactive when no run is active', () => {
        mockOpenMarkets = [rise_market, turbos_market];
        render(<MarketTabs />);
        expect(screen.getByRole('button', { name: 'Add market' })).toBeEnabled();
        expect(screen.getByTestId('tab-frxGBPUSD__turboslong')).toHaveAttribute('data-disabled', 'false');
        // The active tab's tap opens the replace-selector, so it advertises that (chevron cue).
        expect(screen.getByTestId('tab-frxEURUSD__rise_fall')).toHaveAttribute('data-opens-selector', 'true');
        expect(screen.getByTestId('tab-frxGBPUSD__turboslong')).toHaveAttribute('data-opens-selector', 'false');
    });

    it('snaps to the running market on return to the automation view after drifting in manual', () => {
        // Run is on R_100/rise_fall; the shared active market drifted to frxEURUSD while in manual.
        mockIsMarketLocked = true;
        mockAutomationRunMarket = { symbol: 'R_100', contract_type: 'rise_fall' };
        mockStoreSymbol = 'frxEURUSD';
        mockStoreContractType = 'rise_fall';
        mockOpenMarkets = [rise_market, { symbol: 'R_100', contract_type: 'rise_fall' }];
        render(<MarketTabs />);
        expect(mockSelect).toHaveBeenCalledWith('R_100', 'rise_fall');
    });

    it('snaps to the exact run tab when the symbol has several open tabs (different trade types)', () => {
        // Run is on R_50/rise_fall, but the active drifted to the R_50/accumulator tab.
        mockIsMarketLocked = true;
        mockAutomationRunMarket = { symbol: 'R_50', contract_type: 'rise_fall' };
        mockStoreSymbol = 'R_50';
        mockStoreContractType = 'accumulator';
        mockOpenMarkets = [
            { symbol: 'R_50', contract_type: 'accumulator' },
            { symbol: 'R_50', contract_type: 'match_diff' },
            { symbol: 'R_50', contract_type: 'rise_fall' },
        ];
        render(<MarketTabs />);
        expect(mockSelect).toHaveBeenCalledWith('R_50', 'rise_fall');
    });

    it('does not snap when the active market already matches the running tab', () => {
        mockIsMarketLocked = true;
        mockAutomationRunMarket = { symbol: 'frxEURUSD', contract_type: 'rise_fall' };
        mockStoreSymbol = 'frxEURUSD';
        mockStoreContractType = 'rise_fall';
        mockOpenMarkets = [rise_market];
        render(<MarketTabs />);
        expect(mockSelect).not.toHaveBeenCalled();
    });

    it('falls back to symbol-only matching when the run trade type is unknown (recovered run)', () => {
        mockIsMarketLocked = true;
        mockAutomationRunMarket = { symbol: 'R_100', contract_type: null };
        mockStoreSymbol = 'frxEURUSD';
        mockStoreContractType = 'rise_fall';
        mockOpenMarkets = [rise_market, { symbol: 'R_100', contract_type: 'accumulator' }];
        render(<MarketTabs />);
        expect(mockSelect).toHaveBeenCalledWith('R_100', 'accumulator');
    });

    it('does not snap in manual trading (no run) even if a run market is somehow set', () => {
        mockIsMarketLocked = false;
        mockAutomationRunMarket = { symbol: 'R_100', contract_type: 'rise_fall' };
        mockStoreSymbol = 'frxEURUSD';
        mockStoreContractType = 'rise_fall';
        mockOpenMarkets = [rise_market, { symbol: 'R_100', contract_type: 'rise_fall' }];
        render(<MarketTabs />);
        expect(mockSelect).not.toHaveBeenCalled();
    });

    it('activates an inactive tab on a single tap (does not open the selector)', () => {
        mockOpenMarkets = [rise_market, turbos_market];
        render(<MarketTabs />);
        fireEvent.click(screen.getByTestId('tab-frxGBPUSD__turboslong'));
        expect(mockSelect).toHaveBeenCalledWith('frxGBPUSD', 'turboslong');
        expect(screen.queryByTestId('market-selection-open')).not.toBeInTheDocument();
    });

    it('opens the selector to replace the tab when the active tab is tapped (no re-commit)', () => {
        mockOpenMarkets = [rise_market, turbos_market];
        render(<MarketTabs />);
        fireEvent.click(screen.getByTestId('tab-frxEURUSD__rise_fall'));
        expect(mockSelect).not.toHaveBeenCalled();
        expect(mockSetReplacing).toHaveBeenCalledWith(rise_market);
        // Selector open state now lives in the store, so assert the request rather than the render.
        expect(mockSetMarketSelectorOpen).toHaveBeenCalledWith(true);
    });

    it('does not open the replace selector when a tab is tapped during a run', () => {
        // The active (running) tab is the only tappable one while locked; tapping it must not open
        // the replace selector (which would let the running market be swapped out).
        mockIsMarketLocked = true;
        mockStoreSymbol = rise_market.symbol;
        mockStoreContractType = rise_market.contract_type;
        mockOpenMarkets = [rise_market, turbos_market];
        render(<MarketTabs />);
        fireEvent.click(screen.getByTestId('tab-frxEURUSD__rise_fall'));
        expect(mockSetReplacing).not.toHaveBeenCalled();
        expect(mockSelect).not.toHaveBeenCalled();
        expect(screen.queryByTestId('market-selection-open')).not.toBeInTheDocument();
    });

    it('clears a pending replace intent when the "+" control opens the selector', () => {
        mockOpenMarkets = [rise_market, turbos_market];
        render(<MarketTabs />);
        // Tap the active tab first, setting a pending "replace this tab" intent...
        fireEvent.click(screen.getByTestId('tab-frxEURUSD__rise_fall'));
        expect(mockSetReplacing).toHaveBeenCalledWith(rise_market);
        // ...then open the selector via "+" instead of completing the replace.
        fireEvent.click(screen.getByRole('button', { name: 'Add market' }));
        expect(mockSetReplacing).toHaveBeenLastCalledWith(null);
        expect(mockSetMarketSelectorOpen).toHaveBeenCalledWith(true);
    });

    // The seed is the only thing that populates an empty automation collection on first entry (#1071).
    // The store mock is non-reactive, so these stand in for the observable churn by swapping
    // `mockOpenMarkets` for a fresh equal array mid-pick and re-rendering.
    describe('first Automate entry seed (#1071)', () => {
        const supported = new Set(['rise_fall']);
        const flush = () =>
            new Promise(resolve => {
                setTimeout(resolve, 0);
            });
        // `clearAllMocks` keeps implementations and `*Once` queues, so reset what these tests reprogram.
        afterEach(() => {
            mockSelect.mockReset();
            mockPickDefaultSymbol.mockReset();
            mockPickDefaultSymbol.mockImplementation(() => Promise.resolve('1HZ100V'));
        });
        // Mirror the real store: a committed seed appends + activates the pair.
        const reflectCommit = () =>
            mockSelect.mockImplementation((symbol: string, contract_type: string) => {
                mockStoreSymbol = symbol;
                mockStoreContractType = contract_type;
                if (!mockOpenMarkets.some(market => market.symbol === symbol && market.contract_type === contract_type))
                    mockOpenMarkets = [...mockOpenMarkets, { symbol, contract_type }];
                return Promise.resolve();
            });
        // Defer the pick so churn can land mid-flight; returns the resolver to fire afterwards.
        const deferPick = () => {
            let resolvePick = (_symbol: string) => undefined as void;
            mockPickDefaultSymbol.mockReturnValueOnce(
                new Promise<string>(resolve => {
                    resolvePick = resolve;
                })
            );
            return (symbol: string) => resolvePick(symbol);
        };

        it('[MT-005] seeds one active supported default tab on first entry with an empty automation collection', async () => {
            reflectCommit();
            // Carried-over manual pair is an unsupported type; the automation collection is empty.
            mockStoreSymbol = turbos_market.symbol;
            mockStoreContractType = turbos_market.contract_type;
            mockOpenMarkets = [];
            const resolvePick = deferPick();
            const { rerender } = render(
                <MarketTabs supported_trade_types={supported} onSelectorOpenChange={() => {}} />
            );
            // Churn `open_markets` mid-pick and force the observer to re-read it.
            mockOpenMarkets = [];
            rerender(<MarketTabs supported_trade_types={supported} onSelectorOpenChange={() => {}} />);
            // The pick resolves only now — the seed must still commit it.
            resolvePick('1HZ100V');
            await waitFor(() => expect(mockSelect).toHaveBeenCalledWith('1HZ100V', 'rise_fall'));
            rerender(<MarketTabs supported_trade_types={supported} onSelectorOpenChange={() => {}} />);
            const tabs = screen.getAllByTestId(/^tab-/);
            expect(tabs).toHaveLength(1);
            expect(tabs[0]).toHaveAttribute('data-testid', 'tab-1HZ100V__rise_fall');
            expect(tabs[0]).toHaveAttribute('data-active', 'true');
        });

        it('[MT-005] still seeds a default tab when the carried-over pair is itself supported (remembered==carried)', async () => {
            // Reconciler makes no tab-creating call here, so the seed is the only thing that can run.
            reflectCommit();
            mockStoreSymbol = rise_market.symbol;
            mockStoreContractType = rise_market.contract_type; // rise_fall — supported, but no tab exists
            mockOpenMarkets = [];
            const resolvePick = deferPick();
            const { rerender } = render(
                <MarketTabs supported_trade_types={supported} onSelectorOpenChange={() => {}} />
            );
            mockOpenMarkets = [];
            rerender(<MarketTabs supported_trade_types={supported} onSelectorOpenChange={() => {}} />);
            resolvePick('1HZ100V');
            await waitFor(() => expect(mockSelect).toHaveBeenCalledWith('1HZ100V', 'rise_fall'));
        });

        it('[MT-006] the seed survives a concurrent supported-set write and still activates its tab', async () => {
            // Churn after the effect latched but before the pick resolved, simulated directly so this
            // exercises the seed's own resilience rather than the store's filter.
            reflectCommit();
            mockStoreSymbol = turbos_market.symbol;
            mockStoreContractType = turbos_market.contract_type;
            mockOpenMarkets = [];
            const resolvePick = deferPick();
            const { rerender } = render(
                <MarketTabs supported_trade_types={supported} onSelectorOpenChange={() => {}} />
            );
            // Re-render (and its cleanup) lands while the pick is still pending.
            mockOpenMarkets = [];
            rerender(<MarketTabs supported_trade_types={supported} onSelectorOpenChange={() => {}} />);
            resolvePick('1HZ100V');
            await waitFor(() => expect(mockSelect).toHaveBeenCalledWith('1HZ100V', 'rise_fall'));
            rerender(<MarketTabs supported_trade_types={supported} onSelectorOpenChange={() => {}} />);
            expect(screen.getByTestId('tab-1HZ100V__rise_fall')).toHaveAttribute('data-active', 'true');
        });

        it('[MT-007] catches a rejected seed commit and resets the latch so a later run retries', async () => {
            mockStoreSymbol = turbos_market.symbol;
            mockStoreContractType = turbos_market.contract_type;
            mockOpenMarkets = [];
            // First commit rejects (WS drop); the second succeeds.
            mockSelect.mockRejectedValueOnce(new Error('WS dropped')).mockResolvedValue(undefined);
            const { rerender } = render(
                <MarketTabs supported_trade_types={supported} onSelectorOpenChange={() => {}} />
            );
            await waitFor(() => expect(mockSelect).toHaveBeenCalledTimes(1));
            // Let the rejection's .catch() release the latch.
            await flush();
            // A later run must be able to retry: the latch was released, not left set forever.
            mockOpenMarkets = [];
            rerender(<MarketTabs supported_trade_types={supported} onSelectorOpenChange={() => {}} />);
            await waitFor(() => expect(mockSelect).toHaveBeenCalledTimes(2));
        });

        // Drives `cycles` churn cycles, chained so each observes the previous attempt's rejection.
        const churn = (rerender: (ui: React.ReactElement) => void, cycles: number) =>
            Array.from({ length: cycles }).reduce(
                (chain: Promise<unknown>) =>
                    chain
                        .then(flush)
                        .then(() => {
                            mockOpenMarkets = [];
                            rerender(<MarketTabs supported_trade_types={supported} onSelectorOpenChange={() => {}} />);
                        })
                        .then(flush),
                Promise.resolve() as Promise<unknown>
            );

        it('[MT-007] stops retrying the seed after MAX_SEED_ATTEMPTS consecutive failed commits', async () => {
            mockStoreSymbol = turbos_market.symbol;
            mockStoreContractType = turbos_market.contract_type;
            mockOpenMarkets = [];
            // Every commit rejects, so the .catch() releases the latch each time.
            mockSelect.mockRejectedValue(new Error('WS dropped'));
            const { rerender } = render(
                <MarketTabs supported_trade_types={supported} onSelectorOpenChange={() => {}} />
            );
            await waitFor(() => expect(mockSelect).toHaveBeenCalledTimes(1));
            // More churn than the cap allows: attempts stop at three.
            await churn(rerender, 5);
            expect(mockSelect).toHaveBeenCalledTimes(3);
        });

        it('[MT-007] restores the seed budget when Automate is left and re-entered', async () => {
            mockStoreSymbol = turbos_market.symbol;
            mockStoreContractType = turbos_market.contract_type;
            mockOpenMarkets = [];
            mockSelect.mockRejectedValue(new Error('WS dropped'));
            const { rerender } = render(
                <MarketTabs supported_trade_types={supported} onSelectorOpenChange={() => {}} />
            );
            await waitFor(() => expect(mockSelect).toHaveBeenCalledTimes(1));
            await churn(rerender, 5);
            expect(mockSelect).toHaveBeenCalledTimes(3); // budget spent
            // Leaving Automate clears the supported set, resetting the latch and the budget.
            rerender(<MarketTabs supported_trade_types={undefined} onSelectorOpenChange={() => {}} />);
            await flush();
            mockSelect.mockReset();
            mockSelect.mockResolvedValue(undefined);
            mockOpenMarkets = [];
            rerender(<MarketTabs supported_trade_types={supported} onSelectorOpenChange={() => {}} />);
            await waitFor(() => expect(mockSelect).toHaveBeenCalledWith('1HZ100V', 'rise_fall'));
        });

        it('[MT-009] does not commit the seed once the strip has unmounted (mobile: leaving /automate)', async () => {
            mockStoreSymbol = turbos_market.symbol;
            mockStoreContractType = turbos_market.contract_type;
            mockOpenMarkets = [];
            const resolvePick = deferPick();
            const { unmount } = render(
                <MarketTabs supported_trade_types={supported} onSelectorOpenChange={() => {}} />
            );
            // Unmounting means no further render, so a ref mirroring props would stay stale — the
            // commit has to consult the store's live mode.
            unmount();
            mockIsAutomationMode = false;
            resolvePick('1HZ100V');
            await flush();
            // Committing now would land in the MANUAL collection and overwrite the user's market.
            expect(mockSelect).not.toHaveBeenCalled();
        });

        it('[MT-009] does not commit the seed once Automate is left with the strip still mounted (desktop panel switch)', async () => {
            mockStoreSymbol = turbos_market.symbol;
            mockStoreContractType = turbos_market.contract_type;
            mockOpenMarkets = [];
            const resolvePick = deferPick();
            const { rerender } = render(
                <MarketTabs supported_trade_types={supported} onSelectorOpenChange={() => {}} />
            );
            // Desktop keeps the strip mounted; switching panel tab clears the set and flips the mode.
            rerender(<MarketTabs supported_trade_types={undefined} onSelectorOpenChange={() => {}} />);
            mockIsAutomationMode = false;
            resolvePick('1HZ100V');
            await flush();
            expect(mockSelect).not.toHaveBeenCalled();
        });

        it('[MT-005] does not seed or duplicate a tab when a supported market is already active (characterization)', async () => {
            // Already-active supported tab → no seed. Regression guard, green on master too.
            mockStoreSymbol = rise_market.symbol;
            mockStoreContractType = rise_market.contract_type;
            mockOpenMarkets = [rise_market];
            render(<MarketTabs supported_trade_types={supported} />);
            await flush();
            expect(mockSelect).not.toHaveBeenCalled();
        });
    });
});
