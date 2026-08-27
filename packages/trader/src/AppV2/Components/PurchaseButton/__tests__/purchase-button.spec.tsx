import React from 'react';

import { ReportsStoreProvider } from '@deriv/reports/src/Stores/useReportsStores';
import { CONTRACT_TYPES, mockContractInfo, TRADE_TYPES } from '@deriv/shared';
import { mockStore } from '@deriv/stores';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ERROR_SNACKBAR_DURATION } from 'AppV2/Utils/layout-utils';
import ModulesProvider from 'Stores/Providers/modules-providers';

import TraderProviders from '../../../../trader-providers';
import PurchaseButton from '../purchase-button';

const mockAddSnackbar = jest.fn();
jest.mock('@deriv-com/quill-ui', () => ({
    ...jest.requireActual('@deriv-com/quill-ui'),
    useSnackbar: jest.fn(() => ({ addSnackbar: mockAddSnackbar })),
}));

// Mock WebSocket from @deriv/shared
const mockWS = {
    authorized: {
        send: jest.fn(() => Promise.resolve({})),
    },
    send: jest.fn(() => Promise.resolve({})),
};

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    WS: mockWS,
}));

// Mock useContractsFor hook to avoid WS dependency
jest.mock('AppV2/Hooks/useContractsFor', () => ({
    __esModule: true,
    default: jest.fn(() => [
        { text: 'Rise/Fall', value: 'rise_fall' },
        { text: 'Higher/Lower', value: 'high_low' },
        { text: 'Multipliers', value: 'multiplier' },
    ]),
}));

