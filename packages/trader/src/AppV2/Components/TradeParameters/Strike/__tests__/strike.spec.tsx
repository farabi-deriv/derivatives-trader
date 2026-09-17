import React from 'react';

import { CONTRACT_TYPES, isMobile, TRADE_TYPES } from '@deriv/shared';
import { mockStore } from '@deriv/stores';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ModulesProvider from 'Stores/Providers/modules-providers';

import TraderProviders from '../../../../../trader-providers';
import Strike from '../strike';

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    isMobile: jest.fn(() => true),
}));

const strike_trade_param_label = 'Strike price';

jest.mock('@deriv-com/quill-ui', () => ({
    ...jest.requireActual('@deriv-com/quill-ui'),
    WheelPicker: jest.fn(({ data, setSelectedValue }) => (
        <div>
            <p>WheelPicker</p>
            <ul>
                {data.map(({ value }: { value: string }) => (
                    <li key={value}>
                        <button onClick={() => setSelectedValue(value)}>{value}</button>
                    </li>
                ))}
            </ul>
        </div>
    )),
}));

jest.mock('lodash.debounce', () =>
    jest.fn(fn => {
        fn.cancel = () => null;
        return fn;
    })
);

describe('Strike', () => {
    let default_mock_store: ReturnType<typeof mockStore>;

    beforeEach(
        () =>
            (default_mock_store = mockStore({
                modules: {
                    trade: {
                        ...mockStore({}),
                        barrier_1: '+1.80',
                        barrier_choices: ['+1.80', '+1.00', '+0.00', '-1.00', '-1.80'],
                        contract_type: TRADE_TYPES.VANILLA.CALL,
                        currency: 'USD',
                        proposal_info: {
                            [CONTRACT_TYPES.VANILLA.CALL]: { obj_contract_basis: { value: '14.245555' } },
                        },
                    },
                },
            }))
    );

    afterEach(() => jest.clearAllMocks());

    const mockStrike = () =>
        render(
            <TraderProviders store={default_mock_store}>
                <ModulesProvider store={default_mock_store}>
                    <Strike is_minimized />
                </ModulesProvider>
            </TraderProviders>
        );
    it('renders Skeleton loader if strike (barrier_1) is falsy', () => {
        default_mock_store.modules.trade.barrier_1 = '';
        mockStrike();

        expect(screen.getByTestId('dt_skeleton')).toBeInTheDocument();
        expect(screen.queryByText(strike_trade_param_label)).not.toBeInTheDocument();
    });

    it('renders trade param with "Strike price" label and input with value equal to current strike value (barrier_1)', () => {
        mockStrike();

        expect(screen.getByText(strike_trade_param_label)).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toHaveValue('+1.80');
    });

    it('opens ActionSheet with the wheel, the payout-per-point row and the header close/save actions', async () => {
        const user = userEvent.setup();
        mockStrike();

        expect(screen.queryByTestId('dt-actionsheet-overlay')).not.toBeInTheDocument();

        await user.click(screen.getByText(strike_trade_param_label));

        expect(screen.getByTestId('dt-actionsheet-overlay')).toBeInTheDocument();
        expect(screen.getByText('WheelPicker')).toBeInTheDocument();
        expect(screen.getByText('Payout per point')).toBeInTheDocument();
        expect(screen.getByText(/14.245555/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument();
        // Nothing drafted yet, so the check starts off.
        expect(screen.getByRole('button', { name: /Save/i })).toBeDisabled();
    });

    it('shows the strike definition in the header info tooltip', async () => {
        const user = userEvent.setup();
        mockStrike();

        await user.click(screen.getByText(strike_trade_param_label));
        fireEvent.mouseEnter(screen.getByRole('button', { name: 'Strike price' }));

        expect(screen.getByText(/you receive a payout at expiry if the final price is/)).toBeInTheDocument();
    });

    it('enables the header save once a different strike is drafted', async () => {
        const user = userEvent.setup();
        mockStrike();

        await user.click(screen.getByText(strike_trade_param_label));
        await user.click(screen.getByText(default_mock_store.modules.trade.barrier_choices[1]));

        expect(screen.getByRole('button', { name: /Save/i })).toBeEnabled();
    });

    it('opens the payout-per-point explanation (retitling the sheet) when tapped', async () => {
        const user = userEvent.setup();
        mockStrike();

        await user.click(screen.getByText(strike_trade_param_label));
        // Only the payout row label before navigating to its page.
        expect(screen.getAllByText('Payout per point')).toHaveLength(1);

        await user.click(screen.getByText('Payout per point'));
        // The carousel title now reads Payout per point too (row label + title), and its definition shows.
        expect(screen.getAllByText('Payout per point')).toHaveLength(2);
        expect(
            screen.getByText("The money you earn or lose for every one-point change in an asset's price.")
        ).toBeInTheDocument();
    });

    it('does not render Payout per point information if proposal_info is empty object', async () => {
        const user = userEvent.setup();
        default_mock_store.modules.trade.proposal_info = {};
        mockStrike();

        await user.click(screen.getByText(strike_trade_param_label));

        expect(screen.getByText('Payout per point')).toBeInTheDocument();
        expect(screen.queryByText(/14.245555/)).not.toBeInTheDocument();
    });

    it('applies specific className if innerHeight is <= 640px', async () => {
        const user = userEvent.setup();
        const original_height = window.innerHeight;
        window.innerHeight = 640;
        mockStrike();

        await user.click(screen.getByText(strike_trade_param_label));

        expect(screen.getByTestId('dt_carousel')).toHaveClass('strike__carousel--small');
        window.innerHeight = original_height;
    });

    it('calls onChange function if user changes selected value', async () => {
        const user = userEvent.setup();
        mockStrike();

        const new_selected_value = default_mock_store.modules.trade.barrier_choices[1];
        await user.click(screen.getByText(strike_trade_param_label));
        await user.click(screen.getByText(new_selected_value));
        await user.click(screen.getByRole('button', { name: /Save/i }));

        await waitFor(() => {
            expect(default_mock_store.modules.trade.onChange).toBeCalled();
        });
    });

    it('disables trade param if is_market_closed === true', () => {
        default_mock_store.modules.trade.is_market_closed = true;
        mockStrike();

        expect(screen.getByRole('textbox')).toBeDisabled();
    });
});

// Characterization: StrikeDesktop already reads barrier_1 from the store, so the desktop restore
// (contract-type.ts no longer gates the v2_params_initial_values.strike restore on is_mobile)
// surfaces here without a component change.
describe('Strike on desktop', () => {
    let desktop_mock_store: ReturnType<typeof mockStore>;

    beforeEach(() => {
        (isMobile as jest.Mock).mockReturnValue(false);
        desktop_mock_store = mockStore({
            modules: {
                trade: {
                    ...mockStore({}),
                    barrier_1: '+1.80',
                    barrier_choices: ['+1.80', '+1.00', '+0.00', '-1.00', '-1.80'],
                    contract_type: TRADE_TYPES.VANILLA.CALL,
                    currency: 'USD',
                    proposal_info: {},
                },
            },
        });
    });

    afterEach(() => {
        (isMobile as jest.Mock).mockReturnValue(true);
        jest.clearAllMocks();
    });

    it('[ABF-007] surfaces the restored strike (barrier_1) on desktop via StrikeDesktop', () => {
        render(
            <TraderProviders store={desktop_mock_store}>
                <ModulesProvider store={desktop_mock_store}>
                    <Strike is_minimized />
                </ModulesProvider>
            </TraderProviders>
        );

        expect(screen.getByText('Strike price')).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toHaveValue('+1.80');
    });
});
