import { Router } from 'react-router-dom';
import { createMemoryHistory } from 'history';

import { routes } from '@deriv/shared';
import { mockStore, StoreProvider } from '@deriv/stores';
import { fireEvent, render, screen } from '@testing-library/react';

import useIsPhoneLandscape from 'AppV2/Hooks/useIsPhoneLandscape';
import { cancelPortraitRedirect, redirectOnPortrait } from 'AppV2/Utils/portrait-redirect-utils';

import Sidebar from '../sidebar';

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    getBrandUrl: jest.fn(() => 'https://deriv.com'),
    getHelpCentreUrl: jest.fn(() => 'https://deriv.com/helpcentre'),
}));

// Named stand-ins so a test can tell the active (Fill) icon from the resting (Regular) one.
jest.mock('@deriv/quill-icons', () => ({
    ...jest.requireActual('@deriv/quill-icons'),
    StandaloneClockThreeFillIcon: () => 'ClockFill',
    StandaloneClockThreeRegularIcon: () => 'ClockRegular',
}));

// The global svg stub renders an opaque element, so name it here to assert what it is given.
jest.mock('Assets/SvgComponents/settings/ic-manual-trading-fill.svg', () => {
    const IcManualTradingStub = ({ className }: { className?: string }) => (
        <span data-testid='dt_trade_icon' className={className} />
    );
    return IcManualTradingStub;
});

jest.mock('AppV2/Hooks/useIsPhoneLandscape', () => jest.fn(() => true));
jest.mock('AppV2/Utils/portrait-redirect-utils', () => ({
    cancelPortraitRedirect: jest.fn(),
    redirectOnPortrait: jest.fn(),
}));
let mock_is_rtl = false;
jest.mock('@deriv/api', () => ({ ...jest.requireActual('@deriv/api'), useIsRtl: () => mock_is_rtl }));
jest.mock('../language-selector', () => jest.fn(() => <div>LanguageSelector</div>));
jest.mock('../../PositionsDrawer/positions-drawer-tabs', () => jest.fn(() => <div>PositionsDrawerTabs</div>));

const mockUseIsPhoneLandscape = useIsPhoneLandscape as jest.Mock;

const buildStore = ({
    active_sidebar_flyout = null,
    is_logged_in = true,
}: { active_sidebar_flyout?: 'menu' | 'positions' | null; is_logged_in?: boolean } = {}) =>
    mockStore({
        ui: { active_sidebar_flyout, setSidebarFlyout: jest.fn(), closeSidebarFlyout: jest.fn() },
        client: { is_logged_in },
        portfolio: { active_positions_count: 0, onMount: jest.fn(), onUnmount: jest.fn() },
    });

const renderSidebar = (store = buildStore()) => {
    const history = createMemoryHistory();
    history.push(routes.index);
    render(
        <StoreProvider store={store}>
            <Router history={history}>
                <Sidebar />
            </Router>
        </StoreProvider>
    );
    return { store, history };
};

/** The rail's own items. Section wrappers share the `dt_sidebar_` prefix; only items are buttons. */
const railItemIds = () =>
    screen
        .getAllByTestId(/^dt_sidebar_/)
        .filter(node => node.tagName === 'BUTTON')
        .map(node => node.getAttribute('data-testid')?.replace('dt_sidebar_', ''));

