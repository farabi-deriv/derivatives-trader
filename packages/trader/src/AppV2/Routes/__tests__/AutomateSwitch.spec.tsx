import { Router } from 'react-router-dom';
import { createMemoryHistory } from 'history';

import { mockStore, StoreProvider } from '@deriv/stores';
import { useDevice } from '@deriv-com/ui';
import { render, screen } from '@testing-library/react';

import { TRADE_PANEL_TABS } from 'AppV2/Components/AutomationPanel/automation-config';
import useIsAutomationEnabled from 'AppV2/Hooks/useIsAutomationEnabled';

import AutomateSwitch from '../AutomateSwitch';

const mockSetActiveTradePanelTab = jest.fn();
let mockIsPhoneLandscape = false;
jest.mock('AppV2/Hooks/useIsPhoneLandscape', () => () => mockIsPhoneLandscape);

jest.mock('AppV2/Hooks/useIsAutomationEnabled', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('@deriv-com/ui', () => ({
    ...jest.requireActual('@deriv-com/ui'),
    useDevice: jest.fn(),
}));

jest.mock('Stores/useTraderStores', () => ({
    useTraderStore: () => ({ setActiveTradePanelTab: mockSetActiveTradePanelTab }),
}));

jest.mock('AppV2/Containers/Automate', () => {
    const Automate = () => <div data-testid='automate-page'>Automate</div>;
    Automate.displayName = 'Automate';
    return { __esModule: true, default: Automate };
});

describe('AutomateSwitch', () => {
    const renderComponent = (isMobile: boolean, initialPath = '/automate') => {
        (useDevice as jest.Mock).mockReturnValue({ isMobile });
        const history = createMemoryHistory({ initialEntries: [initialPath] });
        const store = mockStore({});

        render(
            <StoreProvider store={store}>
                <Router history={history}>
                    <AutomateSwitch />
                </Router>
            </StoreProvider>
        );

        return { history, store };
    };

    beforeEach(() => {
        // Default: EU status resolved and automation available (not an EU/DIEL account).
        (useIsAutomationEnabled as jest.Mock).mockReturnValue({ is_enabled: true, is_ready: true });
    });

    afterEach(() => {
        jest.clearAllMocks();
        mockIsPhoneLandscape = false;
    });

    it('[AUT-001] keeps a phone rotated to landscape on /automate, rather than taking the desktop path', async () => {
        // `isMobile` is width-only, so a rotated phone read as desktop: it switched on the desktop panel
        // tab and redirected, landing the automation pair on the trade page.
        mockIsPhoneLandscape = true;
        const { history } = renderComponent(false);

        expect(await screen.findByTestId('automate-page')).toBeInTheDocument();
        expect(history.location.pathname).toBe('/automate');
        expect(mockSetActiveTradePanelTab).not.toHaveBeenCalled();
    });

    it('should render Automate page on mobile when enabled', async () => {
        renderComponent(true);
        expect(await screen.findByTestId('automate-page')).toBeInTheDocument();
    });

    it('should not render Automate page on desktop', () => {
        renderComponent(false);
        expect(screen.queryByTestId('automate-page')).not.toBeInTheDocument();
    });

    it('should redirect to index route on desktop', () => {
        const { history } = renderComponent(false);
        expect(history.location.pathname).toBe('/');
    });

    it('should select the automation panel tab on desktop', () => {
        renderComponent(false);
        expect(mockSetActiveTradePanelTab).toHaveBeenCalledWith(TRADE_PANEL_TABS.AUTOMATION);
    });

    it('should redirect to index and not render the page when automation is unavailable (even on mobile)', () => {
        (useIsAutomationEnabled as jest.Mock).mockReturnValue({ is_enabled: false, is_ready: true });
        const { history } = renderComponent(true);
        expect(screen.queryByTestId('automate-page')).not.toBeInTheDocument();
        expect(history.location.pathname).toBe('/');
    });

    it('should not redirect while EU status is still resolving on mobile', () => {
        (useIsAutomationEnabled as jest.Mock).mockReturnValue({ is_enabled: false, is_ready: false });
        const { history } = renderComponent(true, '/automate');
        // Stays on /automate (no premature bounce) and shows a loader, not the page.
        expect(screen.queryByTestId('automate-page')).not.toBeInTheDocument();
        expect(history.location.pathname).toBe('/automate');
    });
});
