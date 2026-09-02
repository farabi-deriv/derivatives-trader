import { mockStore } from '@deriv/stores';
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

    it('does not render a commission row', () => {
        renderStakeDetails();

        expect(screen.queryByText('Commission')).not.toBeInTheDocument();
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

    it('does not render the multiplier rows for non-multiplier contracts', () => {
        renderStakeDetails({ is_multiplier: false, should_show_payout_details: true });

        expect(screen.queryByText('Stop out')).not.toBeInTheDocument();
        expect(screen.queryByText('Stop out level')).not.toBeInTheDocument();
    });
});
