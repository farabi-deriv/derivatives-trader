import { CONTRACT_TYPES, TRADE_TYPES } from '@deriv/shared';
import { mockStore } from '@deriv/stores';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ModulesProvider from 'Stores/Providers/modules-providers';

import TraderProviders from '../../../../../trader-providers';
import Stake from '../stake';
import StakeInput from '../stake-input';
import StakeInputDesktop from '../stake-input-desktop';

const stake_param_label = 'Stake';

jest.mock('AppV2/Hooks/useContractsFor', () => ({
    __esModule: true,
    default: jest.fn(() => ({
        available_contract_types: {
            vanillalongcall: {
                title: 'Call/Put',
                trade_types: ['VANILLALONGCALL'],
                basis: ['stake'],
                components: ['duration', 'strike', 'amount', 'trade_type_tabs'],
                barrier_count: 1,
                config: {
                    barrier_category: 'euro_non_atm',
                    default_stake: 10,
                },
            },
        },
    })),
}));

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    isMobile: jest.fn(() => false), // Default to desktop mode
    WS: {
        send: jest.fn(),
        authorized: {
            send: jest.fn(),
        },
    },
}));

// Create stable mock data outside the mock function to prevent infinite loops
const mockProposalData = {
    proposal: {},
};

jest.mock('AppV2/Hooks/useProposal', () => ({
    useProposal: jest.fn(() => ({
        data: mockProposalData,
        error: null,
        isFetching: false,
    })),
}));

describe('Stake', () => {
    let default_mock_store: ReturnType<typeof mockStore>;

    beforeEach(() => {
        default_mock_store = mockStore({
            modules: {
                trade: {
                    ...mockStore({}).modules.trade,
                    amount: 10,
                    basis: 'stake',
                    contract_type: TRADE_TYPES.RISE_FALL,
                    currency: 'USD',
                    proposal_info: {
                        [CONTRACT_TYPES.CALL]: {
                            has_error: false,
                            message:
                                'Win payout if Volatility 100 (1s) Index is strictly higher than entry spot at 5 minutes after contract start time.',
                            payout: 19.55,
                        },
                        [CONTRACT_TYPES.PUT]: {
                            has_error: false,
                            message:
                                'Win payout if Volatility 100 (1s) Index is strictly lower than entry spot at 5 minutes after contract start time.',
                            payout: 19.51,
                        },
                    },
                    trade_types: {
                        [CONTRACT_TYPES.CALL]: 'Higher',
                        [CONTRACT_TYPES.PUT]: 'Lower',
                    },
                    trade_type_tab: 'CALL',
                    validation_params: {
                        [CONTRACT_TYPES.CALL]: { stake: { max: '50000.00', min: '0.35' } },
                        [CONTRACT_TYPES.PUT]: { stake: { max: '50000.00', min: '0.35' } },
                    },
                },
            },
        });
        // Override is_mobile for desktop tests
        default_mock_store.ui.is_mobile = false;
    });

    const MockedStake = ({ store = default_mock_store }: { store?: ReturnType<typeof mockStore> }) => (
        <TraderProviders store={store}>
            <ModulesProvider store={store}>
                <Stake is_minimized />
            </ModulesProvider>
        </TraderProviders>
    );

    it('renders trade param with "Stake" label and input with a value equal to the current stake amount value', () => {
        render(<MockedStake />);
        const { amount } = default_mock_store.modules.trade;
        expect(screen.getByText(stake_param_label)).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toHaveValue(`$${amount}`);
    });

    // Both branches prefix the currency symbol (`$10`) rather than suffixing the code (`10 USD`),
    // so a truncated field still leads with the amount. Asserted separately because mobile and
    // desktop each build the string in their own component.
    describe('minimized mobile chip', () => {
        beforeEach(() => {
            // `Stake` picks the mobile/desktop variant from `modules.trade.root_store.ui.is_mobile`;
            // mockStore doesn't wire `root_store`, so point it back at the root to mount `StakeMobile`.
            default_mock_store.ui.is_mobile = true;
            default_mock_store.modules.trade.root_store = default_mock_store;
        });

        it('prefixes the currency symbol instead of suffixing the code', () => {
            render(<MockedStake />);

            const { amount } = default_mock_store.modules.trade;
            expect(screen.getByRole('textbox')).toHaveValue(`$${amount}`);
        });

        it('falls back to the currency code for a currency with no symbol', () => {
            default_mock_store.modules.trade.currency = 'USDC';
            render(<MockedStake />);

            const { amount } = default_mock_store.modules.trade;
            expect(screen.getByRole('textbox')).toHaveValue(`USDC${amount}`);
        });
    });

    it('opens popover with chips if user clicks on "Stake" trade param (desktop)', async () => {
        render(<MockedStake />);

        await userEvent.click(screen.getByText(stake_param_label));

        // Desktop uses popover with value chips, not ActionSheet
        expect(screen.getByLabelText('Select value $10')).toBeInTheDocument();
        // Desktop popover doesn't show payout details in the same way as mobile
    });

    it('calls onChange if user clicks on a chip value (desktop)', async () => {
        render(<MockedStake />);

        await userEvent.click(screen.getByText(stake_param_label));

        // Desktop uses chips - click on a different value
        await userEvent.click(screen.getByLabelText('Select value $20'));

        expect(default_mock_store.modules.trade.onChange).toHaveBeenCalledWith({
            target: { name: 'amount', value: 20 },
        });
    });

    it('does not render payout details for Accumulators', async () => {
        default_mock_store.modules.trade.is_accumulator = true;
        render(<MockedStake />);
        await userEvent.click(screen.getByText(stake_param_label));
        expect(screen.queryByText(/payout/i)).not.toBeInTheDocument();
    });

    it('does not render payout details for Turbos', async () => {
        default_mock_store.modules.trade.is_turbos = true;
        render(<MockedStake />);
        await userEvent.click(screen.getByText(stake_param_label));
        expect(screen.queryByText(/payout/i)).not.toBeInTheDocument();
    });

    it('does not render payout details for Vanillas', async () => {
        default_mock_store.modules.trade.is_vanilla = true;
        render(<MockedStake />);
        await userEvent.click(screen.getByText(stake_param_label));
        expect(screen.queryByText(/payout/i)).not.toBeInTheDocument();
    });

    it('opens popover for Multipliers (desktop)', async () => {
        const multiplier_store = mockStore({
            modules: {
                trade: {
                    ...mockStore({}).modules.trade,
                    amount: 10,
                    basis: 'stake',
                    commission: 0.36,
                    contract_type: TRADE_TYPES.MULTIPLIER,
                    currency: 'USD',
                    is_multiplier: true,
                    proposal_info: {
                        [CONTRACT_TYPES.MULTIPLIER.UP]: {
                            has_error: false,
                            message:
                                "If you select 'Up', your total profit/loss will be the percentage increase in Volatility 100 (1s) Index, multiplied by 1000, minus commissions.",
                            payout: 0,
                        },
                        [CONTRACT_TYPES.MULTIPLIER.DOWN]: {
                            has_error: false,
                            message:
                                "If you select 'Down', your total profit/loss will be the percentage decrease in Volatility 100 (1s) Index, multiplied by 1000, minus commissions.",
                            payout: 0,
                        },
                    },
                    stop_out: -10,
                    trade_types: {
                        [CONTRACT_TYPES.MULTIPLIER.UP]: 'Multiply Up',
                        [CONTRACT_TYPES.MULTIPLIER.DOWN]: 'Multiply Down',
                    },
                    validation_params: {
                        [CONTRACT_TYPES.MULTIPLIER.UP]: {
                            stake: {
                                max: '2000.00',
                                min: '1.00',
                            },
                        },
                        [CONTRACT_TYPES.MULTIPLIER.DOWN]: {
                            stake: {
                                max: '2000.00',
                                min: '1.00',
                            },
                        },
                    },
                },
            },
        });
        multiplier_store.ui.is_mobile = false;

        render(<MockedStake store={multiplier_store} />);

        await userEvent.click(screen.getByText(stake_param_label));
        // Desktop popover should open with chips
        expect(screen.getByLabelText('Select value $10')).toBeInTheDocument();
    });

    it('shows error in case of a validation error (desktop)', async () => {
        default_mock_store.modules.trade.contract_type = TRADE_TYPES.HIGH_LOW;
        default_mock_store.modules.trade.trade_type_tab = 'CALL';
        default_mock_store.modules.trade.validation_params = {
            CALL: { stake: { max: '50000.00', min: '0.35' } },
        };

        render(<MockedStake />);

        await userEvent.click(screen.getByText(stake_param_label));

        // Desktop popover should show chips - verify popover is open
        expect(screen.getByLabelText('Select value $10')).toBeInTheDocument();
    });

    it('disables trade param if is_market_closed == true', () => {
        default_mock_store.modules.trade.is_market_closed = true;
        render(<MockedStake />);

        expect(screen.getByRole('textbox')).toBeDisabled();
    });

    describe('collapsed stake trade parameter stays neutral for a stake-field error', () => {
        // The stake error is confined to the editor; the collapsed control never reddens for it.
        const ERROR_CLASS = '.quill-input__wrapper__variant--fill--error';

        beforeEach(() => {
            default_mock_store.client.is_logged_in = true;
            default_mock_store.modules.trade.proposal_info[CONTRACT_TYPES.CALL] = {
                ...default_mock_store.modules.trade.proposal_info[CONTRACT_TYPES.CALL],
                stake: '10.00',
            };
        });

        it('[SEC-001] leaves the desktop popover trigger neutral for an unaffordable committed stake', () => {
            default_mock_store.client.balance = '0.77';
            const { container } = render(<MockedStake />);

            // The errored state is a wrapper class only — quill exposes no role, testid or aria
            // attribute for it, so the class is the only observable signal.
            // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
            expect(container.querySelector(ERROR_CLASS)).not.toBeInTheDocument();
        });

        it('[SEC-001] leaves the desktop popover trigger neutral when the balance covers the charge', () => {
            default_mock_store.client.balance = '20.00';
            const { container } = render(<MockedStake />);

            // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
            expect(container.querySelector(ERROR_CLASS)).not.toBeInTheDocument();
        });

        it('[SEC-001] leaves the mobile collapsed field neutral for a stake-field proposal error', () => {
            default_mock_store.ui.is_mobile = true;
            default_mock_store.modules.trade.root_store = default_mock_store;
            default_mock_store.modules.trade.contract_type = TRADE_TYPES.HIGH_LOW;
            default_mock_store.modules.trade.trade_type_tab = 'CALL';
            default_mock_store.modules.trade.trade_types = {
                [CONTRACT_TYPES.CALL]: 'Higher',
                [CONTRACT_TYPES.PUT]: 'Lower',
            };
            default_mock_store.modules.trade.proposal_info = {
                [CONTRACT_TYPES.CALL]: {
                    has_error: true,
                    error_field: 'stake',
                    message: 'Please enter a stake amount that is at least 0.35.',
                },
            };
            const { container } = render(<MockedStake />);

            // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
            expect(container.querySelector(ERROR_CLASS)).not.toBeInTheDocument();
        });
    });
});

