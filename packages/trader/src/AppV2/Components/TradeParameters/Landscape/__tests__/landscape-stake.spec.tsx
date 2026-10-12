import { mockStore } from '@deriv/stores';
import { fireEvent, render, screen } from '@testing-library/react';

import ModulesProvider from 'Stores/Providers/modules-providers';

import TraderProviders from '../../../../../trader-providers';
import LandscapeTradeParams from '../landscape-trade-params';

jest.mock('AppV2/Components/PurchaseButton', () => {
    const MockPurchaseButton = () => <button data-testid='purchase-button'>Buy</button>;
    return { __esModule: true, default: () => <MockPurchaseButton /> };
});

// Balance contract (CLAUDE.md): landscape has no client-side balance check. An unaffordable stake
// commits; Buy stays pressable and the server-reported sheet explains the shortfall.
const buildStore = () => {
    const onChange = jest.fn();
    const store = mockStore({
        client: { balance: '5', currency: 'USD' },
        ui: { is_landscape_chrome_hidden: false },
        modules: {
            trade: {
                ...mockStore({}).modules.trade,
                is_accumulator: true,
                currency: 'USD',
                basis: 'stake',
                amount: 5,
                is_market_closed: false,
                has_open_accu_contract: false,
                validation_params: {
                    ACCU: { stake: { min: '5', max: '6' }, take_profit: { min: '1', max: '10' } },
                },
                onChange,
                onChangeMultiple: jest.fn(),
            },
        },
    });
    return { store, onChange };
};

describe('Landscape stake balance contract', () => {
    it('[LTP-008] an unaffordable stake commits with no hint, leaving Buy pressable and the chip neutral', () => {
        const { store, onChange } = buildStore();

        render(
            <TraderProviders store={store}>
                <ModulesProvider store={store}>
                    <LandscapeTradeParams />
                </ModulesProvider>
            </TraderProviders>
        );

        const stake_chip = screen.getByTestId('dt_landscape_chip_stake');

        // The arrow key both opens the panel and steps: $5.00 (affordable) up to $5.25 (> balance 5).
        fireEvent.keyDown(stake_chip, { key: 'ArrowUp' });

        expect(screen.queryByText(/Try a lower stake/)).not.toBeInTheDocument();
        expect(onChange).toHaveBeenCalledWith({ target: { name: 'amount', value: 5.25 } });
        // Buy stays present and is not disabled by any client-side balance check.
        const buy = screen.getByTestId('purchase-button');
        expect(buy).toBeInTheDocument();
        expect(buy).toBeEnabled();
        // The stake chip carries no error class.
        expect(stake_chip).not.toHaveClass('landscape-params__chip--error');
    });
});
