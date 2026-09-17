import { mockStore } from '@deriv/stores';
import { useDevice } from '@deriv-com/ui';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ModulesProvider from 'Stores/Providers/modules-providers';

import TraderProviders from '../../../../../trader-providers';
import MultipliersInformation from '../multipliers-information';

const stop_out_label = 'Stop out';
const stop_out_level_label = 'Stop out level';
const commission_label = 'Commission';

jest.mock('@deriv-com/ui', () => ({
    ...jest.requireActual('@deriv-com/ui'),
    useDevice: jest.fn(() => ({ isDesktop: false })),
}));

describe('MultipliersInformation', () => {
    let default_mock_store: ReturnType<typeof mockStore>;

    afterEach(() => jest.clearAllMocks());

    beforeEach(() => {
        default_mock_store = mockStore({
            modules: {
                trade: {
                    currency: 'USD',
                    is_market_closed: false,
                    contract_type: 'multiplier',
                    trade_types: { MULTUP: 'Up', MULTDOWN: 'Down' },
                    trade_type_tab: 'MULTUP',
                    proposal_info: {
                        MULTUP: {
                            limit_order: {
                                stop_out: {
                                    order_amount: -10.5,
                                    value: '8160.12',
                                },
                            },
                        },
                        MULTDOWN: {
                            limit_order: {
                                stop_out: {
                                    order_amount: -10.5,
                                    value: '8320.45',
                                },
                            },
                        },
                    },
                },
            },
        });
    });

    const mockMultipliersInformation = () =>
        render(
            <TraderProviders store={default_mock_store}>
                <ModulesProvider store={default_mock_store}>
                    <MultipliersInformation />
                </ModulesProvider>
            </TraderProviders>
        );

    it('does not render if there is an API error in MULTUP', () => {
        default_mock_store.modules.trade.proposal_info = {
            MULTUP: {
                has_error: true,
            },
        };
        const { container } = mockMultipliersInformation();

        expect(container).toBeEmptyDOMElement();
    });

    it('does not render if there is an API error in MULTDOWN', () => {
        default_mock_store.modules.trade.proposal_info = {
            MULTDOWN: {
                has_error: true,
            },
        };
        const { container } = mockMultipliersInformation();

        expect(container).toBeEmptyDOMElement();
    });

    it('does not render if there is an API error in both MULTUP and MULTDOWN', () => {
        default_mock_store.modules.trade.proposal_info = {
            MULTUP: {
                has_error: true,
            },
            MULTDOWN: {
                has_error: true,
            },
        };
        const { container } = mockMultipliersInformation();

        expect(container).toBeEmptyDOMElement();
    });

    it('[MCD-004] renders skeletons for all three rows if the proposal has no data but there is no API error', () => {
        default_mock_store.modules.trade.proposal_info = {
            MULTUP: {},
            MULTDOWN: {},
        };
        mockMultipliersInformation();

        expect(screen.getByText(stop_out_label)).toBeInTheDocument();
        expect(screen.getByText(stop_out_level_label)).toBeInTheDocument();
        expect(screen.getByText(commission_label)).toBeInTheDocument();
        expect(screen.getAllByTestId('dt_skeleton')).toHaveLength(3);
    });

    it('renders stop out and stop out level with the correct values for the Up side', () => {
        mockMultipliersInformation();

        expect(screen.getByText(stop_out_label)).toBeInTheDocument();
        expect(screen.getByText('$10.50')).toBeInTheDocument();
        expect(screen.getByText(stop_out_level_label)).toBeInTheDocument();
        expect(screen.getByText('8160.12')).toBeInTheDocument();
    });

    // The stop out price differs by direction (Up stops out below the spot, Down above it), so the
    // selected tab decides which proposal it comes from — MULTUP is not a valid fallback for Down.
    it('renders the Down side stop out level when the Down tab is selected', () => {
        default_mock_store.modules.trade.trade_type_tab = 'MULTDOWN';
        mockMultipliersInformation();

        expect(screen.getByText('8320.45')).toBeInTheDocument();
        expect(screen.queryByText('8160.12')).not.toBeInTheDocument();
    });

    it('does not fall back to the other direction when the selected side has no stop out level', () => {
        default_mock_store.modules.trade.trade_type_tab = 'MULTDOWN';
        default_mock_store.modules.trade.proposal_info = {
            MULTUP: { limit_order: { stop_out: { order_amount: -10.5, value: '8160.12' } } },
            MULTDOWN: { limit_order: { stop_out: { order_amount: -10.5 } } },
        };
        mockMultipliersInformation();

        expect(screen.queryByText('8160.12')).not.toBeInTheDocument();
        // The stop out level and the (unpriced) commission.
        expect(screen.getAllByTestId('dt_skeleton')).toHaveLength(2);
    });

    it('renders the stop out level without a currency code', () => {
        mockMultipliersInformation();

        expect(screen.queryByText('$8160.12')).not.toBeInTheDocument();
    });

    it('renders a skeleton for the stop out level while the proposal has no barrier value yet', () => {
        default_mock_store.modules.trade.proposal_info = {
            MULTUP: { limit_order: { stop_out: { order_amount: -10.5 } } },
        };
        mockMultipliersInformation();

        expect(screen.getByText(stop_out_level_label)).toBeInTheDocument();
        // The stop out level and the (unpriced) commission.
        expect(screen.getAllByTestId('dt_skeleton')).toHaveLength(2);
    });

    it('[MCD-001] [MCD-003] renders a commission row with a currency-formatted amount', () => {
        default_mock_store.modules.trade.amount = 10;
        default_mock_store.modules.trade.multiplier = 100;
        default_mock_store.modules.trade.proposal_info = {
            MULTUP: { commission: 0.5, limit_order: { stop_out: { order_amount: -10.5 } } },
        };
        mockMultipliersInformation();

        expect(screen.getByText(commission_label)).toBeInTheDocument();
        expect(screen.getByText('$0.50')).toBeInTheDocument();
    });

    // Commission is a function of stake and multiplier, not direction, so either side will do.
    it('[MCD-002] falls back to the other direction for the commission', () => {
        default_mock_store.modules.trade.amount = 10;
        default_mock_store.modules.trade.multiplier = 100;
        default_mock_store.modules.trade.proposal_info = {
            MULTDOWN: { commission: 0.5, limit_order: { stop_out: { order_amount: -10.5 } } },
        };
        mockMultipliersInformation();

        expect(screen.getByText(commission_label)).toBeInTheDocument();
        expect(screen.getByText('$0.50')).toBeInTheDocument();
    });

    it('uses absolute value for negative stop out amount', () => {
        default_mock_store.modules.trade.proposal_info = {
            MULTUP: {
                limit_order: {
                    stop_out: {
                        order_amount: -25.75,
                    },
                },
            },
        };
        mockMultipliersInformation();

        expect(screen.getByText('$25.75')).toBeInTheDocument();
    });

    // The loss amount is the same on both sides, so any proposal can cover the selected one loading.
    it('falls back to the other direction for the stop out amount', () => {
        default_mock_store.modules.trade.proposal_info = {
            MULTDOWN: {
                limit_order: {
                    stop_out: {
                        order_amount: -15.0,
                        value: '8320.45',
                    },
                },
            },
        };
        mockMultipliersInformation();

        expect(screen.getByText('$15.00')).toBeInTheDocument();
    });

    it('[MCD-007] applies disabled class when market is closed', () => {
        default_mock_store.modules.trade.is_market_closed = true;
        mockMultipliersInformation();

        expect(screen.getByText(stop_out_label)).toHaveClass('trade-params__text--disabled');
        expect(screen.getByText(stop_out_level_label)).toHaveClass('trade-params__text--disabled');
        expect(screen.getByText(commission_label)).toHaveClass('trade-params__text--disabled');
    });

    it('does not apply disabled class when market is open', () => {
        mockMultipliersInformation();

        expect(screen.getByText(stop_out_label)).not.toHaveClass('trade-params__text--disabled');
        expect(screen.getByText(stop_out_level_label)).not.toHaveClass('trade-params__text--disabled');
    });

    it('renders with different currency', () => {
        default_mock_store.modules.trade.currency = 'EUR';
        mockMultipliersInformation();

        expect(screen.getByText('€10.50')).toBeInTheDocument();
    });

    it('handles zero stop out value', () => {
        default_mock_store.modules.trade.proposal_info = {
            MULTUP: {
                limit_order: {
                    stop_out: {
                        order_amount: 0,
                    },
                },
            },
        };
        mockMultipliersInformation();

        expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    describe('stop out tooltip', () => {
        // The desktop tooltip message only renders into the portal on hover/focus (desktop only).
        beforeEach(() => (useDevice as jest.Mock).mockReturnValue({ isDesktop: true }));
        // Both labels are tooltip triggers, so target the Stop out one by its accessible name.
        const showDesktopTooltip = (name: string = stop_out_label) =>
            fireEvent.mouseEnter(screen.getByRole('button', { name }));

        it('derives the stop out percentage from the stop out amount and stake/ask_price (100% stake loss)', () => {
            default_mock_store.modules.trade.proposal_info = {
                MULTUP: { stake: '100', limit_order: { stop_out: { order_amount: -100 } } },
            };
            mockMultipliersInformation();
            showDesktopTooltip();

            expect(
                screen.getByText(
                    'Your contract will be closed automatically when your loss reaches 100% of your stake.'
                )
            ).toBeInTheDocument();
        });

        it('reflects a non-100% configured stop out level (e.g. 90% for CRASH1000)', () => {
            default_mock_store.modules.trade.proposal_info = {
                MULTUP: { stake: '100', limit_order: { stop_out: { order_amount: -90 } } },
            };
            mockMultipliersInformation();
            showDesktopTooltip();

            expect(
                screen.getByText('Your contract will be closed automatically when your loss reaches 90% of your stake.')
            ).toBeInTheDocument();
        });

        it('rounds the derived percentage to the nearest whole number', () => {
            default_mock_store.modules.trade.proposal_info = {
                MULTUP: { stake: '30', limit_order: { stop_out: { order_amount: -27.2 } } },
            };
            mockMultipliersInformation();
            showDesktopTooltip();

            // 27.2 / 30 = 90.67% -> 91%
            expect(
                screen.getByText('Your contract will be closed automatically when your loss reaches 91% of your stake.')
            ).toBeInTheDocument();
        });

        it('falls back to a non-numeric tooltip when the stop out amount is unavailable', () => {
            default_mock_store.modules.trade.proposal_info = {
                MULTUP: {},
                MULTDOWN: {},
            };
            mockMultipliersInformation();
            showDesktopTooltip();

            expect(
                screen.getByText(
                    'Your contract will be closed automatically when your loss reaches a certain percentage of your stake.'
                )
            ).toBeInTheDocument();
        });

        it('shows the stop out level explanation on hover', () => {
            mockMultipliersInformation();
            showDesktopTooltip(stop_out_level_label);

            expect(
                screen.getByText(
                    'The price at which your position closes automatically, capping your loss at your stake.'
                )
            ).toBeInTheDocument();
        });
    });

    describe('stop out level description (mobile)', () => {
        const stop_out_level_description =
            'The price at which your position closes automatically, capping your loss at your stake.';

        // clearAllMocks keeps implementations, so reset the device the desktop block set above.
        beforeEach(() => (useDevice as jest.Mock).mockReturnValue({ isDesktop: false }));

        it('opens an ActionSheet with the description when the label is tapped', async () => {
            mockMultipliersInformation();

            await userEvent.click(screen.getByText(stop_out_level_label));

            expect(screen.getByText(stop_out_level_description)).toBeInTheDocument();
            expect(screen.getByText('Got it')).toBeInTheDocument();
        });

        it('does not open the ActionSheet when the market is closed', async () => {
            default_mock_store.modules.trade.is_market_closed = true;
            mockMultipliersInformation();

            await userEvent.click(screen.getByText(stop_out_level_label));

            expect(screen.queryByText(stop_out_level_description)).not.toBeInTheDocument();
            expect(screen.queryByText('Got it')).not.toBeInTheDocument();
        });

        it('shows the Stop out explanation when the Stop out label is tapped instead', async () => {
            mockMultipliersInformation();

            await userEvent.click(screen.getByText(stop_out_label));

            expect(screen.queryByText(stop_out_level_description)).not.toBeInTheDocument();
            expect(screen.getByText('Got it')).toBeInTheDocument();
        });
    });

    describe('commission explanation (mobile)', () => {
        // clearAllMocks keeps implementations, so reset the device the desktop block set above.
        beforeEach(() => {
            (useDevice as jest.Mock).mockReturnValue({ isDesktop: false });
            default_mock_store.modules.trade.amount = 10;
            default_mock_store.modules.trade.multiplier = 100;
            default_mock_store.modules.trade.proposal_info = {
                MULTUP: { commission: 0.5, limit_order: { stop_out: { order_amount: -10.5, value: '8160.12' } } },
            };
        });

        it('[MCD-005] opens an ActionSheet with the formula when the label is tapped', async () => {
            mockMultipliersInformation();

            await userEvent.click(screen.getByText(commission_label));

            // commission_percentage = (0.5 * 100) / (100 * 10) = 0.0500
            expect(screen.getByText('0.0500%')).toBeInTheDocument();
            expect(screen.getByText('Got it')).toBeInTheDocument();
        });

        it('[MCD-005] does not open the ActionSheet when the market is closed', async () => {
            default_mock_store.modules.trade.is_market_closed = true;
            mockMultipliersInformation();

            await userEvent.click(screen.getByText(commission_label));

            expect(screen.queryByText('0.0500%')).not.toBeInTheDocument();
            expect(screen.queryByText('Got it')).not.toBeInTheDocument();
        });

        it('[MCD-009] leaves the label plain and inert when the percentage cannot be derived', async () => {
            default_mock_store.modules.trade.amount = 0;
            mockMultipliersInformation();

            expect(screen.getByText(commission_label)).not.toHaveClass('multipliers-information__label--underlined');

            await userEvent.click(screen.getByText(commission_label));

            expect(screen.queryByText('Got it')).not.toBeInTheDocument();
            // The value row is still rendered, per MCD-004.
            expect(screen.getByText('$0.50')).toBeInTheDocument();
        });
    });
});