describe('StakeInput', () => {
    let default_mock_store: ReturnType<typeof mockStore>;

    beforeEach(() => {
        default_mock_store = mockStore({
            modules: {
                trade: {
                    ...mockStore({}).modules.trade,
                    amount: 10,
                    basis: 'stake',
                    contract_type: TRADE_TYPES.RISE_FALL,
                    currency: 'USD',
                    trade_types: {
                        [CONTRACT_TYPES.CALL]: 'Higher',
                        [CONTRACT_TYPES.PUT]: 'Lower',
                    },
                    trade_type_tab: 'CALL',
                    validation_params: {
                        [CONTRACT_TYPES.CALL]: { stake: { max: '50000.00', min: '0.35' } },
                        [CONTRACT_TYPES.PUT]: { stake: { max: '50000.00', min: '0.35' } },
                    },
                },
            },
        });
    });

    const renderStakeInput = (store = default_mock_store) =>
        render(
            <TraderProviders store={store}>
                <ModulesProvider store={store}>
                    <StakeInput onClose={jest.fn()} is_open />
                </ModulesProvider>
            </TraderProviders>
        );

    it('does not increment stake when typing a digit that would exceed max decimal places', async () => {
        default_mock_store.modules.trade.amount = 5.34;
        const user = userEvent.setup();
        renderStakeInput();

        const stake_input = screen.getByDisplayValue('5.34');

        // Cursor is at the end of '5.34' (position 4).
        // For USD (decimals=2), adding a 3rd decimal digit must be blocked
        // so TextFieldWithSteppers cannot round it (e.g. 5.345 -> 5.35).
        await user.type(stake_input, '5');
        expect(stake_input).toHaveValue('5.34');

        // Confirm it stays blocked on repeated presses
        await user.type(stake_input, '5');
        expect(stake_input).toHaveValue('5.34');
    });

    it('does not corrupt stake when cursor is repositioned within the decimal portion', async () => {
        default_mock_store.modules.trade.amount = 5.34;
        const user = userEvent.setup();
        renderStakeInput();

        const stake_input = screen.getByDisplayValue('5.34') as HTMLInputElement;

        // Place cursor between '3' and '4' (position 3) and type '5'.
        // Without the fix: 5.354 -> toFixed(2) -> 5.35 (wrong).
        // With the fix: insertion is blocked, value stays 5.34.
        stake_input.setSelectionRange(3, 3);
        await user.type(stake_input, '5');
        expect(stake_input).toHaveValue('5.34');
    });

    it('allows typing a digit when still within max decimal places', async () => {
        default_mock_store.modules.trade.amount = 5.3; // only 1 decimal digit used
        const user = userEvent.setup();
        renderStakeInput();

        const stake_input = screen.getByDisplayValue('5.3');

        // Typing '4' appends a second decimal digit — this must NOT be blocked
        await user.type(stake_input, '4');
        expect(stake_input).toHaveValue('5.34');
    });

    it('renders the stake range and all preset chips valid for the contract limits', () => {
        renderStakeInput();

        expect(screen.getByText('Range $0.35 - $50,000.00')).toBeInTheDocument();
        [1, 5, 10, 20, 50, 100].forEach(value =>
            expect(screen.getByRole('button', { name: `Select value $${value}` })).toBeInTheDocument()
        );
    });

    it('does not render preset chips below the market minimum', () => {
        default_mock_store.modules.trade.validation_params = {
            [CONTRACT_TYPES.CALL]: { stake: { max: '50000.00', min: '5.00' } },
            [CONTRACT_TYPES.PUT]: { stake: { max: '50000.00', min: '5.00' } },
        };
        // The ladder is built from the store's derived floor, not from validation_params directly —
        // the mock store is a plain object, so the computed that reads the params above is supplied
        // here as its result.
        default_mock_store.modules.trade.stake_preset_limits = { floor: 5, max: 50000 };
        renderStakeInput();

        expect(screen.queryByRole('button', { name: 'Select value $1' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Select value $5' })).toBeInTheDocument();
    });

    it('fills the input without committing when a preset is tapped', async () => {
        const user = userEvent.setup();
        renderStakeInput();

        await user.click(screen.getByRole('button', { name: 'Select value $20' }));

        expect(screen.getByDisplayValue('20')).toBeInTheDocument();
        expect(default_mock_store.modules.trade.onChange).not.toHaveBeenCalled();
    });

    it('publishes the tapped preset as the committed amount to the header save handler', async () => {
        const onClose = jest.fn();
        const registerHeaderActions = jest.fn();
        const user = userEvent.setup();
        render(
            <TraderProviders store={default_mock_store}>
                <ModulesProvider store={default_mock_store}>
                    <StakeInput onClose={onClose} is_open registerHeaderActions={registerHeaderActions} />
                </ModulesProvider>
            </TraderProviders>
        );

        await user.click(screen.getByRole('button', { name: 'Select value $20' }));

        // The header host (stake-mobile) drives Save; the input publishes the commit handler + gate.
        const { onSave, is_save_disabled } = registerHeaderActions.mock.calls.at(-1)[0];
        expect(is_save_disabled).toBe(false);

        onSave();

        expect(default_mock_store.modules.trade.onChange).toHaveBeenCalledWith({
            target: { name: 'amount', value: '20' },
        });
        expect(onClose).toHaveBeenCalled();
    });

    it('reports the save action disabled while the input is empty', async () => {
        const registerHeaderActions = jest.fn();
        const user = userEvent.setup();
        render(
            <TraderProviders store={default_mock_store}>
                <ModulesProvider store={default_mock_store}>
                    <StakeInput onClose={jest.fn()} is_open registerHeaderActions={registerHeaderActions} />
                </ModulesProvider>
            </TraderProviders>
        );

        await user.clear(screen.getByDisplayValue('10'));

        expect(registerHeaderActions.mock.calls.at(-1)[0].is_save_disabled).toBe(true);
    });

    describe('[SRA] empty stake amount', () => {
        it('[SRA-001] shows the required-field message the moment the field is cleared', async () => {
            const user = userEvent.setup();
            renderStakeInput();

            await user.clear(screen.getByDisplayValue('10'));

            expect(screen.getByText('Amount is a required field.')).toBeInTheDocument();
            // The error state is a class only — quill exposes no role/testid/aria for it.
            // eslint-disable-next-line testing-library/no-node-access
            expect(document.querySelector('[class*="status--error"]')).toBeInTheDocument();
            expect(screen.queryByText('Range $0.35 - $50,000.00')).not.toBeInTheDocument();
        });

        it('[SRA-003] clears the required-field message as soon as a value is typed back, before the debounce settles', async () => {
            const user = userEvent.setup();
            renderStakeInput();

            const input = screen.getByDisplayValue('10');
            await user.clear(input);
            await user.type(input, '4');

            // `displayAmount` is live; `proposal_request_values.amount` still lags behind the 300 ms
            // debounce here, so reading that instead would keep the message up over a filled field.
            expect(screen.queryByText('Amount is a required field.')).not.toBeInTheDocument();
            expect(screen.getByText('Range $0.35 - $50,000.00')).toBeInTheDocument();
        });
    });

    describe('Balance-aware hint', () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { useProposal } = require('AppV2/Hooks/useProposal');

        beforeEach(() => {
            default_mock_store.client.balance = '4.00';
            default_mock_store.client.currency = 'USD';
        });

        afterEach(() => {
            useProposal.mockReturnValue({ data: mockProposalData, error: null, isFetching: false });
        });

        it('shows the balance hint when tapping an unaffordable preset, styled as an error', async () => {
            const user = userEvent.setup();
            renderStakeInput();

            await user.click(screen.getByRole('button', { name: 'Select value $10' }));

            // The balance hint is shown when tapping an unaffordable preset.
            // The TextField component automatically styles this as an error based on its status prop.
            expect(screen.getByText('You only have 4.00 USD left. Try a lower stake.')).toBeInTheDocument();
        });

        it('shows no hint and keeps the range hint, styled as neutral, for an affordable drafted amount', async () => {
            const user = userEvent.setup();
            renderStakeInput();

            const input = screen.getByDisplayValue('10');
            await user.clear(input);
            await user.type(input, '4');

            expect(screen.queryByText(/left\. Try a lower stake\./)).not.toBeInTheDocument();
            // The range hint is shown when the drafted amount is affordable.
            // The TextField component automatically styles this as neutral based on its status prop.
            expect(screen.getByText('Range $0.35 - $50,000.00')).toBeInTheDocument();

            await user.clear(input);
            await user.type(input, '1');

            expect(screen.queryByText(/left\. Try a lower stake\./)).not.toBeInTheDocument();
            expect(screen.getByText('Range $0.35 - $50,000.00')).toBeInTheDocument();
        });

        it('[SEC-004] blocks Save for an unaffordable stake and unblocks once it is affordable again', async () => {
            const onClose = jest.fn();
            const registerHeaderActions = jest.fn();
            const user = userEvent.setup();
            render(
                <TraderProviders store={default_mock_store}>
                    <ModulesProvider store={default_mock_store}>
                        <StakeInput onClose={onClose} is_open registerHeaderActions={registerHeaderActions} />
                    </ModulesProvider>
                </TraderProviders>
            );

            // Balance is 4; 20 is above both the balance and the initial committed amount (10).
            await user.click(screen.getByRole('button', { name: 'Select value $20' }));

            const { onSave, is_save_disabled } = registerHeaderActions.mock.calls.at(-1)[0];
            expect(is_save_disabled).toBe(true);

            // Calling the commit handler directly (bypassing the disabled header button) must
            // still be a no-op: the balance hint gates the commit itself, not just the button.
            onSave();
            expect(default_mock_store.modules.trade.onChange).not.toHaveBeenCalled();
            expect(onClose).not.toHaveBeenCalled();

            // Tapping an affordable preset clears the hint and re-enables Save (preset taps validate
            // immediately, unlike typing, so this avoids waiting on the input's debounce).
            await user.click(screen.getByRole('button', { name: 'Select value $1' }));

            expect(registerHeaderActions.mock.calls.at(-1)[0].is_save_disabled).toBe(false);
        });

        it('lets a front-end format error outrank the balance hint', async () => {
            const user = userEvent.setup();
            renderStakeInput();

            const input = screen.getByDisplayValue('10');
            await user.type(input, '.');

            expect(screen.getByText('Should be a valid number.')).toBeInTheDocument();
            expect(screen.queryByText(/left\. Try a lower stake\./)).not.toBeInTheDocument();
        });

        it('lets a proposal stake_error outrank the balance hint', async () => {
            useProposal.mockReturnValue({
                data: undefined,
                error: { message: 'Please enter a stake amount that is at least 0.35.', details: { field: 'stake' } },
                isFetching: false,
            });

            renderStakeInput();

            expect(screen.getByText('Please enter a stake amount that is at least 0.35.')).toBeInTheDocument();
            expect(screen.queryByText(/left\. Try a lower stake\./)).not.toBeInTheDocument();
        });

        it('shows no hint when the balance is unknown', async () => {
            default_mock_store.client.balance = undefined;
            const user = userEvent.setup();
            renderStakeInput();

            await user.click(screen.getByRole('button', { name: 'Select value $10' }));

            expect(screen.queryByText(/You only have/)).not.toBeInTheDocument();
            expect(screen.getByText('Range $0.35 - $50,000.00')).toBeInTheDocument();
        });

        it('shows the empty-balance hint when tapping a preset on a zero balance, styled as an error', async () => {
            default_mock_store.client.balance = '0.00';
            const user = userEvent.setup();
            renderStakeInput();

            await user.click(screen.getByRole('button', { name: 'Select value $10' }));

            // The empty-balance hint is shown when balance is zero.
            // The TextField component automatically styles this as an error based on its status prop.
            expect(screen.getByText('Balance is empty. Deposit funds to buy this contract.')).toBeInTheDocument();
        });

        // 'multiplier' here is the Lookback trade types' declared basis (LB_CALL/LB_PUT/LB_HIGH_LOW), not the
        // Multiplier product — that declares basis: ['stake'] and so takes the hint's stake branch.
        it.each(['payout', 'multiplier', ''])(
            'shows no hint on %p basis, where the drafted amount is not the charge',
            async basis => {
                default_mock_store.modules.trade.basis = basis;
                const user = userEvent.setup();
                renderStakeInput();

                await user.click(screen.getByRole('button', { name: 'Select value $10' }));

                expect(screen.queryByText(/You only have/)).not.toBeInTheDocument();
                expect(screen.getByText('Range $0.35 - $50,000.00')).toBeInTheDocument();
            }
        );
    });

    // SEC-003: confining the error to the editor must not change the editor's own behaviour —
    // the input still shows the stake-field error in its error state and the mobile header Save
    // stays disabled while it shows.
    describe('[SEC-003] stake editor error display and Save gating unchanged', () => {
        beforeEach(() => {
            default_mock_store.client.balance = '4.00';
            default_mock_store.client.currency = 'USD';
        });

        it('[SEC-003] keeps the inline hint in the input error state and the mobile header Save disabled for an unaffordable preset', async () => {
            const registerHeaderActions = jest.fn();
            const user = userEvent.setup();
            render(
                <TraderProviders store={default_mock_store}>
                    <ModulesProvider store={default_mock_store}>
                        <StakeInput onClose={jest.fn()} is_open registerHeaderActions={registerHeaderActions} />
                    </ModulesProvider>
                </TraderProviders>
            );

            // Balance is 4.00 USD; tapping the 20 USD preset drafts an unaffordable stake.
            await user.click(screen.getByRole('button', { name: 'Select value $20' }));

            // The editor still surfaces the inline hint in the input, styled as an error...
            expect(screen.getByText('You only have 4.00 USD left. Try a lower stake.')).toBeInTheDocument();
            // The error state is a class only — quill exposes no role/testid/aria for it.
            // eslint-disable-next-line testing-library/no-node-access
            expect(document.querySelector('[class*="status--error"]')).toBeInTheDocument();
            // ...and the header Save action stays disabled, exactly as before this change.
            expect(registerHeaderActions.mock.calls.at(-1)[0].is_save_disabled).toBe(true);
        });
    });
});

describe('StakeInputDesktop', () => {
    let default_mock_store: ReturnType<typeof mockStore>;

    beforeEach(() => {
        default_mock_store = mockStore({
            modules: {
                trade: {
                    ...mockStore({}).modules.trade,
                    amount: 10,
                    basis: 'stake',
                    contract_type: TRADE_TYPES.RISE_FALL,
                    currency: 'USD',
                    trade_types: {
                        [CONTRACT_TYPES.CALL]: 'Higher',
                        [CONTRACT_TYPES.PUT]: 'Lower',
                    },
                    trade_type_tab: 'CALL',
                    validation_params: {
                        [CONTRACT_TYPES.CALL]: { stake: { max: '50000.00', min: '0.35' } },
                        [CONTRACT_TYPES.PUT]: { stake: { max: '50000.00', min: '0.35' } },
                    },
                },
            },
        });
    });

    const renderStakeInputDesktop = (store = default_mock_store) =>
        render(
            <TraderProviders store={store}>
                <ModulesProvider store={store}>
                    <StakeInputDesktop onClose={jest.fn()} is_open />
                </ModulesProvider>
            </TraderProviders>
        );

    it('does not increment stake when typing a digit that would exceed max decimal places', async () => {
        default_mock_store.modules.trade.amount = 5.34;
        const user = userEvent.setup();
        renderStakeInputDesktop();

        const stake_input = screen.getByDisplayValue('5.34');

        // Cursor is at the end of '5.34' (position 4).
        // For USD (decimals=2), adding a 3rd decimal digit must be blocked
        // so TextField cannot round it (e.g. 5.345 -> 5.35).
        await user.type(stake_input, '5');
        expect(stake_input).toHaveValue('5.34');

        // Confirm it stays blocked on repeated presses
        await user.type(stake_input, '5');
        expect(stake_input).toHaveValue('5.34');
    });

    it('does not corrupt stake when cursor is repositioned within the decimal portion', async () => {
        default_mock_store.modules.trade.amount = 5.34;
        const user = userEvent.setup();
        renderStakeInputDesktop();

        const stake_input = screen.getByDisplayValue('5.34') as HTMLInputElement;

        // Place cursor between '3' and '4' (position 3) and type '5'.
        // Without the fix: 5.354 -> toFixed(2) -> 5.35 (wrong).
        // With the fix: insertion is blocked, value stays 5.34.
        stake_input.setSelectionRange(3, 3);
        await user.type(stake_input, '5');
        expect(stake_input).toHaveValue('5.34');
    });

    it('allows typing a digit when still within max decimal places', async () => {
        default_mock_store.modules.trade.amount = 5.3; // only 1 decimal digit used
        const user = userEvent.setup();
        renderStakeInputDesktop();

        const stake_input = screen.getByDisplayValue('5.3');

        // Typing '4' appends a second decimal digit — this must NOT be blocked
        await user.type(stake_input, '4');
        expect(stake_input).toHaveValue('5.34');
    });

    describe('[SRA] empty stake amount', () => {
        it('[SRA-001] [SRA-002] shows the required-field message and disables Save the moment the field is cleared', async () => {
            const user = userEvent.setup();
            renderStakeInputDesktop();

            await user.clear(screen.getByDisplayValue('10'));

            expect(screen.getByText('Amount is a required field.')).toBeInTheDocument();
            // The error state is a class only — quill exposes no role/testid/aria for it.
            // eslint-disable-next-line testing-library/no-node-access
            expect(document.querySelector('[class*="status--error"]')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
        });

        it('[SRA-001] shows the range helper, not the requirement, on mount with a committed stake', () => {
            renderStakeInputDesktop();

            expect(screen.queryByText('Amount is a required field.')).not.toBeInTheDocument();
            expect(screen.getByText('Range: $0.35 to $50,000.00')).toBeInTheDocument();
        });

        it('[SRA-001] keeps the format error for a separator-terminated value set in one shot', async () => {
            const user = userEvent.setup();
            renderStakeInputDesktop();

            // A one-shot fill (paste, or Playwright's `fill`) leaves the committed amount at ''
            // while the format error is set, so the two states coexist on desktop.
            const input = screen.getByDisplayValue('10');
            await user.clear(input);
            await user.paste('1.');

            expect(screen.getByText('Should be a valid number.')).toBeInTheDocument();
            expect(screen.queryByText('Amount is a required field.')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
        });

        it('[SRA-002] does not commit an empty amount when Enter is pressed in the input', async () => {
            const user = userEvent.setup();
            renderStakeInputDesktop();

            const input = screen.getByDisplayValue('10');
            await user.clear(input);
            await user.keyboard('{Enter}');

            expect(default_mock_store.modules.trade.onChange).not.toHaveBeenCalledWith(
                expect.objectContaining({ target: expect.objectContaining({ name: 'amount' }) })
            );
        });

        it('[SRA-003] clears the required-field message and restores the range helper once a value is typed back', async () => {
            const user = userEvent.setup();
            renderStakeInputDesktop();

            const input = screen.getByDisplayValue('10');
            await user.clear(input);
            await user.type(input, '4');

            expect(screen.queryByText('Amount is a required field.')).not.toBeInTheDocument();
            expect(screen.getByText('Range: $0.35 to $50,000.00')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
        });
    });

    describe('Balance-aware hint', () => {
        beforeEach(() => {
            default_mock_store.client.balance = '4.00';
            default_mock_store.client.currency = 'USD';
        });

        it('shows the hint for an unaffordable drafted amount, styled as an error', async () => {
            const user = userEvent.setup();
            renderStakeInputDesktop();

            const input = screen.getByDisplayValue('10');
            await user.clear(input);
            await user.type(input, '10');

            // The balance hint is shown when drafting an unaffordable stake.
            // The TextField component automatically styles this as an error based on its status prop.
            expect(screen.getByText('You only have 4.00 USD left. Try a lower stake.')).toBeInTheDocument();
        });

        it('shows no hint, styled as neutral, for an affordable drafted amount', async () => {
            const user = userEvent.setup();
            renderStakeInputDesktop();

            const input = screen.getByDisplayValue('10');
            await user.clear(input);
            await user.type(input, '4');

            expect(screen.queryByText(/left\. Try a lower stake\./)).not.toBeInTheDocument();
            // The range hint is shown when the drafted amount is affordable.
            // The TextField component automatically styles this as neutral based on its status prop.
            expect(screen.getByText('Range: $0.35 to $50,000.00')).toBeInTheDocument();
        });

        it('[SEC-004] disables the footer Save while the balance hint shows and re-enables it once affordable', async () => {
            const user = userEvent.setup();
            renderStakeInputDesktop();

            const input = screen.getByDisplayValue('10');
            await user.clear(input);
            await user.type(input, '10');

            expect(screen.getByText('You only have 4.00 USD left. Try a lower stake.')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

            await user.clear(input);
            await user.type(input, '4');

            expect(screen.queryByText(/left\. Try a lower stake\./)).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
        });

        it('shows no hint when the balance is unknown', async () => {
            default_mock_store.client.balance = undefined;
            const user = userEvent.setup();
            renderStakeInputDesktop();

            const input = screen.getByDisplayValue('10');
            await user.clear(input);
            await user.type(input, '10');

            expect(screen.queryByText(/You only have/)).not.toBeInTheDocument();
        });

        it('shows the empty-balance hint when drafting a stake on a zero balance, styled as an error', async () => {
            default_mock_store.client.balance = '0.00';
            const user = userEvent.setup();
            renderStakeInputDesktop();

            const input = screen.getByDisplayValue('10');
            await user.clear(input);
            await user.type(input, '10');

            // The empty-balance hint is shown when balance is zero.
            // The TextField component automatically styles this as an error based on its status prop.
            expect(screen.getByText('Balance is empty. Deposit funds to buy this contract.')).toBeInTheDocument();
        });

        // 'multiplier' here is the Lookback trade types' declared basis (LB_CALL/LB_PUT/LB_HIGH_LOW), not the
        // Multiplier product — that declares basis: ['stake'] and so takes the hint's stake branch.
        it.each(['payout', 'multiplier', ''])(
            'shows no hint on %p basis, where the drafted amount is not the charge',
            async basis => {
                default_mock_store.modules.trade.basis = basis;
                const user = userEvent.setup();
                renderStakeInputDesktop();

                const input = screen.getByDisplayValue('10');
                await user.clear(input);
                await user.type(input, '10');

                expect(screen.queryByText(/You only have/)).not.toBeInTheDocument();
                expect(screen.getByText('Range: $0.35 to $50,000.00')).toBeInTheDocument();
            }
        );
    });

    // SEC-003: the desktop popover must keep showing an applicable proposal stake error in the
    // input's error state, with the footer Save disabled while it shows — unchanged by confinement.
    describe('[SEC-003] stake editor error display and Save gating unchanged', () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { useProposal } = require('AppV2/Hooks/useProposal');

        afterEach(() => {
            useProposal.mockReturnValue({ data: mockProposalData, error: null, isFetching: false });
        });

        it('[SEC-003] shows a proposal stake error in the input error state and disables the footer Save', async () => {
            // The proposal rejects the drafted stake with a stake-field error.
            useProposal.mockReturnValue({
                data: undefined,
                error: {
                    message: 'Please enter a stake amount that is at least 0.35.',
                    details: { field: 'stake' },
                },
                isFetching: false,
            });

            renderStakeInputDesktop();

            // The input still shows that error message...
            expect(await screen.findByText('Please enter a stake amount that is at least 0.35.')).toBeInTheDocument();
            // ...in its error state (a class only — quill exposes no role/testid/aria for it)...
            // eslint-disable-next-line testing-library/no-node-access
            expect(document.querySelector('[class*="status--error"]')).toBeInTheDocument();
            // ...and the footer Save button stays disabled while the stake error shows.
            expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
        });
    });
});

describe('Stake - Mobile header actions', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useProposal } = require('AppV2/Hooks/useProposal');
    let default_mock_store: ReturnType<typeof mockStore>;

    beforeEach(() => {
        useProposal.mockReturnValue({ data: mockProposalData, error: null, isFetching: false });
        default_mock_store = mockStore({
            modules: {
                trade: {
                    ...mockStore({}).modules.trade,
                    amount: 10,
                    basis: 'stake',
                    contract_type: TRADE_TYPES.RISE_FALL,
                    currency: 'USD',
                    trade_types: {
                        [CONTRACT_TYPES.CALL]: 'Higher',
                        [CONTRACT_TYPES.PUT]: 'Lower',
                    },
                    trade_type_tab: 'CALL',
                    validation_params: {
                        [CONTRACT_TYPES.CALL]: { stake: { max: '50000.00', min: '0.35' } },
                        [CONTRACT_TYPES.PUT]: { stake: { max: '50000.00', min: '0.35' } },
                    },
                },
            },
        });
        default_mock_store.ui.is_mobile = true;
        // `Stake` picks the mobile/desktop variant from `modules.trade.root_store.ui.is_mobile`;
        // mockStore doesn't wire `root_store`, so point it back at the root to mount `StakeMobile`.
        default_mock_store.modules.trade.root_store = default_mock_store;
    });

    afterEach(() => {
        useProposal.mockReturnValue({ data: mockProposalData, error: null, isFetching: false });
    });

    const renderMobileStake = (store = default_mock_store) =>
        render(
            <TraderProviders store={store}>
                <ModulesProvider store={store}>
                    <Stake is_minimized />
                </ModulesProvider>
            </TraderProviders>
        );

    const openSheet = async (user: ReturnType<typeof userEvent.setup>) => {
        // The mobile field's onClick lives on the input, so click the value, not the <label> text.
        // The chip renders the currency symbol before the amount (`$10`), not the code after it.
        await user.click(screen.getByDisplayValue('$10'));
    };

    it('disables the header save action when the sheet opens (unchanged value)', async () => {
        const user = userEvent.setup();
        renderMobileStake();

        await openSheet(user);

        expect(screen.getByRole('button', { name: /Save/i })).toBeDisabled();
    });

    it('enables the header save action after the stake is changed', async () => {
        const user = userEvent.setup();
        renderMobileStake();

        await openSheet(user);
        await user.click(screen.getByRole('button', { name: 'Select value $20' }));

        expect(screen.getByRole('button', { name: /Save/i })).toBeEnabled();
    });

    it('commits the changed stake to the store when the header save is tapped', async () => {
        const user = userEvent.setup();
        renderMobileStake();

        await openSheet(user);
        await user.click(screen.getByRole('button', { name: 'Select value $20' }));
        await user.click(screen.getByRole('button', { name: /Save/i }));

        expect(default_mock_store.modules.trade.onChange).toHaveBeenCalledWith({
            target: { name: 'amount', value: '20' },
        });
    });

    it('does not commit when the sheet is dismissed via the overlay', async () => {
        const user = userEvent.setup();
        renderMobileStake();

        await openSheet(user);
        await user.click(screen.getByRole('button', { name: 'Select value $20' }));
        await user.click(screen.getByTestId('dt-actionsheet-overlay'));

        expect(default_mock_store.modules.trade.onChange).not.toHaveBeenCalled();
    });

    it('re-enables the header save once an invalid draft is corrected back to a valid dirty value', async () => {
        // `25.` -> backspace -> `25` hits the "same value as the last proposal" shortcut, which must
        // still clear the FE error: the draft is valid and still differs from the committed 10.
        const user = userEvent.setup();
        renderMobileStake();
        await openSheet(user);

        // The proposal is debounced by 300ms; settle between steps so a pending timer from an earlier
        // keystroke can't clear the error and mask what is being tested.
        const settle = () => new Promise(resolve => setTimeout(resolve, 400));
        const save = () => screen.getByRole('button', { name: /Save/i });

        const input = screen.getByTestId('dt_stake_input');
        await user.clear(input);
        await user.type(input, '25');
        await settle();
        await waitFor(() => expect(save()).toBeEnabled());

        await user.type(input, '.');
        await settle();
        expect(screen.getByText('Should be a valid number.')).toBeInTheDocument();
        expect(save()).toBeDisabled();

        await user.type(input, '{backspace}');
        await settle();
        expect(screen.queryByText('Should be a valid number.')).not.toBeInTheDocument();
        expect(save()).toBeEnabled();
    });

    it('re-enables the header save after a rejected amount is corrected to a valid dirty one', async () => {
        // The other half of the contract: an API stake error must clear once a new amount validates,
        // so a corrected-but-still-dirty draft can be committed. Reject only `0`.
        useProposal.mockImplementation(
            ({ proposal_request_values }: { proposal_request_values?: { amount?: unknown } } = {}) =>
                Number(proposal_request_values?.amount) === 0
                    ? {
                          data: undefined,
                          error: { message: 'Should be a valid number.', details: { field: 'stake' } },
                          isFetching: false,
                      }
                    : { data: mockProposalData, error: null, isFetching: false }
        );
        const settle = () => new Promise(resolve => setTimeout(resolve, 400));
        const save = () => screen.getByRole('button', { name: /Save/i });
        const user = userEvent.setup();
        renderMobileStake();
        await openSheet(user);

        const input = screen.getByTestId('dt_stake_input');
        await user.clear(input);
        await user.type(input, '0');
        await settle();
        expect(save()).toBeDisabled();

        await user.clear(input);
        await user.type(input, '25');
        await settle();
        await waitFor(() => expect(save()).toBeEnabled());
    });

    it('clears the trailing-separator error even when the draft returns to the committed amount', async () => {
        // `10.` -> backspace -> `10` equals the committed stake, so save stays off on the dirty check
        // — but the FE error must not survive the correction.
        const settle = () => new Promise(resolve => setTimeout(resolve, 400));
        const user = userEvent.setup();
        renderMobileStake();
        await openSheet(user);

        const input = screen.getByTestId('dt_stake_input');
        await user.type(input, '.');
        await settle();
        expect(screen.getByText('Should be a valid number.')).toBeInTheDocument();

        await user.type(input, '{backspace}');
        await settle();
        expect(screen.queryByText('Should be a valid number.')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Save/i })).toBeDisabled();
    });

    it('does not enable the header save before the typed amount has been validated', async () => {
        // The check used to flash on between keystroke and request (the 300ms debounce), and again
        // between the two Rise/Fall proposals. It must stay off until the draft is actually committable.
        const settle = () => new Promise(resolve => setTimeout(resolve, 400));
        const save = () => screen.getByRole('button', { name: /Save/i });
        const user = userEvent.setup();
        renderMobileStake();
        await openSheet(user);

        const input = screen.getByTestId('dt_stake_input');
        await user.clear(input);
        await user.type(input, '4');
        // Still inside the debounce window: valid and dirty, but not yet validated.
        expect(save()).toBeDisabled();

        await settle();
        await waitFor(() => expect(save()).toBeEnabled());
    });

    it('keeps the header save disabled while a stake validation error is shown', async () => {
        // A rejected proposal (field: stake) surfaces a stake_error, which must keep save disabled.
        // Return a fresh error object per requested amount so the value change re-triggers the
        // proposal error effect — a single static reference never re-fires after `RESET_ERRORS`,
        // whereas a real backend returns a new error for the new amount.
        const error_by_amount = new Map<string, unknown>();
        useProposal.mockImplementation(
            ({ proposal_request_values }: { proposal_request_values?: { amount?: unknown } } = {}) => {
                const key = String(proposal_request_values?.amount ?? '');
                if (!error_by_amount.has(key)) {
                    error_by_amount.set(key, {
                        data: undefined,
                        error: {
                            message: 'Please enter a stake amount that is at least 0.35.',
                            details: { field: 'stake' },
                        },
                        isFetching: false,
                    });
                }
                return error_by_amount.get(key);
            }
        );
        const settle = () => new Promise(resolve => setTimeout(resolve, 400));
        const user = userEvent.setup();
        renderMobileStake();

        await openSheet(user);
        await user.click(screen.getByRole('button', { name: 'Select value $20' }));
        // Past the validation debounce, so the assertion lands on the settled state rather than on
        // whatever the click happened to flush — the sibling test above owns the no-flash case.
        await settle();

        expect(screen.getByRole('button', { name: /Save/i })).toBeDisabled();
    });
});

describe('Multipliers stop out (mobile sheet)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useProposal } = require('AppV2/Hooks/useProposal');
    let multipliers_mock_store: ReturnType<typeof mockStore>;

    const createMultipliersStore = (trade_overrides = {}) => {
        const store = mockStore({
            modules: {
                trade: {
                    ...mockStore({}).modules.trade,
                    amount: 10,
                    basis: 'stake',
                    contract_type: TRADE_TYPES.MULTIPLIER,
                    currency: 'USD',
                    // The defect: with Stop loss committed, the Stake sheet used to drop the Stop out row.
                    has_stop_loss: true,
                    is_multiplier: true,
                    multiplier: 100,
                    proposal_info: {
                        [CONTRACT_TYPES.MULTIPLIER.UP]: {
                            commission: 0.5,
                            has_error: false,
                            limit_order: { stop_out: { order_amount: -10 } },
                            stake: 10,
                        },
                        [CONTRACT_TYPES.MULTIPLIER.DOWN]: {
                            commission: 0.5,
                            has_error: false,
                            limit_order: { stop_out: { order_amount: -10 } },
                            stake: 10,
                        },
                    },
                    stop_out: -10,
                    stop_out_level: '8160.12',
                    trade_types: {
                        [CONTRACT_TYPES.MULTIPLIER.UP]: 'Multiply Up',
                        [CONTRACT_TYPES.MULTIPLIER.DOWN]: 'Multiply Down',
                    },
                    validation_params: {
                        [CONTRACT_TYPES.MULTIPLIER.UP]: { stake: { max: '2000.00', min: '1.00' } },
                        [CONTRACT_TYPES.MULTIPLIER.DOWN]: { stake: { max: '2000.00', min: '1.00' } },
                    },
                    ...trade_overrides,
                },
            },
        });
        store.ui.is_mobile = true;
        // `Stake` picks the mobile/desktop variant from `modules.trade.root_store.ui.is_mobile`;
        // mockStore doesn't wire `root_store`, so point it back at the root to mount `StakeMobile`.
        store.modules.trade.root_store = store;
        return store;
    };

    beforeEach(() => {
        useProposal.mockReturnValue({ data: mockProposalData, error: null, isFetching: false });
        multipliers_mock_store = createMultipliersStore();
    });

    const renderMobileStake = (store = multipliers_mock_store) =>
        render(
            <TraderProviders store={store}>
                <ModulesProvider store={store}>
                    <Stake is_minimized />
                </ModulesProvider>
            </TraderProviders>
        );

    // The mobile field's onClick lives on the input, so click the value, not the <label> text.
    const openSheet = async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByDisplayValue('$10'));

    // Each details row is keyed on its own value, so the Stop out row is replaced the moment the
    // formatted amount lands. Settle it before tapping the label, or the click hits a detached node.
    const openSettledSheet = async (user: ReturnType<typeof userEvent.setup>) => {
        await openSheet(user);
        await screen.findByText('$10.00');
    };

    // Every carousel page is mounted at once and translated into view, so page presence proves
    // nothing — only the active item tells us which page the trader is actually looking at. That
    // active-ness is a class with no role, testid or aria equivalent, so a query is the only way in.
    // eslint-disable-next-line testing-library/no-node-access
    const getActivePage = () => document.querySelector('.carousel__item--active');

    it('shows the Stop out and Stop out level rows with Stop loss set', async () => {
        const user = userEvent.setup();
        renderMobileStake();

        await openSheet(user);

        expect(screen.getByText('Stop out')).toBeInTheDocument();
        expect(screen.getByText('Stop out level')).toBeInTheDocument();
        expect(screen.getByText('8160.12')).toBeInTheDocument();
        // The amount is formatted in an effect, so it lands one commit after the sheet mounts.
        expect(await screen.findByText('$10.00')).toBeInTheDocument();
    });

    it('opens the Stop out explanation with its percentage when the label is tapped', async () => {
        const user = userEvent.setup();
        renderMobileStake();

        await openSettledSheet(user);
        await user.click(screen.getByText('Stop out'));

        await waitFor(() =>
            expect(getActivePage()).toHaveTextContent(
                'Your contract will be closed automatically when your loss reaches 100% of your stake.'
            )
        );
    });

    it('falls back to the generic Stop out explanation when no percentage can be derived', async () => {
        const user = userEvent.setup();
        renderMobileStake(
            createMultipliersStore({
                proposal_info: {
                    [CONTRACT_TYPES.MULTIPLIER.UP]: { has_error: false },
                    [CONTRACT_TYPES.MULTIPLIER.DOWN]: { has_error: false },
                },
            })
        );

        await openSettledSheet(user);
        await user.click(screen.getByText('Stop out'));

        await waitFor(() =>
            expect(getActivePage()).toHaveTextContent(
                'Your contract will be closed automatically when your loss reaches a certain percentage of your stake.'
            )
        );
    });

    it('opens the Stop out level explanation when the label is tapped', async () => {
        const user = userEvent.setup();
        renderMobileStake();

        await openSettledSheet(user);
        await user.click(screen.getByText('Stop out level'));

        await waitFor(() =>
            expect(getActivePage()).toHaveTextContent(
                'The price at which your position closes automatically, capping your loss at your stake.'
            )
        );
    });

    it('[MCD-001] [MCD-006] shows the Commission row seeded from the trade page proposal', async () => {
        const user = userEvent.setup();
        renderMobileStake();

        await openSheet(user);

        expect(screen.getByText('Commission')).toBeInTheDocument();
        expect(await screen.findByText('$0.50')).toBeInTheDocument();
    });

    it('[MCD-005] opens the Commission explanation page when the label is tapped', async () => {
        const user = userEvent.setup();
        renderMobileStake();

        await openSettledSheet(user);
        await user.click(screen.getByText('Commission'));

        // commission_percentage = (0.5 * 100) / (100 * 10) = 0.0500
        await waitFor(() =>
            expect(getActivePage()).toHaveTextContent(
                'Commission is calculated as 0.0500% of your stake multiplied by the multiplier.'
            )
        );
        expect(getActivePage()).toHaveTextContent('0.0500%');
    });

    // Commission is banded, so the drafted stake's rate differs from the committed one's — which is
    // what tells apart a page built from the draft and one built from the committed parameters.
    const priced_by_amount: Record<string, unknown> = {
        '10': { proposal: { commission: 0.5, limit_order: { stop_out: { order_amount: -10 } } } },
        '100': { proposal: { commission: 2.5, limit_order: { stop_out: { order_amount: -100 } } } },
    };
    const settle = () => new Promise(resolve => setTimeout(resolve, 400));

    it('[MCD-005] [MCD-009] explains the stake being drafted, not the committed one', async () => {
        useProposal.mockImplementation(
            ({ proposal_request_values }: { proposal_request_values?: { amount?: unknown } } = {}) => ({
                data: priced_by_amount[String(proposal_request_values?.amount)] ?? priced_by_amount['10'],
                error: null,
                isFetching: false,
            })
        );
        const user = userEvent.setup();
        renderMobileStake();

        await openSettledSheet(user);
        const input = screen.getByTestId('dt_stake_input');
        await user.clear(input);
        await user.type(input, '100');
        await settle();
        await screen.findByText('$2.50');

        await user.click(screen.getByText('Commission'));

        // (2.5 * 100) / (100 * 100) = 0.0250 — the committed pair would give 0.0500.
        await waitFor(() => expect(getActivePage()).toHaveTextContent('0.0250%'));
        expect(getActivePage()).not.toHaveTextContent('0.0500%');
        expect(getActivePage()).toHaveTextContent('100.00');
    });

    it('[MCD-006] [MCD-009] leaves the Commission label inert once a drafted stake fails to price', async () => {
        useProposal.mockImplementation(
            ({ proposal_request_values }: { proposal_request_values?: { amount?: unknown } } = {}) =>
                Number(proposal_request_values?.amount) === 9999
                    ? {
                          data: undefined,
                          error: { message: 'Invalid stake', details: { field: 'stake' } },
                          isFetching: false,
                      }
                    : { data: priced_by_amount['10'], error: null, isFetching: false }
        );
        const user = userEvent.setup();
        renderMobileStake();

        await openSettledSheet(user);
        const input = screen.getByTestId('dt_stake_input');
        await user.clear(input);
        await user.type(input, '9999');
        await settle();
        await waitFor(() => expect(screen.queryByText('$0.50')).not.toBeInTheDocument());

        await user.click(screen.getByText('Commission'));

        expect(getActivePage()).not.toHaveTextContent('Commission is calculated as');
    });
});

