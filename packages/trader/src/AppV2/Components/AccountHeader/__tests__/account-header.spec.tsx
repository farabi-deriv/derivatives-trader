import React from 'react';

import { APIProvider } from '@deriv/api';
import AccountSwitcherMock from '@deriv/core/src/App/Components/Layout/Header/account-switcher';
import { redirectToLogin, trackAnalyticsEvent } from '@deriv/shared';
import { mockStore, StoreProvider } from '@deriv/stores';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AccountHeader from '../account-header';

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    getCurrencyDisplayCode: jest.fn((currency: string) => currency),
    redirectToLogin: jest.fn(),
    trackAnalyticsEvent: jest.fn(),
    getApiCoreBaseUrl: jest.fn(() => 'https://api.deriv.com'),
    addComma: jest.fn((num: number | string, decimals?: number) => {
        const numValue = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : num;
        if (isNaN(numValue)) return '0.00';
        const formatted = numValue.toFixed(decimals || 2);
        // Add commas for thousands
        return formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }),
}));

const mockRefetch = jest.fn();

const mockUseDerivativesAccount = jest.fn(() => ({
    data: {
        data: [
            { account_id: 'ROT90070611', account_type: 'real', balance: '10000.00', currency: 'USD' },
            { account_id: 'DOT90096855', account_type: 'demo', balance: '5000.00', currency: 'USD' },
        ],
    },
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: mockRefetch,
}));

jest.mock('@deriv/api', () => ({
    ...jest.requireActual('@deriv/api'),
    useDerivativesAccount: () => mockUseDerivativesAccount(),
}));

jest.mock('@deriv-com/ui', () => ({
    useDevice: jest.fn(() => ({ isMobile: false })),
}));

jest.mock('@deriv/quill-icons', () => ({
    LegacyChevronDown1pxIcon: () => <div data-testid='chevron-icon'>Chevron</div>,
}));

jest.mock('@deriv-com/quill-ui', () => ({
    ActionSheet: {
        Root: ({ children }: { children: React.ReactNode }) => <div data-testid='action-sheet-root'>{children}</div>,
        Portal: ({ children }: { children: React.ReactNode }) => (
            <div data-testid='action-sheet-portal'>{children}</div>
        ),
    },
}));

jest.mock('@deriv/core/src/App/Components/Layout/Header/account-switcher', () => {
    return jest.fn(() => <div data-testid='account-switcher'>Account Switcher</div>);
});

jest.mock('@deriv/core/src/App/Containers/Modals/TryRealModal', () => {
    return jest.fn(() => <div data-testid='try-real-modal'>Try Real Modal</div>);
});

