import { ReportsStoreProvider } from '@deriv/reports/src/Stores/useReportsStores';
import { TRADE_TYPES } from '@deriv/shared';
import { mockStore } from '@deriv/stores';
import { render, screen } from '@testing-library/react';

import ModulesProvider from 'Stores/Providers/modules-providers';

import TraderProviders from '../../../../trader-providers';
import TradeParameters from '../trade-parameters';

const TRADE_PARAMS = {
    ALLOW_EQUALS: 'AllowEquals',
    DURATION: 'Duration',
    STAKE: 'Stake',
    BARRIER: 'Barrier',
    GROWTH_RATE: 'GrowthRate',
    TAKE_PROFIT: 'TakeProfit',
    ACCUMULATORS_INFORMATION: 'AccumulatorsInformation',
    MULTIPLIER: 'Multiplier',
    RISK_MANAGEMENT: 'RiskManagement',
    MULTIPLIERS_CANCELLATION_INFO: 'MultipliersDealCancellationInfo',
    TRADE_TYPE_TABS: 'TradeTypeTabs',
    STRIKE: 'Strike',
    PAYOUT_PER_POINT: 'PayoutPerPoint',
    PAYOUT: 'payout',
    LAST_DIGIT_PREDICTION: 'LastDigitPrediction',
};
const data_test = 'dt_trade_param';
const skeleton_test_id = 'dt_trade_param_skeleton';

jest.mock('../AllowEquals', () => jest.fn(() => <div data-testid={data_test}>{TRADE_PARAMS.ALLOW_EQUALS}</div>));
jest.mock('../Duration', () => jest.fn(() => <div data-testid={data_test}>{TRADE_PARAMS.DURATION}</div>));
jest.mock('../Stake', () => jest.fn(() => <div data-testid={data_test}>{TRADE_PARAMS.STAKE}</div>));
jest.mock('../Barrier', () => jest.fn(() => <div data-testid={data_test}>{TRADE_PARAMS.BARRIER}</div>));
jest.mock('../GrowthRate', () => jest.fn(() => <div data-testid={data_test}>{TRADE_PARAMS.GROWTH_RATE}</div>));
jest.mock('../TakeProfit', () => jest.fn(() => <div data-testid={data_test}>{TRADE_PARAMS.TAKE_PROFIT}</div>));
jest.mock('../AccumulatorsInformation', () =>
    jest.fn(() => <div data-testid={data_test}>{TRADE_PARAMS.ACCUMULATORS_INFORMATION}</div>)
);
jest.mock('../Multiplier', () => jest.fn(() => <div data-testid={data_test}>{TRADE_PARAMS.MULTIPLIER}</div>));
jest.mock('../RiskManagement', () => jest.fn(() => <div data-testid={data_test}>{TRADE_PARAMS.RISK_MANAGEMENT}</div>));
jest.mock('../MultipliersDealCancellationInfo', () =>
    jest.fn(() => <div data-testid={data_test}>{TRADE_PARAMS.MULTIPLIERS_CANCELLATION_INFO}</div>)
);
jest.mock('../TradeTypeTabs', () => jest.fn(() => <div data-testid={data_test}>{TRADE_PARAMS.TRADE_TYPE_TABS}</div>));
jest.mock('../Strike', () => jest.fn(() => <div data-testid={data_test}>{TRADE_PARAMS.STRIKE}</div>));
jest.mock('../PayoutPerPoint', () => jest.fn(() => <div data-testid={data_test}>{TRADE_PARAMS.PAYOUT_PER_POINT}</div>));
jest.mock('../PayoutInfo', () => jest.fn(() => <div data-testid={data_test}>{TRADE_PARAMS.PAYOUT}</div>));
jest.mock('../LastDigitPrediction', () =>
    jest.fn(() => <div data-testid={data_test}>{TRADE_PARAMS.LAST_DIGIT_PREDICTION}</div>)
);