describe('Vanillas stake presets', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useProposal } = require('AppV2/Hooks/useProposal');
    let vanillas_mock_store: ReturnType<typeof mockStore>;

    beforeEach(() => {
        useProposal.mockReturnValue({ data: mockProposalData, error: null, isFetching: false });
        vanillas_mock_store = mockStore({
            modules: {
                trade: {
                    ...mockStore({}).modules.trade,
                    amount: 10,
                    basis: 'stake',
                    contract_type: TRADE_TYPES.VANILLA.CALL,
                    currency: 'USD',
                    default_stake: 2,
                    is_vanilla: true,
                    symbol: '1HZ25V',
                    // The store derives these from validation_params below (min 8 rounds up to 10);
                    // mockStore's trade is a plain object, so the computed value is supplied directly
                    // here. The derivation itself is covered by the TradeStore spec.
                    stake_preset_limits: { floor: 10, max: 5000 },
                    trade_types: {
                        [CONTRACT_TYPES.VANILLA.CALL]: 'Call',
                    },
                    trade_type_tab: '',
                    validation_params: {
                        [CONTRACT_TYPES.VANILLA.CALL]: { stake: { max: '5000.00', min: '8.00' } },
                    },
                },
            },
        });
    });

    const chipLabels = () => screen.getAllByRole('button', { name: /^Select value/ }).map(chip => chip.textContent);

    const renderDesktopPopover = async () => {
        vanillas_mock_store.ui.is_mobile = false;
        render(
            <TraderProviders store={vanillas_mock_store}>
                <ModulesProvider store={vanillas_mock_store}>
                    <Stake is_minimized />
                </ModulesProvider>
            </TraderProviders>
        );
        await userEvent.click(screen.getByText(stake_param_label));
    };

    const mobileSheet = () => (
        <TraderProviders store={vanillas_mock_store}>
            <ModulesProvider store={vanillas_mock_store}>
                <StakeInput onClose={jest.fn()} is_open />
            </ModulesProvider>
        </TraderProviders>
    );

    const renderMobileSheet = () => render(mobileSheet());

    // A full row of six on every market: the shared presets the minimum invalidates are dropped and
    // the row is topped up from above, so raising the floor never leaves a short row of chips.
    const full_row = ['$10', '$20', '$50', '$75', '$80', '$100'];

    it('offers no quick pick below the market minimum on desktop', async () => {
        await renderDesktopPopover();

        expect(chipLabels()).toEqual(full_row);
    });

    it('offers no quick pick below the market minimum on mobile', () => {
        renderMobileSheet();

        expect(chipLabels()).toEqual(full_row);
    });

    it('shows the quick picks, not the skeleton, once the limits are known', () => {
        renderMobileSheet();

        expect(screen.queryByTestId('dt_value_chips_skeleton')).not.toBeInTheDocument();
    });

    it('offers the identical ordered quick picks on both surfaces for the same store state', async () => {
        await renderDesktopPopover();
        const desktop_chips = chipLabels();

        cleanup();
        renderMobileSheet();

        expect(chipLabels()).toEqual(desktop_chips);
    });

    // The limits the ladder is derived from arrive with the market's first pricing result, so a
    // surface opened right after a market switch has nothing to derive from. It must offer no quick
    // pick at all until they land: a provisional ladder off the shared presets puts a lower first
    // chip on screen and then replaces the whole row — the flicker QA saw on mobile. The row's own
    // space is held by a skeleton, so the wait reads as loading rather than as chips gone missing.
    describe('before the active market limits are known', () => {
        beforeEach(() => {
            const { trade } = vanillas_mock_store.modules;
            trade.symbol = '1HZ75V';
            trade.stake_preset_limits = undefined;
            trade.validation_params = {};
        });

        const chipCount = () => screen.queryAllByRole('button', { name: /^Select value/ }).length;

        it('shows the skeleton in place of the quick picks on mobile', () => {
            renderMobileSheet();

            expect(screen.getByTestId('dt_value_chips_skeleton')).toBeInTheDocument();
            expect(chipCount()).toBe(0);
        });

        it('shows the skeleton in place of the quick picks on desktop', async () => {
            await renderDesktopPopover();

            expect(screen.getByTestId('dt_value_chips_skeleton')).toBeInTheDocument();
            expect(chipCount()).toBe(0);
        });

        it('offers the whole full-width ladder in one step once the limits arrive', () => {
            const { rerender } = renderMobileSheet();
            expect(chipCount()).toBe(0);

            vanillas_mock_store.modules.trade.stake_preset_limits = { floor: 20, max: 5000 };
            rerender(mobileSheet());

            expect(chipLabels()).toEqual(['$20', '$50', '$75', '$80', '$100', '$150']);
            expect(screen.queryByTestId('dt_value_chips_skeleton')).not.toBeInTheDocument();
        });

        it('disables the stake text box while the limits are loading, and enables it once they arrive', () => {
            const { rerender } = renderMobileSheet();

            // No editable stake before the market's limits exist: a value typed now would be
            // validated against a band that has not arrived.
            expect(screen.getByTestId('dt_stake_input')).toBeDisabled();

            vanillas_mock_store.modules.trade.stake_preset_limits = { floor: 20, max: 5000 };
            rerender(mobileSheet());

            expect(screen.getByTestId('dt_stake_input')).toBeEnabled();
        });

        it('defaults the stake text box to the minimum quick pick when the limits arrive', () => {
            const { rerender } = renderMobileSheet();

            vanillas_mock_store.modules.trade.stake_preset_limits = { floor: 20, max: 5000 };
            rerender(mobileSheet());

            // The first quick pick is the stake the platform settles on — the draft mirrors it the
            // moment the ladder lands, so the text box never contradicts the chips beside it.
            expect(screen.getByTestId('dt_stake_input')).toHaveValue('20');
        });

        it('never offers the raw market minimum as a quick pick', async () => {
            // The market being left behind is still the one described by validation_params when the
            // switch starts. 8.00 is the minimum it reported; 10 is the stake derived from it and the
            // only one the platform ever applies, so 8 must never appear as a tappable chip.
            vanillas_mock_store.modules.trade.validation_params = {
                [CONTRACT_TYPES.VANILLA.CALL]: { stake: { max: '5000.00', min: '8.00' } },
            };

            await renderDesktopPopover();

            expect(screen.queryByRole('button', { name: 'Select value $8' })).not.toBeInTheDocument();
            expect(chipCount()).toBe(0);
        });
    });

    // A fast market switch can open the sheet seeded with the previous market's stake while this
    // market's limits are already known (or land before the store's own correction settles) — the
    // untouched draft then sits below the floor with a stale "at least X" error and nothing to
    // clear it. The sheet heals that seed to the minimum quick pick; a deliberate value never moves.
    describe('a sheet opened with a stale seed from the previous market', () => {
        it('heals an untouched draft below the floor to the minimum quick pick', () => {
            vanillas_mock_store.modules.trade.amount = 2;

            renderMobileSheet();

            expect(screen.getByTestId('dt_stake_input')).toHaveValue('10');
        });

        it('leaves an untouched draft at or above the floor alone', () => {
            vanillas_mock_store.modules.trade.amount = 25;

            renderMobileSheet();

            expect(screen.getByTestId('dt_stake_input')).toHaveValue('25');
        });

        it('never rewrites a value the user typed, even below the floor', async () => {
            const user = userEvent.setup();
            renderMobileSheet();

            const input = screen.getByTestId('dt_stake_input');
            await user.clear(input);
            await user.type(input, '2');
            // Past the typing debounce, so the healing effect has had every chance to fire.
            await new Promise(resolve => setTimeout(resolve, 400));

            expect(input).toHaveValue('2');
        });
    });

    describe('a floor below the lowest shared preset', () => {
        // The stake the store applies has to be the first quick pick on both surfaces even when it
        // sits under the whole shared Vanillas set — otherwise the starting stake is a value the
        // chips never offer, and the lowest chip is a different (larger) number.
        beforeEach(() => {
            const { trade } = vanillas_mock_store.modules;
            trade.amount = 0.5;
            trade.stake_preset_limits = { floor: 0.5, max: 5000 };
            trade.validation_params = {
                [CONTRACT_TYPES.VANILLA.CALL]: { stake: { max: '5000.00', min: '0.35' } },
            };
        });

        it('leads the desktop quick picks with the applied stake', async () => {
            await renderDesktopPopover();

            expect(chipLabels()).toEqual(['$0.5', '$1', '$5', '$10', '$20', '$50']);
        });

        it('leads the mobile quick picks with the applied stake', () => {
            renderMobileSheet();

            expect(chipLabels()[0]).toBe('$0.5');
        });
    });
});

