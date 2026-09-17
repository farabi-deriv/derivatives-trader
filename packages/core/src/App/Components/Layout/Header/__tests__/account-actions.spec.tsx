import { trackAnalyticsEvent } from '@deriv/shared';
import { mockStore, StoreProvider } from '@deriv/stores';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AccountInfoMock from 'App/Components/Layout/Header/account-info';

import { AccountActions } from '../account-actions';

// Mock dependencies
jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    getBrandUrl: jest.fn(() => 'https://deriv.com'),
    trackAnalyticsEvent: jest.fn(),
}));

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
    refetch: jest.fn(),
}));

jest.mock('@deriv/api', () => ({
    ...jest.requireActual('@deriv/api'),
    useDerivativesAccount: () => mockUseDerivativesAccount(),
}));

jest.mock('@deriv-com/ui', () => ({
    useDevice: jest.fn(() => ({ isDesktop: true, isMobile: false })),
}));

jest.mock('../login-button', () => ({
    LoginButton: () => <div data-testid='dt_login_button'>Login Button</div>,
}));

// Mock the dynamic import of AccountInfo
jest.mock('App/Components/Layout/Header/account-info', () => ({
    __esModule: true,
    default: jest.fn(() => <div data-testid='dt_account_info'>Account Info</div>),
}));

