import { mockStore } from '@deriv/stores';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { getChartHeight } from 'AppV2/Utils/layout-utils';
import ModulesProvider from 'Stores/Providers/modules-providers';

import TraderProviders from '../../../../trader-providers';
import TradeLandscape from '../trade-landscape';

jest.mock('AppV2/Components/MarketTabs', () => {
    const MarketTabsStub = () => <div data-testid='market-tabs' />;
    return { __esModule: true, default: MarketTabsStub };
});
jest.mock('AppV2/Components/AccountHeader', () => {
    const AccountHeaderStub = () => <div data-testid='account-header' />;
    return { __esModule: true, default: AccountHeaderStub };
});
jest.mock('AppV2/Components/AccumulatorStats', () => {
    const AccumulatorStatsStub = () => <div data-testid='accumulator-stats' />;
    return { __esModule: true, default: AccumulatorStatsStub };
});
// The stubs capture their props: the growth-rate card's placement is a conversation between these
// two — the pill says how tall it is, the chart is told where to portal the card to — and the
// container is the only place either end can be checked.
const trade_chart_props: Record<string, unknown>[] = [];
jest.mock('../../Chart', () => {
    const TradeChartStub = (props: Record<string, unknown>) => {
        trade_chart_props.push(props);
        return <div data-testid='trade-chart' />;
    };
    return { TradeChart: TradeChartStub };
});
let reportPillHeight: ((height: number) => void) | undefined;
jest.mock('AppV2/Components/TradeParameters/Landscape/landscape-trade-params', () => {
    const LandscapeTradeParamsStub = ({ onPillHeightChange }: { onPillHeightChange?: (h: number) => void }) => {
        reportPillHeight = onPillHeightChange;
        return <div data-testid='landscape-trade-params' />;
    };
    return { __esModule: true, default: LandscapeTradeParamsStub };
});
jest.mock('AppV2/Components/LandscapeOnboarding', () => {
    const LandscapeOnboardingStub = () => <div data-testid='landscape-onboarding' />;
    return { __esModule: true, default: LandscapeOnboardingStub };
});
// This surface only ever renders on a phone in landscape; jsdom's matchMedia stub always says no.
jest.mock('AppV2/Hooks/useIsPhoneLandscape', () => jest.fn(() => true));
jest.mock('AppV2/Utils/layout-utils', () => ({
    ...jest.requireActual('AppV2/Utils/layout-utils'),
    getChartHeight: jest.fn(() => 500),
}));

const buildStore = () =>
    mockStore({
        modules: { trade: { ...mockStore({}).modules.trade, is_accumulator: true } },
    });

const renderLandscape = (store = buildStore()) => {
    render(
        <TraderProviders store={store}>
            <ModulesProvider store={store}>
                <TradeLandscape />
            </ModulesProvider>
        </TraderProviders>
    );
};

// Only a tap on the chart toggles the chrome.
const tapTheChart = () => {
    const chart = screen.getByTestId('trade-chart');
    fireEvent.pointerDown(chart, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(chart, { clientX: 100, clientY: 100 });
};

describe('TradeLandscape', () => {
    beforeEach(() => {
        trade_chart_props.length = 0;
        reportPillHeight = undefined;
    });
    afterEach(() => jest.clearAllMocks());

    it('[LTM-006] renders MarketTabs, AccountHeader, AccumulatorStats, the chart and the params slot', () => {
        renderLandscape();

        expect(screen.getByTestId('dt_trade_landscape')).toBeInTheDocument();
        expect(screen.getByTestId('market-tabs')).toBeInTheDocument();
        expect(screen.getByTestId('account-header')).toBeInTheDocument();
        expect(screen.getByTestId('accumulator-stats')).toBeInTheDocument();
        expect(screen.getByTestId('trade-chart')).toBeInTheDocument();
        expect(screen.getByTestId('landscape-trade-params')).toBeInTheDocument();
    });

    it('[LTM-006] omits OnboardingGuide, CompactHeader and TradeParametersContainer', () => {
        renderLandscape();

        // None of these are imported by trade-landscape, so their real markers are never in the tree.
        expect(screen.queryByTestId('dt_compact_header')).not.toBeInTheDocument();
        expect(screen.queryByTestId('trade-params-container')).not.toBeInTheDocument();
        expect(screen.queryByTestId('dt_onboarding_guide_video')).not.toBeInTheDocument();
    });

    it('[LTM-006] sizes the chart with CSS flex, never getChartHeight', () => {
        renderLandscape();

        expect(getChartHeight).not.toHaveBeenCalled();
    });

    it('[LPR-006] marks the rotate prompt seen, so returning to portrait does not ask again', () => {
        const store = buildStore();
        renderLandscape(store);

        expect(store.ui.setHasSeenLandscapePrompt).toHaveBeenCalledWith(true);
    });

    it('[LTM-011] a tap collapses the chrome', () => {
        const store = buildStore();
        renderLandscape(store);

        tapTheChart();

        expect(store.ui.setLandscapeChromeHidden).toHaveBeenCalledWith(true);
    });

    it('[LTM-011] but not while PortraitPrompt covers the surface — it blocks the page', () => {
        // A held selection is what puts the prompt up.
        const store = buildStore();
        store.modules.trade.pending_landscape_selection = { contract_type: 'CALL', symbol: 'R_100' };
        renderLandscape(store);

        tapTheChart();

        expect(store.ui.setLandscapeChromeHidden).not.toHaveBeenCalledWith(true);
    });

    it('[LON-004] offers the onboarding card', () => {
        renderLandscape();
        expect(screen.getByTestId('landscape-onboarding')).toBeInTheDocument();
    });

    it('[LON-004] but not under PortraitPrompt, which blocks the tap the card teaches', () => {
        const store = buildStore();
        store.modules.trade.pending_landscape_selection = { contract_type: 'CALL', symbol: 'R_100' };
        renderLandscape(store);

        expect(screen.queryByTestId('landscape-onboarding')).not.toBeInTheDocument();
    });

    describe('the growth-rate card', () => {
        it('hands the chart the page root to portal the card into', () => {
            renderLandscape();

            // `.trade__chart` clips its overflow, so a card lifted clear of the params pill would be
            // cut off at the top rather than drawn over the stats strip.
            const container = trade_chart_props.at(-1)?.growth_rate_portal_container as React.RefObject<HTMLElement>;
            expect(container.current).toBe(screen.getByTestId('dt_trade_landscape'));
        });

        it('publishes the pill height the card sits above', () => {
            renderLandscape();

            act(() => reportPillHeight?.(74));

            // The two are in different subtrees once the card is portalled, so a custom property is
            // the only way the measurement reaches it.
            expect(screen.getByTestId('dt_trade_landscape')).toHaveStyle({ '--landscape-pill-block-size': '74px' });
        });

        it('says nothing until the pill has been measured', () => {
            renderLandscape();

            // Absent rather than zero: the card's own fallback is the pill at its natural size, and a
            // 0 here would drop it onto the pill for the first paint.
            expect(screen.getByTestId('dt_trade_landscape').style.getPropertyValue('--landscape-pill-block-size')).toBe(
                ''
            );
        });
    });
});