describe('PositionsContent', () => {
    let default_mock_store: ReturnType<typeof mockStore>;

    // Guard against a fake-timer test leaking into later tests (which would hang userEvent)
    afterEach(() => {
        jest.useRealTimers();
    });

    beforeEach(() => {
        mockAddSnackbar.mockClear();
        default_mock_store = mockStore({
            portfolio: {
                all_positions: [
                    {
                        contract_info: {
                            ...mockContractInfo({
                                contract_id: 243687440268,
                                contract_type: 'MULTUP',
                                multiplier: 100,
                            }),
                        },
                        details:
                            "If you select 'Up', your total profit/loss will be the percentage increase in Volatility 100 (1s) Index, multiplied by 1000, minus commissions.",
                        display_name: '',
                        id: 243687440268,
                        indicative: 41.4,
                        purchase: 10,
                        reference: 486015531488,
                        type: 'MULTUP',
                        contract_update: {
                            stop_out: {
                                display_name: 'Stop out',
                                order_amount: -10,
                                order_date: 1716877413,
                                value: '774.81',
                            },
                        },
                        entry_spot: 782.35,
                        profit_loss: 31.4,
                        is_valid_to_sell: true,
                        status: 'profit',
                    },
                    {
                        contract_info: {
                            ...mockContractInfo({
                                contract_id: 243705193508,
                                contract_type: 'TURBOSLONG',
                            }),
                        },
                        details:
                            'You will receive a payout at expiry if the spot price never breaches the barrier. The payout is equal to the payout per point multiplied by the distance between the final price and the barrier.',
                        display_name: '',
                        id: 243705193508,
                        indicative: 4.4,
                        purchase: 10,
                        reference: 486048790368,
                        type: 'TURBOSLONG',
                        barrier: 821.69,
                        entry_spot: 824.24,
                        profit_loss: -5.6,
                        is_valid_to_sell: true,
                        status: 'profit',
                    },
                    {
                        contract_info: {
                            ...mockContractInfo({
                                contract_id: 249545026128,
                                contract_type: 'ACCU',
                                is_settleable: 0,
                                is_sold: 0,
                                is_valid_to_cancel: 0,
                                is_valid_to_sell: 1,
                                growth_rate: 0.03,
                                entry_spot: '364.15',
                            }),
                        },
                        details:
                            'After the entry spot tick, your stake will grow continuously by 3% for every tick that the spot price remains within the ± 0.03797% from the previous spot price.',
                        display_name: 'Volatility 100 (1s) Index',
                        id: 249545026128,
                        indicative: 18.6,
                        purchase: 10,
                        type: 'ACCU',
                        profit_loss: 8.6,
                        is_valid_to_sell: true,
                        current_tick: 21,
                        status: 'profit',
                        entry_spot: 364.15,
                        high_barrier: 364.149,
                        low_barrier: 363.871,
                    },
                ],
            },
            modules: {
                trade: {
                    ...mockStore({}).modules.trade,
                    currency: 'USD',
                    contract_type: 'rise_fall',
                    is_chart_loading: false,
                    is_purchase_enabled: true,
                    proposal_info: {
                        PUT: {
                            id: 1234,
                            has_error: false,
                            has_error_details: false,
                            message:
                                'Win payout if Volatility 100 (1s) Index is strictly lower than entry spot at 10 minutes after contract start time.',
                            obj_contract_basis: {
                                text: 'Payout',
                                value: 19.2,
                            },
                            payout: 19.2,
                            profit: '9.20',
                            returns: '92.00%',
                            stake: '10.00',
                            spot: 366.11,
                            barrier: '366.11',
                            growth_rate: 0.03,
                            spot_time: 1721206371,
                        },
                        CALL: {
                            id: 12345,
                            has_error: false,
                            has_error_details: false,
                            message:
                                'Win payout if Volatility 100 (1s) Index is strictly higher than entry spot at 10 minutes after contract start time.',
                            obj_contract_basis: {
                                text: 'Payout',
                                value: 19.26,
                            },
                            payout: 19.26,
                            profit: '9.26',
                            returns: '92.60%',
                            stake: '10.00',
                            spot: 366.11,
                            barrier: '366.11',
                            growth_rate: 0.03,
                            spot_time: 1721206371,
                        },
                    },
                    symbol: '1HZ100V',
                    trade_types: {
                        CALL: 'Rise',
                        PUT: 'Fall',
                    },
                },
            },
        });
    });

    const mockPurchaseButton = () => {
        render(
            <TraderProviders store={default_mock_store}>
                <ReportsStoreProvider>
                    <ModulesProvider store={default_mock_store}>
                        <PurchaseButton />
                    </ModulesProvider>
                </ReportsStoreProvider>
            </TraderProviders>
        );
    };

    it('should render a single unified Buy button for Rise/Fall even before trade_type_tab is set', () => {
        // trade_type_tab is unset here (the load-window config that used to flash two
        // Rise/Fall buttons); it should resolve to the default tab and render one Buy button.
        mockPurchaseButton();

        const purchase_button = screen.getByRole('button');
        expect(purchase_button).toHaveClass('purchase-button--single');
        expect(screen.getByText('Buy')).toBeInTheDocument();
        expect(screen.queryByText('Rise')).not.toBeInTheDocument();
        expect(screen.queryByText('Fall')).not.toBeInTheDocument();

        // Content reflects the default (Rise/CALL) side's payout only, not both sides.
        expect(screen.getByText('Payout')).toBeInTheDocument();
        expect(screen.getByText('$19.26')).toBeInTheDocument();
    });

    it('should render the skeleton (not the Buy button) while the initial chart load is pending', () => {
        // is_chart_loading true = tick_history not fetched yet; button must stay skeletonized
        // so it never flashes enabled before proposals/chart settle.
        default_mock_store.modules.trade.is_chart_loading = true;
        mockPurchaseButton();

        expect(screen.getByTestId('dt_skeleton')).toBeInTheDocument();
        expect(screen.queryByText('Buy')).not.toBeInTheDocument();
    });

    it('should render the Buy button once the chart has loaded (is_chart_loading false)', () => {
        default_mock_store.modules.trade.is_chart_loading = false;
        mockPurchaseButton();

        expect(screen.queryByTestId('dt_skeleton')).not.toBeInTheDocument();
        expect(screen.getByText('Buy')).toBeInTheDocument();
    });

    it('should reveal the Buy button via the safety timeout if the chart never reports ready', () => {
        jest.useFakeTimers();
        // is_chart_loading undefined = chart has not reported ready (e.g. never mounts / errors)
        default_mock_store.modules.trade.is_chart_loading = undefined;
        mockPurchaseButton();

        expect(screen.getByTestId('dt_skeleton')).toBeInTheDocument();

        act(() => {
            jest.advanceTimersByTime(10000);
        });

        expect(screen.queryByTestId('dt_skeleton')).not.toBeInTheDocument();
        expect(screen.getByText('Buy')).toBeInTheDocument();
        jest.useRealTimers();
    });

    it('should disable the button if one of the prop is false (is_trade_enabled, is_proposal_empty, !info.id, is_purchase_enabled): button should have a specific attribute and if user clicks on it onPurchase will not be called', async () => {
        default_mock_store.modules.trade.is_trade_enabled_v2 = false;
        mockPurchaseButton();

        const purchase_button = screen.getAllByRole('button')[0];
        expect(purchase_button).toBeDisabled();
        expect(default_mock_store.modules.trade.onPurchase).not.toBeCalled();

        await userEvent.click(purchase_button);

        expect(default_mock_store.modules.trade.onPurchase).not.toBeCalled();
    });

    it('should call onPurchaseV2 function if user clicks on purchase button and it is not disabled', async () => {
        default_mock_store.client.is_logged_in = true;
        mockPurchaseButton();
        const purchase_button = screen.getAllByRole('button')[0];

        expect(default_mock_store.modules.trade.onPurchaseV2).not.toBeCalled();
        await userEvent.click(purchase_button);

        expect(default_mock_store.modules.trade.onPurchaseV2).toBeCalled();
    });

    it('should open the auth sheet without calling onPurchaseV2 when a logged-out user clicks the purchase button', async () => {
        default_mock_store.client.is_logged_in = false;
        mockPurchaseButton();
        const purchase_button = screen.getAllByRole('button')[0];

        await userEvent.click(purchase_button);

        // Logged-out users should be sent straight to the auth sheet (AuthorizationRequired), not through
        // a doomed buy that waits on proposals and can get stuck loading.
        expect(default_mock_store.modules.trade.onPurchaseV2).not.toBeCalled();
        expect(default_mock_store.common.setServicesError).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'AuthorizationRequired', type: 'buy' }),
            true
        );
    });

    it('should disable the button when account is switching', async () => {
        default_mock_store.ui.is_switching_account = true;
        mockPurchaseButton();

        const purchase_button = screen.getAllByRole('button')[0];
        expect(purchase_button).toBeDisabled();

        await userEvent.click(purchase_button);
        expect(default_mock_store.modules.trade.onPurchaseV2).not.toBeCalled();
    });

    it('should enable the button when account is not switching and all conditions are met', () => {
        default_mock_store.ui.is_switching_account = false;
        default_mock_store.modules.trade.is_trade_enabled_v2 = true;
        mockPurchaseButton();

        const purchase_button = screen.getAllByRole('button')[0];
        expect(purchase_button).toBeEnabled();
    });

    it('should disable the button while the contract has no price yet', async () => {
        // A proposal still in flight (or absorbed to correct the stake) leaves the contract's info
        // with neither an id nor an error — there is nothing to buy yet.
        default_mock_store.client.is_logged_in = true;
        default_mock_store.modules.trade.proposal_info = {
            PUT: { id: '', has_error: false },
            CALL: { id: '', has_error: false },
        } as unknown as typeof default_mock_store.modules.trade.proposal_info;
        mockPurchaseButton();

        const purchase_button = screen.getAllByRole('button')[0];
        expect(purchase_button).toBeDisabled();

        await userEvent.click(purchase_button);
        expect(default_mock_store.modules.trade.onPurchaseV2).not.toBeCalled();
    });

    it('should enable the button once the contract has a price', async () => {
        default_mock_store.client.is_logged_in = true;
        mockPurchaseButton();

        const purchase_button = screen.getAllByRole('button')[0];
        expect(purchase_button).toBeEnabled();

        await userEvent.click(purchase_button);
        expect(default_mock_store.modules.trade.onPurchaseV2).toBeCalled();
    });

    it('should render only one button if trade_types have only one field and there are no trade type tabs', () => {
        default_mock_store.modules.trade.contract_type = TRADE_TYPES.ACCUMULATOR;
        default_mock_store.modules.trade.trade_types = {
            [CONTRACT_TYPES.ACCUMULATOR]: 'Accumulator Up',
        };
        mockPurchaseButton();

        const purchase_button = screen.getByRole('button');
        expect(purchase_button).toBeInTheDocument();
        expect(purchase_button).toHaveClass('purchase-button--single');
    });

    it('should render only one button if trade_types have 2 fields but there are 2 trade type tabs and trade_type_tab value is set', () => {
        default_mock_store.modules.trade.contract_type = TRADE_TYPES.HIGH_LOW;
        default_mock_store.modules.trade.trade_types = {
            [CONTRACT_TYPES.CALL]: 'Higher',
            [CONTRACT_TYPES.PUT]: 'Lower',
        };
        default_mock_store.modules.trade.trade_type_tab = CONTRACT_TYPES.CALL;
        mockPurchaseButton();

        const purchase_button = screen.getByRole('button');
        expect(purchase_button).toBeInTheDocument();
        expect(purchase_button).toHaveClass('purchase-button--single');
    });

    it('should render sell button for Accumulators contract if there is an open Accumulators contract; if user clicks on it - onClickSell should be called', async () => {
        default_mock_store.portfolio.open_accu_contract = {
            contract_info: {
                ...mockContractInfo({
                    contract_id: 249545026128,
                    contract_type: 'ACCU',
                    underlying_symbol: '1HZ100V',
                    bid_price: '19.32',
                    entry_spot: '364.15',
                    is_sold: 0,
                    is_valid_to_sell: 1,
                    status: 'open',
                    is_expired: 0,
                }),
            },
            display_name: 'Volatility 100 (1s) Index',
            indicative: 19.32,
            reference: 486015531488,
            profit_loss: 9.32,
        };
        default_mock_store.modules.trade.is_accumulator = true;
        mockPurchaseButton();

        const sell_button = screen.getByText('Close $19.32');
        expect(sell_button).toBeInTheDocument();
        expect(default_mock_store.portfolio.onClickSell).not.toBeCalled();

        await userEvent.click(sell_button);
        expect(default_mock_store.portfolio.onClickSell).toBeCalled();
    });

    it('should show an error snackbar with an auto-dismiss delay when the proposal contains an error', () => {
        default_mock_store.modules.trade.proposal_info = {
            CALL: {
                ...default_mock_store.modules.trade.proposal_info.CALL,
                has_error: true,
                error_code: 'ContractBuyValidationError',
                message: 'This trade is temporarily unavailable.',
            },
            PUT: {
                ...default_mock_store.modules.trade.proposal_info.PUT,
                has_error: true,
                error_code: 'ContractBuyValidationError',
                message: 'This trade is temporarily unavailable.',
            },
        };
        mockPurchaseButton();

        expect(mockAddSnackbar).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'fail',
                delay: ERROR_SNACKBAR_DURATION,
            })
        );
    });

    const setAccuTradeType = () => {
        default_mock_store.client.is_logged_in = true;
        default_mock_store.modules.trade.is_accumulator = true;
        default_mock_store.modules.trade.contract_type = TRADE_TYPES.ACCUMULATOR;
        default_mock_store.modules.trade.trade_types = {
            [CONTRACT_TYPES.ACCUMULATOR]: 'Accumulator Up',
        };
        // The button needs a price for the contract it displays: without an id (and no error) it
        // reads as "proposal still in flight" and stays disabled.
        default_mock_store.modules.trade.proposal_info = {
            [CONTRACT_TYPES.ACCUMULATOR]: { id: 5678, has_error: false },
        } as unknown as typeof default_mock_store.modules.trade.proposal_info;
    };

    it('should show a loading Buy button and not call onPurchaseV2 while an Accumulators contract is expired but not sold yet', async () => {
        setAccuTradeType();
        const accu_position = default_mock_store.portfolio.all_positions[2];
        accu_position.contract_info = {
            ...accu_position.contract_info,
            is_expired: 1,
            is_sold: 0,
            status: 'open',
        };
        mockPurchaseButton();

        const purchase_button = screen.getAllByRole('button')[0];
        expect(purchase_button).toHaveClass('purchase-button--loading');

        await userEvent.click(purchase_button);
        expect(default_mock_store.modules.trade.onPurchaseV2).not.toBeCalled();
    });

    it('should show a normal Buy button and allow purchase once the Accumulators contract is sold', async () => {
        setAccuTradeType();
        const accu_position = default_mock_store.portfolio.all_positions[2];
        accu_position.contract_info = {
            ...accu_position.contract_info,
            is_expired: 1,
            is_sold: 1,
            status: 'lost',
        };
        mockPurchaseButton();

        const purchase_button = screen.getAllByRole('button')[0];
        expect(purchase_button).not.toHaveClass('purchase-button--loading');

        await userEvent.click(purchase_button);
        expect(default_mock_store.modules.trade.onPurchaseV2).toBeCalled();
    });
});
