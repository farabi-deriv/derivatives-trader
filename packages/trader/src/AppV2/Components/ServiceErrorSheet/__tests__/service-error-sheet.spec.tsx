import React from 'react';
import { Router } from 'react-router-dom';
import { createMemoryHistory } from 'history';

import * as fileUtils from '@deriv/shared';
import { mockStore } from '@deriv/stores';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TraderProviders from '../../../../trader-providers';
import ServiceErrorSheet from '../service-error-sheet';

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useHistory: () => ({
        push: jest.fn(),
    }),
}));
jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    redirectToLogin: jest.fn(),
    redirectToSignUp: jest.fn(),
    getBrandUrl: jest.fn(() => 'https://home.deriv.com/dashboard'),
}));

// Mock window.location.href
delete (window as any).location;
window.location = { href: '' } as any;

describe('ServiceErrorSheet', () => {
    let default_mock_store: ReturnType<typeof mockStore>;

    const history = createMemoryHistory();
    beforeEach(() => {
        jest.clearAllMocks();
        default_mock_store = mockStore({
            client: { is_logged_in: true, is_virtual: false, currency: 'USD' },
            common: {
                services_error: {
                    code: 'InsufficientBalance',
                    message: 'Your account balance (0.00 USD) is insufficient to buy this contract (10.00 USD).',
                    type: 'buy',
                },
                resetServicesError: jest.fn(),
            },
        });
        // Reset window.location.href before each test
        window.location.href = '';
    });

    const mockTrade = () => {
        return (
            <Router history={history}>
                <TraderProviders store={default_mock_store}>
                    <ServiceErrorSheet />
                </TraderProviders>
            </Router>
        );
    };

    it('renders the modal with appropriate message and action for InsufficientBalance error', async () => {
        render(mockTrade());

        expect(screen.getByText('Insufficient balance')).toBeInTheDocument();

        await userEvent.click(screen.getByText(/deposit now/i));
        expect(default_mock_store.common.resetServicesError).toBeCalled();
    });

    it('renders the Action Sheet with appropriate message and actions for AuthorizationRequired error', async () => {
        const spyRedirectToLogin = jest.spyOn(fileUtils, 'redirectToLogin');
        default_mock_store.common.services_error.code = 'AuthorizationRequired';
        render(mockTrade());

        expect(screen.getByText('Start trading with us')).toBeInTheDocument();

        await userEvent.click(screen.getByText('Create free account'));
        expect(default_mock_store.common.resetServicesError).toBeCalled();

        await userEvent.click(screen.getByText('Login'));
        expect(spyRedirectToLogin).toBeCalled();
    });

    it('does not render the Action Sheet if there is no services_error', () => {
        default_mock_store.common.services_error = {};
        const { container } = render(mockTrade());

        expect(container).toBeEmptyDOMElement();
    });

    it('should redirect to brand deposit page when "Deposit now" is clicked for real accounts', async () => {
        render(mockTrade());

        expect(screen.getByText('Insufficient balance')).toBeInTheDocument();

        const depositButton = screen.getByText(/Deposit now/i);
        await userEvent.click(depositButton);

        expect(fileUtils.getBrandUrl).toHaveBeenCalled();
        expect(window.location.href).toBe(
            'https://home.deriv.com/dashboard/transfer?from=dtrader&source=options&acc=options&curr=USD&lang=EN'
        );
        expect(default_mock_store.common.resetServicesError).toHaveBeenCalled();
    });

    it('should show "OK" button for virtual accounts instead of "Deposit now"', async () => {
        default_mock_store.client.is_virtual = true;
        render(mockTrade());

        expect(screen.getByText('Insufficient balance')).toBeInTheDocument();
        expect(screen.queryByText(/Deposit now/i)).not.toBeInTheDocument();

        const okButton = screen.getByText(/ok/i);
        expect(okButton).toBeInTheDocument();

        await userEvent.click(okButton);
        expect(default_mock_store.common.resetServicesError).toHaveBeenCalled();
    });

    describe('Backend error message is shown as-is, without balance-aware substitution', () => {
        it('shows the backend message on desktop regardless of balance', () => {
            default_mock_store.client.balance = 0;
            render(mockTrade());

            expect(screen.getByText('Insufficient balance')).toBeInTheDocument();
            expect(
                screen.getByText('Your account balance (0.00 USD) is insufficient to buy this contract (10.00 USD).')
            ).toBeInTheDocument();
            expect(screen.queryByText('Balance is empty. Deposit funds to buy this contract.')).not.toBeInTheDocument();
        });

        it('shows the backend message on desktop when balance is below the stake', () => {
            default_mock_store.client.balance = '4.00';
            default_mock_store.modules.trade.amount = 10;
            render(mockTrade());

            expect(screen.getByText('Insufficient balance')).toBeInTheDocument();
            expect(
                screen.getByText('Your account balance (0.00 USD) is insufficient to buy this contract (10.00 USD).')
            ).toBeInTheDocument();
            expect(screen.queryByText('You only have 4.00 USD left. Try a lower stake.')).not.toBeInTheDocument();
        });

        it('shows the backend message on mobile regardless of balance', () => {
            default_mock_store.ui.is_mobile = true;
            default_mock_store.client.balance = 0;
            render(mockTrade());

            expect(
                screen.getByText('Your account balance (0.00 USD) is insufficient to buy this contract (10.00 USD).')
            ).toBeInTheDocument();
            expect(screen.queryByText('Balance is empty. Deposit funds to buy this contract.')).not.toBeInTheDocument();
        });

        it('shows the backend message on mobile when balance is below the stake', () => {
            default_mock_store.ui.is_mobile = true;
            default_mock_store.client.balance = '4.00';
            default_mock_store.modules.trade.amount = 10;
            render(mockTrade());

            expect(
                screen.getByText('Your account balance (0.00 USD) is insufficient to buy this contract (10.00 USD).')
            ).toBeInTheDocument();
            expect(screen.queryByText('You only have 4.00 USD left. Try a lower stake.')).not.toBeInTheDocument();
        });
    });

    describe('Deposit / OK actions', () => {
        it('[MBR-002] should redirect to the brand transfer URL when "Deposit now" is clicked', async () => {
            window.location.href = '';
            render(mockTrade());

            const depositButton = screen.getByText(/Deposit now/i);
            await userEvent.click(depositButton);

            expect(window.location.href).toContain('home.deriv.com/dashboard/transfer');
            expect(window.location.href).toContain('curr=USD');
        });

        it('should not redirect when the "OK" button is clicked for virtual accounts', async () => {
            default_mock_store.client.is_virtual = true;
            window.location.href = '';
            render(mockTrade());

            const okButton = screen.getByText(/ok/i);
            await userEvent.click(okButton);

            expect(window.location.href).not.toContain('/transfer');
        });
    });
});