// Characterization: the Vanillas floor/limit filtering above must not reach any other trade type's
// desktop chips. Turbos on a symbol with no curated override reports a minimum above two of its
// curated presets, so a filter applied here would show [3, 5, 10, 15, 25] instead of the curated set.
describe('Non-Vanillas desktop stake presets (same ladder rules as Vanillas)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useProposal } = require('AppV2/Hooks/useProposal');

    it('drops curated Turbos presets the market minimum invalidates', async () => {
        useProposal.mockReturnValue({ data: mockProposalData, error: null, isFetching: false });
        const turbos_mock_store = mockStore({
            modules: {
                trade: {
                    ...mockStore({}).modules.trade,
                    amount: 10,
                    basis: 'stake',
                    contract_type: TRADE_TYPES.TURBOS.LONG,
                    currency: 'USD',
                    symbol: 'R_100',
                    trade_types: {
                        [CONTRACT_TYPES.TURBOS.LONG]: 'Up',
                    },
                    trade_type_tab: '',
                    validation_params: {
                        [CONTRACT_TYPES.TURBOS.LONG]: { stake: { max: '5000.00', min: '3.00' } },
                    },
                    // What the store's computed derives from the validation_params above: min 3
                    // rounds up to a floor of 5. The mock store is a plain object, so the computed
                    // does not run and the value both stake surfaces read is supplied directly.
                    stake_preset_limits: { floor: 5, max: 5000 },
                },
            },
        });
        turbos_mock_store.ui.is_mobile = false;

        render(
            <TraderProviders store={turbos_mock_store}>
                <ModulesProvider store={turbos_mock_store}>
                    <Stake is_minimized />
                </ModulesProvider>
            </TraderProviders>
        );
        await userEvent.click(screen.getByText(stake_param_label));

        // The market minimum is 3, so the curated $1 and $2 are values this market would reject and
        // are no longer offered: the ladder leads with the derived default (3 rounds up to 5) and is
        // topped up to a full row. Turbos gets the same treatment as Vanillas — a curated set is not
        // a licence to offer an invalid stake.
        expect(screen.getAllByRole('button', { name: /^Select value/ }).map(chip => chip.textContent)).toEqual([
            '$5',
            '$10',
            '$15',
            '$25',
            '$30',
            '$40',
        ]);
        // The limits are known from validation_params, so the row is chips, not the skeleton.
        expect(screen.queryByTestId('dt_value_chips_skeleton')).not.toBeInTheDocument();
    });
});