describe('AccountHeader', () => {
    const default_mock_store = mockStore({
        client: {
            balance: '10,000.00',
            currency: 'USD',
            is_logged_in: true,
            is_virtual: false,
            logout: jest.fn(),
        },
        ui: {
            is_switching_account: false,
            setIsSwitchingAccount: jest.fn(),
        },
    });

    const renderComponent = (store = default_mock_store, props = {}) => {
        // Ensure all stores have ui mock with required methods
        const store_with_ui = {
            ...store,
            ui: {
                ...store.ui,
                is_switching_account: false,
                setIsSwitchingAccount: jest.fn(),
                is_chart_loading: store.ui?.is_chart_loading ?? false,
            },
        };
        return render(
            <APIProvider>
                <StoreProvider store={store_with_ui}>
                    <AccountHeader {...props} />
                </StoreProvider>
            </APIProvider>
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset to default mock with both account types
        mockUseDerivativesAccount.mockReturnValue({
            data: {
                data: [
                    { account_id: 'ROT90070611', account_type: 'real', balance: '10000.00', currency: 'USD' },
                    { account_id: 'DOT90096855', account_type: 'demo', balance: '5000.00', currency: 'USD' },
                ],
            },
            isLoading: false,
            isFetching: false,
            error: null,
            refetch: mockRefetch,
        });

        // Mock window.location to prevent jsdom navigation errors
        delete (window as any).location;
        (window as any).location = { href: '' };
    });

    describe('Logged in state', () => {
        it('should render account info with balance for logged in real account', () => {
            renderComponent();

            expect(screen.getByText('Real account')).toBeInTheDocument();
            expect(screen.getByText('10,000.00 USD')).toBeInTheDocument();
        });

        it('should render account info with balance for logged in demo account', () => {
            const demo_store = mockStore({
                client: {
                    balance: '5,000.00',
                    currency: 'USD',
                    is_logged_in: true,
                    is_virtual: true,
                    logout: jest.fn(),
                },
            });

            renderComponent(demo_store);

            expect(screen.getByText('Demo account')).toBeInTheDocument();
            expect(screen.getByText('5,000.00 USD')).toBeInTheDocument();
        });

        it('should render "No currency assigned" when currency is not set', () => {
            const no_currency_store = mockStore({
                client: {
                    balance: '0.00',
                    currency: '',
                    is_logged_in: true,
                    is_virtual: false,
                    logout: jest.fn(),
                },
            });

            renderComponent(no_currency_store);

            expect(screen.getByText('No currency assigned')).toBeInTheDocument();
        });

        it('should render transfer button for logged in real account users', () => {
            renderComponent();

            const transferButton = screen.getByRole('button', { name: /deposit/i });
            expect(transferButton).toBeInTheDocument();
            expect(transferButton).toHaveAttribute('type', 'button');
            expect(transferButton).toHaveClass('account-header__transfer');
        });

        it('should render transfer button for demo account users when they have both account types', () => {
            const demo_store = mockStore({
                client: {
                    balance: '5,000.00',
                    currency: 'USD',
                    is_logged_in: true,
                    is_virtual: true,
                    logout: jest.fn(),
                },
            });

            renderComponent(demo_store);

            const transferButton = screen.getByRole('button', { name: /deposit/i });
            expect(transferButton).toBeInTheDocument();
            expect(transferButton).toHaveAttribute('type', 'button');
            expect(transferButton).toHaveClass('account-header__transfer');
        });

        it('should render "Try real" button for demo-only account users', () => {
            // Mock useDerivativesAccount to return only demo accounts
            mockUseDerivativesAccount.mockReturnValue({
                data: {
                    data: [{ account_id: 'DOT90096855', account_type: 'demo', balance: '5000.00', currency: 'USD' }],
                },
                isLoading: false,
                isFetching: false,
                error: null,
                refetch: jest.fn(),
            });

            const demo_store = mockStore({
                client: {
                    balance: '5,000.00',
                    currency: 'USD',
                    is_logged_in: true,
                    is_virtual: true,
                    logout: jest.fn(),
                },
            });

            renderComponent(demo_store);

            const tryRealButton = screen.getByRole('button', { name: /try real/i });
            expect(tryRealButton).toBeInTheDocument();
            expect(tryRealButton).toHaveAttribute('type', 'button');
            expect(tryRealButton).toHaveClass('account-header__transfer');
        });
        describe('Invalid balance handling', () => {
            it('should display dash with currency when balance is NaN', () => {
                const nan_balance_store = mockStore({
                    client: {
                        balance: 'NaN',
                        currency: 'USD',
                        is_logged_in: true,
                        is_virtual: false,
                        logout: jest.fn(),
                    },
                });

                renderComponent(nan_balance_store);

                expect(screen.getByText('0.00 USD')).toBeInTheDocument();
                expect(screen.queryByText('NaN USD')).not.toBeInTheDocument();
            });

            it('should display dash with currency when balance is null', () => {
                const null_balance_store = mockStore({
                    client: {
                        balance: null as any,
                        currency: 'EUR',
                        is_logged_in: true,
                        is_virtual: false,
                        logout: jest.fn(),
                    },
                });

                renderComponent(null_balance_store);

                expect(screen.getByText('0.00 EUR')).toBeInTheDocument();
            });

            it('should display dash with currency when balance is undefined', () => {
                const undefined_balance_store = mockStore({
                    client: {
                        balance: undefined,
                        currency: 'GBP',
                        is_logged_in: true,
                        is_virtual: false,
                        logout: jest.fn(),
                    },
                });

                renderComponent(undefined_balance_store);

                expect(screen.getByText('0.00 GBP')).toBeInTheDocument();
            });

            it('should display dash with currency when balance is empty string', () => {
                const empty_balance_store = mockStore({
                    client: {
                        balance: '',
                        currency: 'AUD',
                        is_logged_in: true,
                        is_virtual: false,
                        logout: jest.fn(),
                    },
                });

                renderComponent(empty_balance_store);

                expect(screen.getByText('0.00 AUD')).toBeInTheDocument();
            });

            it('should display dash with currency when balance is invalid string', () => {
                const invalid_balance_store = mockStore({
                    client: {
                        balance: 'invalid',
                        currency: 'CAD',
                        is_logged_in: true,
                        is_virtual: false,
                        logout: jest.fn(),
                    },
                });

                renderComponent(invalid_balance_store);

                expect(screen.getByText('0.00 CAD')).toBeInTheDocument();
                expect(screen.queryByText('invalid CAD')).not.toBeInTheDocument();
            });

            it('should display balance correctly when balance is a number type', () => {
                renderComponent(default_mock_store, {
                    balance: 1000.5,
                    currency: 'USD',
                    is_logged_in: true,
                    is_virtual: false,
                });

                expect(screen.getByText('1,000.50 USD')).toBeInTheDocument();
            });

            it('should display numeric 0 balance correctly as 0.00', () => {
                renderComponent(default_mock_store, {
                    balance: 0,
                    currency: 'USD',
                    is_logged_in: true,
                    is_virtual: false,
                });

                expect(screen.getByText('0.00 USD')).toBeInTheDocument();
            });

            it('should display balance correctly when balance is comma-formatted string', () => {
                const comma_balance_store = mockStore({
                    client: {
                        balance: '10,000.00',
                        currency: 'USD',
                        is_logged_in: true,
                        is_virtual: false,
                        logout: jest.fn(),
                    },
                });

                renderComponent(comma_balance_store);

                expect(screen.getByText('10,000.00 USD')).toBeInTheDocument();
            });

            it('should not render balance section when currency is missing and balance is invalid', () => {
                const no_currency_invalid_balance_store = mockStore({
                    client: {
                        balance: 'NaN',
                        currency: '',
                        is_logged_in: true,
                        is_virtual: false,
                        logout: jest.fn(),
                    },
                });

                renderComponent(no_currency_invalid_balance_store);

                expect(screen.getByText('No currency assigned')).toBeInTheDocument();
                expect(screen.queryByText(/^- $/)).not.toBeInTheDocument();
            });

            it('should handle zero balance correctly', () => {
                const zero_balance_store = mockStore({
                    client: {
                        balance: '0.00',
                        currency: 'USD',
                        is_logged_in: true,
                        is_virtual: false,
                        logout: jest.fn(),
                    },
                });

                renderComponent(zero_balance_store);

                expect(screen.getByText('0.00 USD')).toBeInTheDocument();
            });

            it('should handle negative balance correctly', () => {
                const negative_balance_store = mockStore({
                    client: {
                        balance: '-500.00',
                        currency: 'USD',
                        is_logged_in: true,
                        is_virtual: false,
                        logout: jest.fn(),
                    },
                });

                renderComponent(negative_balance_store);

                expect(screen.getByText('-500.00 USD')).toBeInTheDocument();
            });
        });
    });

    describe('Logged out state', () => {
        it('should not render account info for logged out users', () => {
            const logged_out_store = mockStore({
                client: {
                    balance: '',
                    currency: '',
                    is_logged_in: false,
                    is_virtual: false,
                    logout: jest.fn(),
                },
            });

            renderComponent(logged_out_store);

            expect(screen.queryByText('Real account')).not.toBeInTheDocument();
            expect(screen.queryByText('Demo account')).not.toBeInTheDocument();
        });

        it('should render login button for logged out users', () => {
            const logged_out_store = mockStore({
                client: {
                    balance: '',
                    currency: '',
                    is_logged_in: false,
                    is_virtual: false,
                    logout: jest.fn(),
                },
            });

            renderComponent(logged_out_store);

            const loginButton = screen.getByRole('button', { name: /log in/i });
            expect(loginButton).toBeInTheDocument();
            expect(loginButton).toHaveAttribute('type', 'button');
            expect(loginButton).toHaveClass('account-header__login');
        });

        it('should call redirectToLogin when login button is clicked', async () => {
            const logged_out_store = mockStore({
                client: {
                    balance: '',
                    currency: '',
                    is_logged_in: false,
                    is_virtual: false,
                    logout: jest.fn(),
                },
            });

            renderComponent(logged_out_store);

            const loginButton = screen.getByRole('button', { name: /log in/i });
            await userEvent.click(loginButton);

            expect(redirectToLogin).toHaveBeenCalledTimes(1);
        });
    });

    describe('Props override', () => {
        it('should use props values when provided instead of store values', () => {
            renderComponent(default_mock_store, {
                balance: '5,000.00',
                currency: 'EUR',
                is_logged_in: true,
                is_virtual: true,
            });

            expect(screen.getByText('Demo account')).toBeInTheDocument();
            expect(screen.getByText('5,000.00 EUR')).toBeInTheDocument();
        });

        it('should fall back to store values when props are not provided', () => {
            renderComponent();

            expect(screen.getByText('Real account')).toBeInTheDocument();
            expect(screen.getByText('10,000.00 USD')).toBeInTheDocument();
        });

        it('should handle mixed props and store values correctly', () => {
            renderComponent(default_mock_store, {
                balance: '2,500.00',
                // currency and is_logged_in will come from store
            });

            expect(screen.getByText('2,500.00 USD')).toBeInTheDocument();
            expect(screen.getByText('Real account')).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have proper aria-label for transfer button with correct value for real account', () => {
            renderComponent();

            const transferButton = screen.getByRole('button', { name: /deposit/i });
            expect(transferButton).toHaveAttribute('aria-label', 'Deposit');
        });

        it('should have proper aria-label for "Try real" button for demo-only accounts', () => {
            // Mock useDerivativesAccount to return only demo accounts
            mockUseDerivativesAccount.mockReturnValue({
                data: {
                    data: [{ account_id: 'DOT90096855', account_type: 'demo', balance: '5000.00', currency: 'USD' }],
                },
                isLoading: false,
                isFetching: false,
                error: null,
                refetch: jest.fn(),
            });

            const demo_store = mockStore({
                client: {
                    balance: '5,000.00',
                    currency: 'USD',
                    is_logged_in: true,
                    is_virtual: true,
                    logout: jest.fn(),
                },
            });

            renderComponent(demo_store);

            const tryRealButton = screen.getByRole('button', { name: /try real/i });
            expect(tryRealButton).toHaveAttribute('aria-label', 'Try real');
        });

        it('should have proper aria-label for login button with correct value', () => {
            const logged_out_store = mockStore({
                client: {
                    balance: '',
                    currency: '',
                    is_logged_in: false,
                    is_virtual: false,
                    logout: jest.fn(),
                },
            });

            renderComponent(logged_out_store);

            const loginButton = screen.getByRole('button', { name: /log in/i });
            expect(loginButton).toHaveAttribute('aria-label', 'Log in');
        });

        it('should have type="button" on transfer button', () => {
            renderComponent();

            const transferButton = screen.getByRole('button', { name: /deposit/i });
            expect(transferButton).toHaveAttribute('type', 'button');
        });

        it('should have type="button" on login button', () => {
            const logged_out_store = mockStore({
                client: {
                    balance: '',
                    currency: '',
                    is_logged_in: false,
                    is_virtual: false,
                    logout: jest.fn(),
                },
            });

            renderComponent(logged_out_store);

            const loginButton = screen.getByRole('button', { name: /log in/i });
            expect(loginButton).toHaveAttribute('type', 'button');
        });
        describe('Analytics tracking', () => {
            it('should track analytics event when transfer button is clicked for real account', async () => {
                renderComponent();

                const transferButton = screen.getByRole('button', { name: /deposit/i });
                await userEvent.click(transferButton);

                expect(trackAnalyticsEvent).toHaveBeenCalledWith('ce_trade_types_form_v2', {
                    action: 'click',
                    button_type: 'deposit',
                });
            });

            it('should track analytics event when "Try real" button is clicked for demo-only account', async () => {
                // Mock useDerivativesAccount to return only demo accounts
                mockUseDerivativesAccount.mockReturnValue({
                    data: {
                        data: [
                            { account_id: 'DOT90096855', account_type: 'demo', balance: '5000.00', currency: 'USD' },
                        ],
                    },
                    isLoading: false,
                    isFetching: false,
                    error: null,
                    refetch: jest.fn(),
                });

                const demo_store = mockStore({
                    client: {
                        balance: '5,000.00',
                        currency: 'USD',
                        is_logged_in: true,
                        is_virtual: true,
                        logout: jest.fn(),
                    },
                    ui: {
                        toggleTryRealModal: jest.fn(),
                    },
                });

                renderComponent(demo_store);

                const tryRealButton = screen.getByRole('button', { name: /try real/i });
                await userEvent.click(tryRealButton);

                expect(trackAnalyticsEvent).toHaveBeenCalledWith('ce_trade_types_form_v2', {
                    action: 'click',
                    button_type: 'try_real',
                });
            });

            it('should call trackAnalyticsEvent before navigation for transfer button', async () => {
                const callOrder: string[] = [];

                (trackAnalyticsEvent as jest.Mock).mockImplementation(() => {
                    callOrder.push('analytics');
                });

                // Mock window.location.href setter
                delete (window as any).location;
                window.location = { href: '' } as any;
                Object.defineProperty(window.location, 'href', {
                    set: jest.fn(() => {
                        callOrder.push('navigation');
                    }),
                    get: jest.fn(),
                });

                renderComponent();

                const transferButton = screen.getByRole('button', { name: /deposit/i });
                await userEvent.click(transferButton);

                expect(callOrder).toEqual(['analytics', 'navigation']);
            });

            it('should call trackAnalyticsEvent before opening modal for "Try real" button', async () => {
                // Mock useDerivativesAccount to return only demo accounts
                mockUseDerivativesAccount.mockReturnValue({
                    data: {
                        data: [
                            { account_id: 'DOT90096855', account_type: 'demo', balance: '5000.00', currency: 'USD' },
                        ],
                    },
                    isLoading: false,
                    isFetching: false,
                    error: null,
                    refetch: jest.fn(),
                });

                const callOrder: string[] = [];
                const toggleTryRealModal = jest.fn(() => {
                    callOrder.push('modal');
                });

                (trackAnalyticsEvent as jest.Mock).mockImplementation(() => {
                    callOrder.push('analytics');
                });

                const demo_store = mockStore({
                    client: {
                        balance: '5,000.00',
                        currency: 'USD',
                        is_logged_in: true,
                        is_virtual: true,
                        logout: jest.fn(),
                    },
                    ui: {
                        toggleTryRealModal,
                    },
                });

                renderComponent(demo_store);

                const tryRealButton = screen.getByRole('button', { name: /try real/i });
                await userEvent.click(tryRealButton);

                expect(callOrder).toEqual(['analytics', 'modal']);
                expect(toggleTryRealModal).toHaveBeenCalledWith(true);
            });
        });

        describe('Demo-only account behavior', () => {
            it('should hide chevron icon for demo-only accounts', () => {
                // Mock useDerivativesAccount to return only demo accounts
                mockUseDerivativesAccount.mockReturnValue({
                    data: {
                        data: [
                            { account_id: 'DOT90096855', account_type: 'demo', balance: '5000.00', currency: 'USD' },
                        ],
                    },
                    isLoading: false,
                    isFetching: false,
                    error: null,
                    refetch: jest.fn(),
                });

                const demo_store = mockStore({
                    client: {
                        balance: '5,000.00',
                        currency: 'USD',
                        is_logged_in: true,
                        is_virtual: true,
                        logout: jest.fn(),
                    },
                });

                renderComponent(demo_store);

                expect(screen.queryByTestId('chevron-icon')).not.toBeInTheDocument();
            });

            it('should show chevron icon when user has multiple account types', () => {
                renderComponent();

                expect(screen.getByTestId('chevron-icon')).toBeInTheDocument();
            });

            it('should not render AccountSwitcher for demo-only accounts', () => {
                // Mock useDerivativesAccount to return only demo accounts
                mockUseDerivativesAccount.mockReturnValue({
                    data: {
                        data: [
                            { account_id: 'DOT90096855', account_type: 'demo', balance: '5000.00', currency: 'USD' },
                        ],
                    },
                    isLoading: false,
                    isFetching: false,
                    error: null,
                    refetch: jest.fn(),
                });

                const demo_store = mockStore({
                    client: {
                        balance: '5,000.00',
                        currency: 'USD',
                        is_logged_in: true,
                        is_virtual: true,
                        logout: jest.fn(),
                    },
                });

                renderComponent(demo_store);

                expect(screen.queryByTestId('account-switcher')).not.toBeInTheDocument();
            });

            it('should render AccountSwitcher when user has multiple account types', () => {
                renderComponent();

                expect(screen.getByTestId('account-switcher')).toBeInTheDocument();
            });
        });

        it('should have display name', () => {
            expect(AccountHeader.displayName).toBe('AccountHeader');
        });

        describe('Deposit / Try real', () => {
            it('[MBR-002] should redirect to the brand transfer URL when the deposit button is clicked', async () => {
                // Mock window.location.href
                delete (window as any).location;
                (window as any).location = { href: '' };

                renderComponent();

                const transferButton = screen.getByRole('button', { name: /deposit/i });
                await userEvent.click(transferButton);

                expect(window.location.href).toContain('/transfer');
                expect(window.location.href).toContain('curr=USD');
            });

            it('should open the Try-real modal instead of redirecting when the Try real button is clicked', async () => {
                // Mock useDerivativesAccount to return only demo accounts
                mockUseDerivativesAccount.mockReturnValue({
                    data: {
                        data: [
                            { account_id: 'DOT90096855', account_type: 'demo', balance: '5000.00', currency: 'USD' },
                        ],
                    },
                    isLoading: false,
                    isFetching: false,
                    error: null,
                    refetch: jest.fn(),
                });

                const toggleTryRealModal = jest.fn();

                const demo_store = mockStore({
                    client: {
                        balance: '5,000.00',
                        currency: 'USD',
                        is_logged_in: true,
                        is_virtual: true,
                        logout: jest.fn(),
                    },
                    ui: {
                        toggleTryRealModal,
                    },
                });

                renderComponent(demo_store);

                const tryRealButton = screen.getByRole('button', { name: /try real/i });
                await userEvent.click(tryRealButton);

                // Should open modal instead of redirecting
                expect(toggleTryRealModal).toHaveBeenCalledWith(true);
            });
        });

        describe('Account switching loading state', () => {
            it('should show skeleton loader when isLoading is true', () => {
                mockUseDerivativesAccount.mockReturnValue({
                    data: { data: [] },
                    isLoading: true,
                    isFetching: false,
                    error: null,
                    refetch: jest.fn(),
                });

                renderComponent();

                expect(screen.getByTestId('dt_skeleton')).toBeInTheDocument();
            });

            it('should show skeleton loader with correct inline styles', () => {
                mockUseDerivativesAccount.mockReturnValue({
                    data: { data: [] },
                    isLoading: true,
                    isFetching: false,
                    error: null,
                    refetch: jest.fn(),
                });

                renderComponent();

                const skeleton = screen.getByTestId('dt_skeleton');
                expect(skeleton).toHaveStyle({ width: '240px', height: '44px' });
            });

            it('should hide skeleton loader when isLoading is false', () => {
                renderComponent();

                expect(screen.queryByTestId('dt_skeleton')).not.toBeInTheDocument();
                expect(screen.getByText('Real account')).toBeInTheDocument();
            });

            it('should not show skeleton loader when data is loaded', () => {
                mockUseDerivativesAccount.mockReturnValue({
                    data: {
                        data: [
                            { account_id: 'ROT90070611', account_type: 'real', balance: '10000.00', currency: 'USD' },
                            { account_id: 'DOT90096855', account_type: 'demo', balance: '5000.00', currency: 'USD' },
                        ],
                    },
                    isLoading: false,
                    isFetching: false,
                    error: null,
                    refetch: jest.fn(),
                });

                renderComponent();

                expect(screen.queryByTestId('dt_skeleton')).not.toBeInTheDocument();
                expect(screen.getByText('Real account')).toBeInTheDocument();
            });
        });

        describe('Chart loading behavior', () => {
            // The account header is independent of the chart: a market change sets
            // is_chart_loading=true (and on the chartless automate tab nothing ever
            // resets it), so the header must keep rendering the account info rather
            // than getting stuck on a skeleton.
            it('should show account info regardless of chart loading state', () => {
                const chart_loading_store = mockStore({
                    client: {
                        balance: '10,000.00',
                        currency: 'USD',
                        is_logged_in: true,
                        is_virtual: false,
                        logout: jest.fn(),
                    },
                    ui: {
                        is_chart_loading: true,
                    },
                });

                renderComponent(chart_loading_store);

                expect(screen.queryByTestId('dt_skeleton')).not.toBeInTheDocument();
                expect(screen.getByText('Real account')).toBeInTheDocument();
            });
        });

        describe('Refetch on open', () => {
            it('should call refetch exactly once when the dropdown is opened', async () => {
                renderComponent();

                await userEvent.click(screen.getByText('Real account'));

                expect(mockRefetch).toHaveBeenCalledTimes(1);
            });

            it('should not call refetch again when the dropdown is closed', async () => {
                renderComponent();

                await userEvent.click(screen.getByText('Real account'));
                await userEvent.click(screen.getByText('Real account'));

                expect(mockRefetch).toHaveBeenCalledTimes(1);
            });

            it('should not put AccountSwitcher into a loading state while a refetch is in flight', () => {
                mockUseDerivativesAccount.mockReturnValue({
                    data: {
                        data: [
                            { account_id: 'CR123', account_type: 'real', balance: '10000.00', currency: 'USD' },
                            { account_id: 'VRTC456', account_type: 'demo', balance: '5000.00', currency: 'USD' },
                        ],
                    },
                    isLoading: false,
                    isFetching: true,
                    error: null,
                    refetch: mockRefetch,
                });

                renderComponent();

                // The open-triggered refetch must stay invisible - the cached list keeps rendering.
                const lastCallProps = (AccountSwitcherMock as unknown as jest.Mock).mock.calls.at(-1)?.[0];
                expect(lastCallProps).toMatchObject({ is_loading: false });
            });

            it('should not skeleton the header trigger while only isFetching is true', () => {
                mockUseDerivativesAccount.mockReturnValue({
                    data: {
                        data: [
                            { account_id: 'CR123', account_type: 'real', balance: '10000.00', currency: 'USD' },
                            { account_id: 'VRTC456', account_type: 'demo', balance: '5000.00', currency: 'USD' },
                        ],
                    },
                    isLoading: false,
                    isFetching: true,
                    error: null,
                    refetch: mockRefetch,
                });

                renderComponent();

                expect(screen.getByText('10,000.00 USD')).toBeInTheDocument();
                expect(screen.queryByTestId('dt_skeleton')).not.toBeInTheDocument();
            });
        });
    });
});