describe('TradeParameters', () => {
    let default_mock_store: ReturnType<typeof mockStore>;

    beforeEach(() => (default_mock_store = mockStore({})));

    const mockTradeParameters = () => {
        return (
            <TraderProviders store={default_mock_store}>
                <ReportsStoreProvider>
                    <ModulesProvider store={default_mock_store}>
                        <TradeParameters />
                    </ModulesProvider>
                </ReportsStoreProvider>
            </TraderProviders>
        );
    };

    it('renders correct trade params for Accumulators', () => {
        default_mock_store.modules.trade.contract_type = TRADE_TYPES.ACCUMULATOR;
        render(mockTradeParameters());

        expect(screen.getByText(TRADE_PARAMS.GROWTH_RATE)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.STAKE)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.TAKE_PROFIT)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.ACCUMULATORS_INFORMATION)).toBeInTheDocument();
        expect(screen.getAllByTestId(data_test)).toHaveLength(4);
    });

    it('renders correct trade params for Vanillas', () => {
        default_mock_store.modules.trade.contract_type = TRADE_TYPES.VANILLA.CALL;
        render(mockTradeParameters());

        expect(screen.getByText(TRADE_PARAMS.TRADE_TYPE_TABS)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.DURATION)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.STRIKE)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.STAKE)).toBeInTheDocument();
        expect(screen.getAllByTestId(data_test)).toHaveLength(4);
    });

    it('renders correct trade params for Turbos', () => {
        default_mock_store.modules.trade.contract_type = TRADE_TYPES.TURBOS.LONG;
        render(mockTradeParameters());

        expect(screen.getByText(TRADE_PARAMS.TRADE_TYPE_TABS)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.DURATION)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.PAYOUT_PER_POINT)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.STAKE)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.TAKE_PROFIT)).toBeInTheDocument();
        expect(screen.getAllByTestId(data_test)).toHaveLength(5);
    });

    it('renders correct trade params for Multipliers if has_cancellation === false', () => {
        default_mock_store.modules.trade.contract_type = TRADE_TYPES.MULTIPLIER;
        render(mockTradeParameters());

        expect(screen.getByText(TRADE_PARAMS.TRADE_TYPE_TABS)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.MULTIPLIER)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.STAKE)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.RISK_MANAGEMENT)).toBeInTheDocument();
        expect(screen.queryByText(TRADE_PARAMS.MULTIPLIERS_CANCELLATION_INFO)).not.toBeInTheDocument();
        expect(screen.getAllByTestId(data_test)).toHaveLength(4);
    });

    it('renders correct trade params for Multipliers if has_cancellation === true', () => {
        default_mock_store.modules.trade.contract_type = TRADE_TYPES.MULTIPLIER;
        default_mock_store.modules.trade.has_cancellation = true;
        render(mockTradeParameters());

        expect(screen.getByText(TRADE_PARAMS.TRADE_TYPE_TABS)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.MULTIPLIER)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.STAKE)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.RISK_MANAGEMENT)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.MULTIPLIERS_CANCELLATION_INFO)).toBeInTheDocument();
        expect(screen.getAllByTestId(data_test)).toHaveLength(5);
    });

    it('renders correct trade params for Rise/Fall', () => {
        default_mock_store.modules.trade.contract_type = TRADE_TYPES.RISE_FALL;
        render(mockTradeParameters());

        expect(screen.getByText(TRADE_PARAMS.TRADE_TYPE_TABS)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.DURATION)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.STAKE)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.ALLOW_EQUALS)).toBeInTheDocument();
        expect(screen.getAllByTestId(data_test)).toHaveLength(4);
    });

    it('renders correct trade params for Rise/Fall if is_minimized and is_market_closed  === true', () => {
        default_mock_store.modules.trade.contract_type = TRADE_TYPES.RISE_FALL;
        default_mock_store.modules.trade.is_market_closed = true;
        render(mockTradeParameters());

        expect(screen.getByText(TRADE_PARAMS.TRADE_TYPE_TABS)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.DURATION)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.STAKE)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.ALLOW_EQUALS)).toBeInTheDocument();
        expect(screen.getAllByTestId(data_test)).toHaveLength(4);
    });

    it('renders correct trade params for Higher/Lower', () => {
        default_mock_store.modules.trade.contract_type = TRADE_TYPES.HIGH_LOW;
        render(mockTradeParameters());

        expect(screen.getByText(TRADE_PARAMS.TRADE_TYPE_TABS)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.DURATION)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.BARRIER)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.STAKE)).toBeInTheDocument();
        expect(screen.getAllByTestId(data_test)).toHaveLength(4);
    });

    it('renders correct trade params for Touch/No Touch', () => {
        default_mock_store.modules.trade.contract_type = TRADE_TYPES.TOUCH;
        render(mockTradeParameters());

        expect(screen.getByText(TRADE_PARAMS.TRADE_TYPE_TABS)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.DURATION)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.BARRIER)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.STAKE)).toBeInTheDocument();
        expect(screen.getAllByTestId(data_test)).toHaveLength(4);
    });

    it('renders correct trade params for Matches/Differs', () => {
        default_mock_store.modules.trade.contract_type = TRADE_TYPES.MATCH_DIFF;
        render(mockTradeParameters());

        expect(screen.getByText(TRADE_PARAMS.TRADE_TYPE_TABS)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.LAST_DIGIT_PREDICTION)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.DURATION)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.STAKE)).toBeInTheDocument();
        expect(screen.getAllByTestId(data_test)).toHaveLength(4);
    });

    it('renders correct trade params for Even/Odd', () => {
        default_mock_store.modules.trade.contract_type = TRADE_TYPES.EVEN_ODD;
        render(mockTradeParameters());

        expect(screen.getByText(TRADE_PARAMS.TRADE_TYPE_TABS)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.DURATION)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.STAKE)).toBeInTheDocument();
        expect(screen.getAllByTestId(data_test)).toHaveLength(3);
    });

    it('renders correct trade params for Over/Under', () => {
        default_mock_store.modules.trade.contract_type = TRADE_TYPES.OVER_UNDER;
        render(mockTradeParameters());

        expect(screen.getByText(TRADE_PARAMS.TRADE_TYPE_TABS)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.LAST_DIGIT_PREDICTION)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.DURATION)).toBeInTheDocument();
        expect(screen.getByText(TRADE_PARAMS.STAKE)).toBeInTheDocument();
        expect(screen.getAllByTestId(data_test)).toHaveLength(4);
    });

    describe('while the newly opened tab is still waiting on its first proposal', () => {
        beforeEach(() => {
            default_mock_store.modules.trade.is_awaiting_contracts_for = true;
        });

        // The minimized row resets its scroll on mount, which jsdom doesn't implement.
        beforeEach(() => {
            HTMLDivElement.prototype.scrollTo = jest.fn();
        });
        afterEach(() => {
            delete (HTMLDivElement.prototype as Partial<HTMLDivElement>).scrollTo;
        });

        const renderMinimized = () =>
            render(
                <TraderProviders store={default_mock_store}>
                    <ReportsStoreProvider>
                        <ModulesProvider store={default_mock_store}>
                            <TradeParameters is_minimized />
                        </ModulesProvider>
                    </ReportsStoreProvider>
                </TraderProviders>
            );

        it('stands a skeleton in for every param chip of the trade type, whatever the trade type is', () => {
            default_mock_store.modules.trade.contract_type = TRADE_TYPES.TURBOS.LONG;
            render(mockTradeParameters());

            // Duration, Payout per point, Stake and Take profit — none of them showing a value
            // carried over from the tab the user just left.
            expect(screen.getAllByTestId(skeleton_test_id)).toHaveLength(4);
            expect(screen.queryByText(TRADE_PARAMS.DURATION)).not.toBeInTheDocument();
            expect(screen.queryByText(TRADE_PARAMS.PAYOUT_PER_POINT)).not.toBeInTheDocument();
            expect(screen.queryByText(TRADE_PARAMS.STAKE)).not.toBeInTheDocument();
            expect(screen.queryByText(TRADE_PARAMS.TAKE_PROFIT)).not.toBeInTheDocument();
        });

        it('matches the skeleton count to the params the trade type actually shows', () => {
            default_mock_store.modules.trade.contract_type = TRADE_TYPES.ACCUMULATOR;
            render(mockTradeParameters());

            // Growth rate, Stake and Take profit — Accumulators has no duration or barrier.
            expect(screen.getAllByTestId(skeleton_test_id)).toHaveLength(3);
        });

        it('keeps the trade type tabs live so the sub-type can still be switched', () => {
            default_mock_store.modules.trade.contract_type = TRADE_TYPES.RISE_FALL;
            render(mockTradeParameters());

            expect(screen.getByText(TRADE_PARAMS.TRADE_TYPE_TABS)).toBeInTheDocument();
        });

        it('leaves the information rows to their own loading states', () => {
            default_mock_store.modules.trade.contract_type = TRADE_TYPES.MULTIPLIER;
            default_mock_store.modules.trade.has_cancellation = true;
            render(mockTradeParameters());

            expect(screen.getByText(TRADE_PARAMS.MULTIPLIERS_CANCELLATION_INFO)).toBeInTheDocument();
            expect(screen.getAllByTestId(skeleton_test_id)).toHaveLength(3);
        });

        it('skeletons only the chips for Rise/Fall, leaving the Allow equals toggle live', () => {
            default_mock_store.modules.trade.contract_type = TRADE_TYPES.RISE_FALL;
            render(mockTradeParameters());

            // Duration and Stake only. Allow equals is a toggle row rather than a chip here, and
            // drops out entirely for durations that don't offer it — a third skeleton would be
            // standing in for something the real row is not going to show.
            expect(screen.getAllByTestId(skeleton_test_id)).toHaveLength(2);
            expect(screen.getByText(TRADE_PARAMS.ALLOW_EQUALS)).toBeInTheDocument();
        });

        it('keeps the inline digit grid live and skeletons only the chips beside it', () => {
            default_mock_store.modules.trade.contract_type = TRADE_TYPES.MATCH_DIFF;
            render(mockTradeParameters());

            // Duration and Stake only: the digit grid is not a chip in the params sheet, and its
            // values come from ticks rather than the proposal.
            expect(screen.getAllByTestId(skeleton_test_id)).toHaveLength(2);
            expect(screen.getByText(TRADE_PARAMS.LAST_DIGIT_PREDICTION)).toBeInTheDocument();
        });

        it('skeletons the last digit prediction where it renders as a chip', () => {
            default_mock_store.modules.trade.contract_type = TRADE_TYPES.MATCH_DIFF;
            renderMinimized();

            // Minimized, the digit grid collapses into a field, so it is a chip like the rest:
            // Last digit prediction, Duration and Stake.
            expect(screen.getAllByTestId(skeleton_test_id)).toHaveLength(3);
            expect(screen.queryByText(TRADE_PARAMS.LAST_DIGIT_PREDICTION)).not.toBeInTheDocument();
        });

        it('restores the params once the proposal has been answered', () => {
            default_mock_store.modules.trade.is_awaiting_contracts_for = false;
            default_mock_store.modules.trade.contract_type = TRADE_TYPES.TURBOS.LONG;
            render(mockTradeParameters());

            expect(screen.queryByTestId(skeleton_test_id)).not.toBeInTheDocument();
            expect(screen.getByText(TRADE_PARAMS.STAKE)).toBeInTheDocument();
        });
    });

    it('should reset scroll position to start when contract type changes in minimized mode', () => {
        // Mock scrollTo function
        const mockScrollTo = jest.fn();
        HTMLDivElement.prototype.scrollTo = mockScrollTo;

        // Create initial store with Turbos
        const store1 = mockStore({});
        store1.modules.trade.contract_type = TRADE_TYPES.TURBOS.LONG;

        const { unmount } = render(
            <TraderProviders store={store1}>
                <ReportsStoreProvider>
                    <ModulesProvider store={store1}>
                        <TradeParameters is_minimized />
                    </ModulesProvider>
                </ReportsStoreProvider>
            </TraderProviders>
        );

        // Clear initial render calls
        mockScrollTo.mockClear();

        // Unmount and render with new store and different contract type
        unmount();

        const store2 = mockStore({});
        store2.modules.trade.contract_type = TRADE_TYPES.MULTIPLIER;

        render(
            <TraderProviders store={store2}>
                <ReportsStoreProvider>
                    <ModulesProvider store={store2}>
                        <TradeParameters is_minimized />
                    </ModulesProvider>
                </ReportsStoreProvider>
            </TraderProviders>
        );

        // Verify scrollTo was called with smooth behavior
        expect(mockScrollTo).toHaveBeenCalledWith({
            left: 0,
            behavior: 'smooth',
        });

        // Cleanup
        delete (HTMLDivElement.prototype as any).scrollTo;
    });

    it('should not reset scroll position when contract type changes in expanded mode', () => {
        // Mock scrollTo function
        const mockScrollTo = jest.fn();
        HTMLDivElement.prototype.scrollTo = mockScrollTo;

        // Create initial store with Turbos
        const store1 = mockStore({});
        store1.modules.trade.contract_type = TRADE_TYPES.TURBOS.LONG;

        const { unmount } = render(
            <TraderProviders store={store1}>
                <ReportsStoreProvider>
                    <ModulesProvider store={store1}>
                        <TradeParameters is_minimized={false} />
                    </ModulesProvider>
                </ReportsStoreProvider>
            </TraderProviders>
        );

        // Clear initial render calls
        mockScrollTo.mockClear();

        // Unmount and render with new store and different contract type
        unmount();

        const store2 = mockStore({});
        store2.modules.trade.contract_type = TRADE_TYPES.MULTIPLIER;

        render(
            <TraderProviders store={store2}>
                <ReportsStoreProvider>
                    <ModulesProvider store={store2}>
                        <TradeParameters is_minimized={false} />
                    </ModulesProvider>
                </ReportsStoreProvider>
            </TraderProviders>
        );

        // Verify scrollTo was NOT called in expanded mode
        expect(mockScrollTo).not.toHaveBeenCalled();

        // Cleanup
        delete (HTMLDivElement.prototype as any).scrollTo;
    });
});