describe('AccountActions component', () => {
    const default_mock_store = {
        client: {
            currency: 'USD',
            is_logged_in: true,
            is_virtual: false,
            logout: jest.fn(),
        },
        common: {
            current_language: 'en',
        },
        ui: {
            is_switching_account: false,
            setIsSwitchingAccount: jest.fn(),
        },
    };

    const renderWithStore = (store_override = {}) => {
        const merged_store = { ...default_mock_store, ...store_override };
        // Ensure ui mock has required methods
        const store_with_ui = {
            ...merged_store,
            ui: {
                ...merged_store.ui,
                is_switching_account: false,
                setIsSwitchingAccount: jest.fn(),
            },
        };
        const mock_store_instance = mockStore(store_with_ui);
        return render(
            <StoreProvider store={mock_store_instance}>
                <AccountActions />
            </StoreProvider>
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
            refetch: jest.fn(),
        });
    });

    it('should render AccountInfo when logged in', async () => {
        renderWithStore();

        // Wait for lazy component to load
        await screen.findByTestId('dt_account_info');
        expect(screen.getByTestId('dt_account_info')).toBeInTheDocument();
    });

    it('should render deposit button when logged in (non-virtual)', async () => {
        renderWithStore();

        await screen.findByTestId('dt_account_info');
        const deposit_button = screen.getByRole('button', { name: /deposit/i });
        expect(deposit_button).toBeInTheDocument();
    });

    it('should render deposit button when logged in with both account types (virtual)', async () => {
        renderWithStore({
            client: {
                ...default_mock_store.client,
                is_virtual: true,
            },
        });

        await screen.findByTestId('dt_account_info');
        const deposit_button = screen.getByRole('button', { name: /deposit/i });
        expect(deposit_button).toBeInTheDocument();
    });

    it('should render "Try real" button for demo-only accounts', async () => {
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

        renderWithStore({
            client: {
                ...default_mock_store.client,
                is_virtual: true,
            },
        });

        await screen.findByTestId('dt_account_info');
        const try_real_button = screen.getByRole('button', { name: /try real/i });
        expect(try_real_button).toBeInTheDocument();
    });

    it('should render login button when not logged in', () => {
        renderWithStore({
            client: {
                ...default_mock_store.client,
                is_logged_in: false,
            },
        });

        expect(screen.getByTestId('dt_login_button')).toBeInTheDocument();
    });

    it('should not render account info when not logged in', () => {
        renderWithStore({
            client: {
                ...default_mock_store.client,
                is_logged_in: false,
            },
        });

        expect(screen.queryByTestId('dt_account_info')).not.toBeInTheDocument();
    });

    it('should handle deposit button click for real accounts', async () => {
        // Mock window.location.href
        delete (window as any).location;
        (window as any).location = { href: '' };

        renderWithStore();

        await screen.findByTestId('dt_account_info');
        const deposit_button = screen.getByRole('button', { name: /deposit/i });
        await userEvent.click(deposit_button);

        expect(window.location.href).toContain('deriv.com/transfer');
        expect(window.location.href).toContain('curr=USD');
    });

    it('should handle "Try real" button click for demo-only accounts and open modal', async () => {
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

        const toggleTryRealModal = jest.fn();

        renderWithStore({
            client: {
                ...default_mock_store.client,
                is_virtual: true,
            },
            ui: {
                toggleTryRealModal,
            },
        });

        await screen.findByTestId('dt_account_info');
        const try_real_button = screen.getByRole('button', { name: /try real/i });
        await userEvent.click(try_real_button);

        expect(toggleTryRealModal).toHaveBeenCalledWith(true);
    });

    describe('Analytics tracking', () => {
        it('should track analytics event with "deposit" button_type for deposit button', async () => {
            renderWithStore();

            await screen.findByTestId('dt_account_info');
            const deposit_button = screen.getByRole('button', { name: /deposit/i });
            await userEvent.click(deposit_button);

            expect(trackAnalyticsEvent).toHaveBeenCalledWith('ce_trade_types_form_v2', {
                action: 'click',
                button_type: 'deposit',
            });
        });

        it('should track analytics event with "try_real" button_type for Try real button', async () => {
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

            const toggleTryRealModal = jest.fn();

            renderWithStore({
                client: {
                    ...default_mock_store.client,
                    is_virtual: true,
                },
                ui: {
                    toggleTryRealModal,
                },
            });

            await screen.findByTestId('dt_account_info');
            const try_real_button = screen.getByRole('button', { name: /try real/i });
            await userEvent.click(try_real_button);

            expect(trackAnalyticsEvent).toHaveBeenCalledWith('ce_trade_types_form_v2', {
                action: 'click',
                button_type: 'try_real',
            });
        });
    });

    describe('Deposit / Try real', () => {
        it('[MBR-002] should redirect to the brand transfer URL when the deposit button is clicked', async () => {
            // Mock window.location.href
            delete (window as any).location;
            (window as any).location = { href: '' };

            renderWithStore();

            await screen.findByTestId('dt_account_info');
            const deposit_button = screen.getByRole('button', { name: /deposit/i });
            await userEvent.click(deposit_button);

            expect(window.location.href).toContain('deriv.com/transfer');
            expect(window.location.href).toContain('curr=USD');
        });

        it('should open the Try-real modal instead of redirecting when the Try real button is clicked', async () => {
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

            const toggleTryRealModal = jest.fn();

            renderWithStore({
                client: {
                    ...default_mock_store.client,
                    is_virtual: true,
                },
                ui: {
                    toggleTryRealModal,
                },
            });

            await screen.findByTestId('dt_account_info');
            const try_real_button = screen.getByRole('button', { name: /try real/i });
            await userEvent.click(try_real_button);

            // Should open modal instead of redirecting
            expect(toggleTryRealModal).toHaveBeenCalledWith(true);
        });
    });

    describe('Account switching loading state', () => {
        it('should show skeleton loaders when isLoading is true', () => {
            mockUseDerivativesAccount.mockReturnValue({
                data: { data: [] },
                isLoading: true,
                isFetching: false,
                error: null,
                refetch: jest.fn(),
            });

            renderWithStore();

            const skeletons = screen.getAllByTestId('dt_skeleton');
            expect(skeletons).toHaveLength(2);
        });

        it('should reset loading state when query completes', async () => {
            let currentIsLoading = true;
            const mockRefetch = jest.fn();

            mockUseDerivativesAccount.mockImplementation(() => ({
                data: {
                    data: currentIsLoading
                        ? []
                        : [
                              { account_id: 'ROT90070611', account_type: 'real', balance: '10000.00', currency: 'USD' },
                              { account_id: 'DOT90096855', account_type: 'demo', balance: '5000.00', currency: 'USD' },
                          ],
                },
                isLoading: currentIsLoading,
                isFetching: false,
                error: null,
                refetch: mockRefetch,
            }));

            const { rerender } = renderWithStore();

            expect(screen.getAllByTestId('dt_skeleton')).toHaveLength(2);

            currentIsLoading = false;
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

            rerender(
                <StoreProvider store={mockStore(default_mock_store)}>
                    <AccountActions />
                </StoreProvider>
            );

            await screen.findByTestId('dt_account_info');
            expect(screen.queryByTestId('dt_skeleton')).not.toBeInTheDocument();
        });

        it('should render skeleton loaders with correct inline styles', () => {
            mockUseDerivativesAccount.mockReturnValue({
                data: { data: [] },
                isLoading: true,
                isFetching: false,
                error: null,
                refetch: jest.fn(),
            });

            renderWithStore();

            const skeletons = screen.getAllByTestId('dt_skeleton');
            expect(skeletons[0]).toHaveStyle({ width: '120px', height: '32px' });
            expect(skeletons[1]).toHaveStyle({ width: '80px', height: '32px' });
        });
    });

    describe('Refetch on open', () => {
        it('should not put AccountInfo into a loading state while a refetch is in flight', async () => {
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
                refetch: jest.fn(),
            });

            renderWithStore();

            await screen.findByTestId('dt_account_info');
            // The open-triggered refetch must stay invisible - the cached list keeps rendering.
            const lastCallProps = (AccountInfoMock as unknown as jest.Mock).mock.calls.at(-1)?.[0];
            expect(lastCallProps).toMatchObject({ isLoading: false });
        });

        it('should not show the container header skeleton while only isFetching is true', async () => {
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
                refetch: jest.fn(),
            });

            renderWithStore();

            await screen.findByTestId('dt_account_info');
            expect(screen.queryByTestId('dt_skeleton')).not.toBeInTheDocument();
            expect(screen.getByTestId('dt_core_header_acc-info-container')).not.toHaveClass(
                'acc-info__container--loading'
            );
        });
    });
});
