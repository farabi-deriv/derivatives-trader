import React from 'react';
import { BrowserRouter } from 'react-router-dom';

import { dayjs, trackAnalyticsEvent } from '@deriv/shared';
import { mockStore } from '@deriv/stores';
import type { TCoreStores } from '@deriv/stores/types';
import { render, screen } from '@testing-library/react';

import App from '../app';

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    trackAnalyticsEvent: jest.fn(),
}));

const mockTrackAnalyticsEvent = trackAnalyticsEvent as jest.MockedFunction<typeof trackAnalyticsEvent>;

// Mock external dependencies
jest.mock('@deriv/reports/src/Stores/useReportsStores', () => ({
    ReportsStoreProvider: ({ children }: { children: React.ReactNode }) => (
        <div data-testid='reports-provider'>{children}</div>
    ),
}));

jest.mock('@deriv-com/quill-ui', () => ({
    NotificationsProvider: ({ children }: { children: React.ReactNode }) => (
        <div data-testid='notifications-provider'>{children}</div>
    ),
    SnackbarProvider: ({ children }: { children: React.ReactNode }) => (
        <div data-testid='snackbar-provider'>{children}</div>
    ),
}));

jest.mock('Stores/init-store', () => jest.fn(rootStore => rootStore));

// AppShell reads the trader store through this, which the stubbed ModulesProvider below never supplies.
jest.mock('AppV2/Hooks/useIsPortraitPromptBlocking', () => jest.fn(() => false));

jest.mock('Stores/Providers/modules-providers', () => {
    const MockModulesProvider = ({ children }: { children: React.ReactNode }) => (
        <div data-testid='modules-provider'>{children}</div>
    );
    MockModulesProvider.displayName = 'MockModulesProvider';
    return MockModulesProvider;
});

jest.mock('../../trader-providers', () => {
    const { StoreProvider } = jest.requireActual('@deriv/stores');
    const MockTraderProviders = ({ children, store }: { children: React.ReactNode; store: TCoreStores }) => (
        <StoreProvider store={store}>
            <div data-testid='trader-providers'>{children}</div>
        </StoreProvider>
    );
    MockTraderProviders.displayName = 'MockTraderProviders';
    return MockTraderProviders;
});

jest.mock('../Components/ServicesErrorSnackbar', () => {
    const MockServicesErrorSnackbar = () => <div data-testid='services-error-snackbar' />;
    MockServicesErrorSnackbar.displayName = 'MockServicesErrorSnackbar';
    return MockServicesErrorSnackbar;
});

jest.mock('../Components/AutomationPanel/automation-stop-snackbar', () => {
    const MockAutomationStopSnackbar = () => <div data-testid='automation-stop-snackbar' />;
    MockAutomationStopSnackbar.displayName = 'MockAutomationStopSnackbar';
    return MockAutomationStopSnackbar;
});

jest.mock('../Containers/Notifications', () => {
    const MockNotifications = () => <div data-testid='notifications' />;
    MockNotifications.displayName = 'MockNotifications';
    return MockNotifications;
});

jest.mock('../Routes/router', () => {
    const MockRouter = () => <div data-testid='router' />;
    MockRouter.displayName = 'MockRouter';
    return MockRouter;
});

const mockRootStore = mockStore({
    common: {
        server_time: dayjs(new Date()).utc(),
    },
    client: {
        is_logged_in: false,
    },
    ui: {
        setPromptHandler: jest.fn(),
    },
});

const mockWs = {
    activeSymbols: jest.fn(),
    authorized: {
        activeSymbols: jest.fn(),
        subscribeProposalOpenContract: jest.fn(),
        send: jest.fn(),
    },
    buy: jest.fn(),
    storage: {
        contractsFor: jest.fn(),
        send: jest.fn(),
    },
    contractUpdate: jest.fn(),
    contractUpdateHistory: jest.fn(),
    subscribeTicksHistory: jest.fn(),
    forgetStream: jest.fn(),
    forget: jest.fn(),
    forgetAll: jest.fn(),
    send: jest.fn(),
    subscribeProposal: jest.fn(),
    subscribeTicks: jest.fn(),
    time: jest.fn(),
    tradingTimes: jest.fn(),
    wait: jest.fn(),
};

const renderApp = () => {
    return render(
        <BrowserRouter>
            <App
                passthrough={{
                    root_store: mockRootStore,
                    WS: mockWs,
                }}
            />
        </BrowserRouter>
    );
};

describe('App', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset document.head for each test
        document.head.innerHTML = '';
    });

    it('should render all required providers and components', () => {
        renderApp();

        expect(screen.getByTestId('trader-providers')).toBeInTheDocument();
        expect(screen.getByTestId('reports-provider')).toBeInTheDocument();
        expect(screen.getByTestId('modules-provider')).toBeInTheDocument();
        expect(screen.getByTestId('notifications-provider')).toBeInTheDocument();
        expect(screen.getByTestId('snackbar-provider')).toBeInTheDocument();
        expect(screen.getByTestId('notifications')).toBeInTheDocument();
        expect(screen.getByTestId('router')).toBeInTheDocument();
        expect(screen.getByTestId('services-error-snackbar')).toBeInTheDocument();
    });

    it('should call setPromptHandler(false) on unmount', () => {
        const { unmount } = renderApp();

        unmount();

        expect(mockRootStore.ui.setPromptHandler).toHaveBeenCalledWith(false);
    });

    it('should fire analytics event when not logging in', () => {
        renderApp();
        expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith('ce_dtrader_app_v2', { action: 'open' });
    });

    it('should not fire analytics event while login is in progress', () => {
        const loggingInStore = mockStore({
            common: { server_time: dayjs(new Date()).utc() },
            client: { is_logged_in: false, is_logging_in: true },
            ui: { setPromptHandler: jest.fn() },
        });
        render(
            <BrowserRouter>
                <App passthrough={{ root_store: loggingInStore, WS: mockWs }} />
            </BrowserRouter>
        );
        expect(mockTrackAnalyticsEvent).not.toHaveBeenCalled();
    });
});