describe('Sidebar — landscape rail', () => {
    afterEach(() => {
        mockUseIsPhoneLandscape.mockReturnValue(true);
        jest.clearAllMocks();
    });

    it('[LNV-001] replicates the mobile bottom nav: Home, Trade, Positions, Menu', () => {
        renderSidebar();

        expect(railItemIds()).toEqual(['home', 'trade', 'positions', 'menu']);
    });

    it('[LNV-001] keeps Automate off the rail, which has no landscape surface to open', () => {
        // The Figma frame still shows a robot as item 3; the recorded decision is to omit it.
        renderSidebar();

        expect(screen.queryByTestId('dt_sidebar_automate')).not.toBeInTheDocument();
    });

    it('[LNV-009] keeps Trade and Menu for a public user, dropping only Positions', () => {
        // A blanket `is_logged_in` gate left a signed-out rail showing Home alone.
        renderSidebar(buildStore({ is_logged_in: false }));

        expect(railItemIds()).toEqual(['home', 'trade', 'menu']);
    });

    it('[LNV-009] the public Menu drawer drops Reports, which is a protected route', () => {
        renderSidebar(buildStore({ active_sidebar_flyout: 'menu', is_logged_in: false }));

        expect(screen.queryByTestId('dt_menu_reports')).not.toBeInTheDocument();
        expect(screen.getByTestId('dt_menu_language')).toBeInTheDocument();
        expect(screen.getByTestId('dt_menu_theme')).toBeInTheDocument();
        expect(screen.getByTestId('dt_menu_help')).toBeInTheDocument();
    });

    it('[LNV-013] renders no utility section, so its separator leaves no stray rule', () => {
        // Its divider sits above the list, not per item, so an empty list still drew a rule.
        renderSidebar();

        expect(screen.queryByTestId('dt_sidebar_utility')).not.toBeInTheDocument();
    });

    it('[LNV-013] keeps the desktop utility section', () => {
        mockUseIsPhoneLandscape.mockReturnValue(false);

        renderSidebar();

        expect(screen.getByTestId('dt_sidebar_utility')).toBeInTheDocument();
    });

    it('[LNV-002] leaves the desktop rail untouched — the component is shared', () => {
        // The regression guard for gating on orientation inside a component every non-mobile width uses.
        mockUseIsPhoneLandscape.mockReturnValue(false);

        renderSidebar();

        expect(railItemIds()).toEqual(['home', 'positions', 'reports', 'help', 'language', 'theme', 'logout']);
    });

    it('[LNV-012] leaves Positions on its resting icon while its flyout is open', () => {
        // Flyouts open over the trade surface rather than navigating, so nothing else reads as current.
        renderSidebar(buildStore({ active_sidebar_flyout: 'positions' }));

        expect(screen.getByText('ClockRegular')).toBeInTheDocument();
        expect(screen.queryByText('ClockFill')).not.toBeInTheDocument();
    });

    it('[LNV-012] marks Trade as the rail’s permanently active item', () => {
        // The class carries the brand colour: the asset paints with `currentColor`, not a fill prop.
        renderSidebar();

        expect(screen.getByTestId('dt_trade_icon')).toHaveClass('sidebar__trade-icon');
    });

    it('[LNV-012] still fills the Positions icon on desktop, where it marks a section', () => {
        mockUseIsPhoneLandscape.mockReturnValue(false);

        renderSidebar(buildStore({ active_sidebar_flyout: 'positions' }));

        expect(screen.getByText('ClockFill')).toBeInTheDocument();
    });

    it('[LNV-014] dims the page behind an open side sheet', () => {
        renderSidebar(buildStore({ active_sidebar_flyout: 'menu' }));

        expect(screen.getByTestId('dt_landscape_flyout_backdrop')).toHaveClass('landscape-flyout-backdrop--visible');
    });

    it('[LNV-014] keeps the backdrop faded out with nothing open', () => {
        // Mounted but faded out, so opening fades it in with the sheet rather than snapping.
        renderSidebar();
        expect(screen.getByTestId('dt_landscape_flyout_backdrop')).not.toHaveClass(
            'landscape-flyout-backdrop--visible'
        );
    });

    it('[LNV-014] shows no backdrop on desktop', () => {
        mockUseIsPhoneLandscape.mockReturnValue(false);
        renderSidebar(buildStore({ active_sidebar_flyout: 'menu' }));
        expect(screen.queryByTestId('dt_landscape_flyout_backdrop')).not.toBeInTheDocument();
    });

    it('[LNV-015] Escape closes an open drawer, the keyboard way out now its close button is hidden', () => {
        const { store } = renderSidebar(buildStore({ active_sidebar_flyout: 'menu' }));

        fireEvent.keyDown(document, { key: 'Enter' });
        expect(store.ui.closeSidebarFlyout).not.toHaveBeenCalled();

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(store.ui.closeSidebarFlyout).toHaveBeenCalled();
    });

    it('[LNV-015] leaves Escape alone on desktop, where the flyout keeps its close button', () => {
        mockUseIsPhoneLandscape.mockReturnValue(false);
        const { store } = renderSidebar(buildStore({ active_sidebar_flyout: 'menu' }));

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(store.ui.closeSidebarFlyout).not.toHaveBeenCalled();
    });

    describe('[LNV-016] side sheet direction in Arabic', () => {
        afterEach(() => {
            mock_is_rtl = false;
        });

        // The wrapper carries the direction, since Flyout takes no `dir` of its own.
        // eslint-disable-next-line testing-library/no-node-access
        const sheetDir = () => screen.getByRole('dialog', { hidden: true }).closest('[dir]')?.getAttribute('dir');

        it('reads right-to-left in landscape, while the page behind stays left-to-right', () => {
            mock_is_rtl = true;
            renderSidebar(buildStore({ active_sidebar_flyout: 'menu' }));

            expect(sheetDir()).toBe('rtl');
        });

        it('leaves desktop Arabic as it is, left-to-right', () => {
            mock_is_rtl = true;
            mockUseIsPhoneLandscape.mockReturnValue(false);
            renderSidebar(buildStore({ active_sidebar_flyout: 'menu' }));

            expect(sheetDir()).toBeUndefined();
        });
    });

    it('[LNV-003] Menu opens its drawer', () => {
        const { store } = renderSidebar();

        fireEvent.click(screen.getByTestId('dt_sidebar_menu'));

        expect(store.ui.setSidebarFlyout).toHaveBeenCalledWith('menu');
    });

    it('[LNV-003] Menu closes the drawer when it is already open', () => {
        const { store } = renderSidebar(buildStore({ active_sidebar_flyout: 'menu' }));

        fireEvent.click(screen.getByTestId('dt_sidebar_menu'));

        expect(store.ui.setSidebarFlyout).toHaveBeenCalledWith(null);
    });

    it('[LNV-004] Trade returns to the trade page', () => {
        mockUseIsPhoneLandscape.mockReturnValue(true);
        const store = buildStore();
        const history = createMemoryHistory();
        history.push(routes.index);
        render(
            <StoreProvider store={store}>
                <Router history={history}>
                    <Sidebar />
                </Router>
            </StoreProvider>
        );

        fireEvent.click(screen.getByTestId('dt_sidebar_trade'));

        // Already there, so it only dismisses whatever drawer is over the chart.
        expect(store.ui.closeSidebarFlyout).toHaveBeenCalled();
        expect(history.location.pathname).toBe(routes.index);
    });

    describe('[LNV-006] Home', () => {
        const ROTATE_MESSAGE = 'Please rotate your device to portrait view.';
        const original_location = window.location;

        beforeEach(() => {
            // Navigation is the thing under test, and jsdom cannot perform it.
            Object.defineProperty(window, 'location', { value: { href: '' }, writable: true, configurable: true });
        });

        afterEach(() => {
            Object.defineProperty(window, 'location', { value: original_location, writable: true, configurable: true });
        });

        it('asks to rotate instead of leaving for the portrait-only home page', () => {
            renderSidebar();

            fireEvent.click(screen.getByTestId('dt_sidebar_home'));

            expect(screen.getByRole('dialog', { name: ROTATE_MESSAGE })).toBeInTheDocument();
            expect(window.location.href).toBe('');
            expect(redirectOnPortrait).toHaveBeenCalledWith(expect.stringContaining('https://deriv.com/home?'));
        });

        it('closes the prompt on dismiss and drops the queued redirect', () => {
            renderSidebar();
            fireEvent.click(screen.getByTestId('dt_sidebar_home'));

            fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

            expect(screen.queryByRole('dialog', { name: ROTATE_MESSAGE })).not.toBeInTheDocument();
            expect(cancelPortraitRedirect).toHaveBeenCalled();
        });

        it('navigates home as usual in portrait', () => {
            mockUseIsPhoneLandscape.mockReturnValue(false);
            renderSidebar();

            fireEvent.click(screen.getByTestId('dt_sidebar_home'));

            expect(screen.queryByRole('dialog', { name: ROTATE_MESSAGE })).not.toBeInTheDocument();
            expect(window.location.href).toContain('https://deriv.com/home?');
        });
    });

    it('[LNV-005] the Menu drawer carries the rows the rail gave up', () => {
        renderSidebar(buildStore({ active_sidebar_flyout: 'menu' }));

        ['reports', 'language', 'theme', 'help', 'logout'].forEach(row =>
            expect(screen.getByTestId(`dt_menu_${row}`)).toBeInTheDocument()
        );
    });
});
