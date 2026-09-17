import { mockStore } from '@deriv/stores';
import { useDevice } from '@deriv-com/ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ModulesProvider from 'Stores/Providers/modules-providers';

import TraderProviders from '../../../../../trader-providers';
import StakeDetails from '../stake-details';

jest.mock('@deriv-com/ui', () => ({
    ...jest.requireActual('@deriv-com/ui'),
    useDevice: jest.fn(() => ({ isDesktop: false })),
}));

const base_props = {
    contract_type: 'multiplier',
    contract_types: ['MULTUP'],
    currency: 'USD',
    is_loading_proposal: false,
    is_multiplier: true,
    is_empty: false,
    should_show_payout_details: false,
    details: {
        first_contract_payout: 0,
        max_payout: '',
        max_stake: '',
        min_stake: '',
        second_contract_payout: 0,
        stop_out: -10,
    },
};

describe('StakeDetails multiplier info', () => {
    // The desktop hover test below flips this; every other test is the mobile sheet.
    beforeEach(() => (useDevice as jest.Mock).mockReturnValue({ isDesktop: false }));

    const renderStakeDetails = (props = {}, trade_overrides = {}) => {
        const store = mockStore({
            modules: { trade: { amount: 10, multiplier: 100, stop_out_level: '8160.12', ...trade_overrides } },
        });
        return render(
            <TraderProviders store={store}>
                <ModulesProvider store={store}>
                    <StakeDetails {...base_props} {...props} />
                </ModulesProvider>
            </TraderProviders>
        );
    };

    // The component takes no risk-management input at all, so there is no state in which it can
    // suppress the row — the Stop loss coupling that hid it (#1305) is gone from its contract.
    it('renders the Stop out row for the multipliers variant', () => {
        renderStakeDetails();

        expect(screen.getByText('Stop out')).toBeInTheDocument();
        expect(screen.getByText('$10.00')).toBeInTheDocument();
    });

    it('keeps the Stop out row visible with a placeholder when no stop out amount is priced', () => {
        renderStakeDetails({ details: { ...base_props.details, stop_out: 0 } });

        expect(screen.getByText('Stop out')).toBeInTheDocument();
        expect(screen.queryByText('$10.00')).not.toBeInTheDocument();
        expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    });

    it('opens the Stop out explanation (in-sheet page) when the Stop out label is tapped', async () => {
        const onOpenStopOut = jest.fn();
        renderStakeDetails({ onOpenStopOut });

        await userEvent.click(screen.getByText('Stop out'));

        expect(onOpenStopOut).toHaveBeenCalledTimes(1);
    });

    it('opens the Stop out level explanation (in-sheet page) when the label is tapped', async () => {
        const onOpenStopOutLevel = jest.fn();
        renderStakeDetails({ onOpenStopOut: jest.fn(), onOpenStopOutLevel });

        await userEvent.click(screen.getByText('Stop out level'));

        expect(onOpenStopOutLevel).toHaveBeenCalledTimes(1);
    });

    it('leaves the Stop out level label plain on desktop (no in-sheet page)', () => {
        renderStakeDetails();

        expect(screen.getByText('Stop out level')).not.toHaveClass('stake-content__info-label');
    });

    it('renders the stop out level without a currency symbol', () => {
        renderStakeDetails();

        expect(screen.getByText('Stop out level')).toBeInTheDocument();
        expect(screen.getByText('8160.12')).toBeInTheDocument();
        expect(screen.queryByText('$8160.12')).not.toBeInTheDocument();
    });

    it('re-reads the stop out level from the store rather than freezing the first value', () => {
        // The popover's own proposal is a one-shot request, so a stop out level derived from it
        // froze at whatever the spot was when the popover opened. Reading the store means each
        // render reflects the current value. (mockStore is a plain object, so this covers the
        // re-read, not the MobX subscription that drives it in the app.)
        const renderWithLevel = (stop_out_level: string) => {
            const store = mockStore({ modules: { trade: { amount: 10, multiplier: 100, stop_out_level } } });
            return (
                <TraderProviders store={store}>
                    <ModulesProvider store={store}>
                        <StakeDetails {...base_props} />
                    </ModulesProvider>
                </TraderProviders>
            );
        };

        const { rerender } = render(renderWithLevel('8160.12'));
        expect(screen.getByText('8160.12')).toBeInTheDocument();

        rerender(renderWithLevel('8175.40'));

        expect(screen.getByText('8175.40')).toBeInTheDocument();
        expect(screen.queryByText('8160.12')).not.toBeInTheDocument();
    });

    it('renders the stop out amount with a currency symbol', () => {
        renderStakeDetails();

        expect(screen.getByText('$10.00')).toBeInTheDocument();
    });

    it('[MCD-001] [MCD-003] renders the Commission row with a currency-formatted amount', () => {
        renderStakeDetails({ details: { ...base_props.details, commission: 0.5 } });

        expect(screen.getByText('Commission')).toBeInTheDocument();
        expect(screen.getByText('$0.50')).toBeInTheDocument();
    });

    it('[MCD-004] keeps the Commission row visible with a placeholder when no commission is priced', () => {
        renderStakeDetails();

        expect(screen.getByText('Commission')).toBeInTheDocument();
        expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    });

    it('[MCD-004] keeps the Commission row visible with a placeholder for a zero commission', () => {
        renderStakeDetails({ details: { ...base_props.details, commission: 0 } });

        expect(screen.getByText('Commission')).toBeInTheDocument();
        expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
        expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    });

    it('[MCD-004] shows a placeholder for the commission while the stake input is empty', () => {
        renderStakeDetails({ details: { ...base_props.details, commission: 0.5 }, is_empty: true });

        expect(screen.getByText('Commission')).toBeInTheDocument();
        expect(screen.queryByText('$0.50')).not.toBeInTheDocument();
        expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    });

    it('[MCD-005] opens the Commission explanation (in-sheet page) when the label is tapped', async () => {
        const onOpenCommission = jest.fn();
        renderStakeDetails({ details: { ...base_props.details, commission: 0.5 }, onOpenCommission });

        await userEvent.click(screen.getByText('Commission'));

        expect(onOpenCommission).toHaveBeenCalledTimes(1);
    });

    it('[MCD-009] leaves the Commission label inert when the percentage cannot be derived', async () => {
        const onOpenCommission = jest.fn();
        renderStakeDetails({ onOpenCommission });

        await userEvent.click(screen.getByText('Commission'));

        expect(onOpenCommission).not.toHaveBeenCalled();
        expect(screen.getByText('Commission')).not.toHaveClass('stake-content__info-label');
    });

    it('[MCD-005] reveals the formula on hover in the desktop popover, where there is no in-sheet page', async () => {
        (useDevice as jest.Mock).mockReturnValue({ isDesktop: true });
        renderStakeDetails({ details: { ...base_props.details, commission: 0.5 } });

        await userEvent.hover(screen.getByText('Commission'));

        // commission_percentage = (0.5 * 100) / (100 * 10) = 0.0500
        expect(screen.getByText('0.0500%')).toBeInTheDocument();
    });

    // D9: the numerator is the drafted stake's commission, so the divisor must be the drafted stake
    // too — pairing it with the committed one inflated the percentage ten-fold.
    it('[MCD-009] [MCD-006] derives the percentage from the drafted stake, not the committed one', async () => {
        renderStakeDetails({ details: { ...base_props.details, commission: 5, drafted_amount: 100 } });

        await userEvent.click(screen.getByText('Commission'));

        expect(screen.getByText('0.0500%')).toBeInTheDocument();
        expect(screen.queryByText('0.5000%')).not.toBeInTheDocument();
    });

    // The Stop out pair is untouched by the Commission row joining it.
    it('[MCD-008] leaves the Stop out sources and formats unchanged alongside Commission', () => {
        renderStakeDetails({ details: { ...base_props.details, commission: 0.5 } });

        expect(screen.getByText('$10.00')).toBeInTheDocument();
        expect(screen.getByText('8160.12')).toBeInTheDocument();
        expect(screen.queryByText('$8160.12')).not.toBeInTheDocument();
        expect(screen.getByText('Commission')).toBeInTheDocument();
    });

    it('falls back to a placeholder when the proposal has no stop out level yet', () => {
        renderStakeDetails({}, { stop_out_level: undefined });

        expect(screen.getByText('Stop out level')).toBeInTheDocument();
        expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    });

    it('shows a placeholder for the stop out level while the stake input is empty', () => {
        renderStakeDetails({ is_empty: true });

        expect(screen.queryByText('8160.12')).not.toBeInTheDocument();
        expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    });

    it('[MCD-007] does not render the multiplier rows for non-multiplier contracts', () => {
        renderStakeDetails({
            details: { ...base_props.details, commission: 0.5 },
            is_multiplier: false,
            should_show_payout_details: true,
        });

        expect(screen.queryByText('Stop out')).not.toBeInTheDocument();
        expect(screen.queryByText('Stop out level')).not.toBeInTheDocument();
        expect(screen.queryByText('Commission')).not.toBeInTheDocument();
    });
});
