import React, { act } from 'react';
import { Router } from 'react-router-dom';
import { createMemoryHistory } from 'history';

import { mockStore, StoreProvider } from '@deriv/stores';
import { useDevice } from '@deriv-com/ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import MenuPage from '../menu';

jest.mock('@deriv-com/ui', () => ({
    ...jest.requireActual('@deriv-com/ui'),
    useDevice: jest.fn(() => ({ isMobile: true, isDesktop: false })),
}));

jest.mock('@deriv-com/translations', () => ({
    useTranslations: jest.fn(() => ({
        localize: (str: string) => str,
    })),
}));

jest.mock('App/Components/Layout/Header/Components/ToggleMenu', () => ({
    MobileLanguageMenu: jest.fn(() => <div data-testid='dt_mobile_language_menu' />),
}));

jest.mock('App/Components/Layout/Header/menu-link', () => jest.fn(({ text }: { text: string }) => <div>{text}</div>));

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    getHelpCentreUrl: jest.fn(() => 'https://help.deriv.com'),
}));

describe('MenuPage', () => {
    let history: ReturnType<typeof createMemoryHistory>, default_mock_store: ReturnType<typeof mockStore>;

    beforeEach(() => {
        history = createMemoryHistory();
        (useDevice as jest.Mock).mockReturnValue({ isMobile: true, isDesktop: false });
        default_mock_store = mockStore({
            client: {
                is_logged_in: true,
                logout: jest.fn(),
            },
            ui: {
                is_dark_mode_on: false,
                setDarkMode: jest.fn(),
            },
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const renderMenuPage = (store = default_mock_store) =>
        render(
            <StoreProvider store={store}>
                <Router history={history}>
                    <MenuPage />
                </Router>
            </StoreProvider>
        );

    describe('Non-mobile redirect', () => {
        it('should not render menu content on desktop', () => {
            (useDevice as jest.Mock).mockReturnValue({ isMobile: false, isDesktop: true });
            renderMenuPage();

            expect(screen.queryByText('Reports')).not.toBeInTheDocument();
            expect(screen.queryByText('Settings')).not.toBeInTheDocument();
        });
    });

    describe('Rendering', () => {
        it('should render the Reports section with all items', () => {
            renderMenuPage();

            expect(screen.getByText('Reports')).toBeInTheDocument();
            expect(screen.getByText('Open positions')).toBeInTheDocument();
            expect(screen.getByText('Trade table')).toBeInTheDocument();
            expect(screen.getByText('Statement')).toBeInTheDocument();
        });

        it('[MBR-003] should render the Settings section with the Language item', () => {
            renderMenuPage();

            expect(screen.getByText('Settings')).toBeInTheDocument();
            // 'Language' appears in the Settings item and the drawer header
            expect(screen.getAllByText('Language').length).toBeGreaterThan(0);
        });

        it('[MBR-003] should render the Support section', () => {
            renderMenuPage();

            expect(screen.getByText('Support')).toBeInTheDocument();
            expect(screen.getByText('Help centre')).toBeInTheDocument();
        });

        it('[MBR-003] should render Log out when user is logged in', () => {
            renderMenuPage();

            expect(screen.getByText('Log out')).toBeInTheDocument();
        });

        it('should not render Log out when user is not logged in', () => {
            const store = mockStore({
                ...default_mock_store,
                client: { is_logged_in: false, logout: jest.fn() },
            });
            renderMenuPage(store);

            expect(screen.queryByText('Log out')).not.toBeInTheDocument();
        });
    });

    describe('Navigation', () => {
        it('should navigate to open positions when clicked', async () => {
            const user = userEvent.setup();
            renderMenuPage();

            await act(async () => {
                await user.click(screen.getByText('Open positions'));
            });

            expect(history.location.pathname).toBe('/reports/positions');
        });

        it('should navigate to trade table when clicked', async () => {
            const user = userEvent.setup();
            renderMenuPage();

            await act(async () => {
                await user.click(screen.getByText('Trade table'));
            });

            expect(history.location.pathname).toBe('/reports/profit');
        });

        it('should navigate to statement when clicked', async () => {
            const user = userEvent.setup();
            renderMenuPage();

            await act(async () => {
                await user.click(screen.getByText('Statement'));
            });

            expect(history.location.pathname).toBe('/reports/statement');
        });
    });

    describe('Language selector', () => {
        it('should open language drawer when Language is clicked', async () => {
            const user = userEvent.setup();
            renderMenuPage();
            const drawer = screen.getByTestId('dt_menu_language_drawer');

            expect(drawer).not.toHaveClass('menu-page__language-drawer--open');

            // 'Language' appears in both the Settings item and the drawer header;
            // click the first occurrence (the Settings section item)
            await act(async () => {
                await user.click(screen.getAllByText('Language')[0]);
            });

            expect(drawer).toHaveClass('menu-page__language-drawer--open');
        });

        it('should close language drawer when back button is clicked', async () => {
            const user = userEvent.setup();
            renderMenuPage();

            await act(async () => {
                await user.click(screen.getAllByText('Language')[0]);
            });

            const drawer = screen.getByTestId('dt_menu_language_drawer');
            expect(drawer).toHaveClass('menu-page__language-drawer--open');

            await act(async () => {
                await user.click(screen.getByTestId('dt_menu_language_close'));
            });

            expect(drawer).not.toHaveClass('menu-page__language-drawer--open');
        });
    });

    describe('Theme selection', () => {
        const makeThemeStore = (ui_overrides: Record<string, unknown>) =>
            mockStore({
                ...default_mock_store,
                ui: { setThemePreference: jest.fn(), ...ui_overrides },
            });

        it('renders a Theme item in Settings that opens the theme drawer', async () => {
            const user = userEvent.setup();
            renderMenuPage(makeThemeStore({ theme_preference: 'system', is_dark_mode_on: false }));
            const drawer = screen.getByTestId('dt_menu_theme_drawer');

            expect(drawer).not.toHaveClass('menu-page__theme-drawer--open');

            // 'Theme' appears in both the Settings item and the drawer header;
            // click the first occurrence (the Settings section item)
            await act(async () => {
                await user.click(screen.getAllByText('Theme')[0]);
            });

            expect(drawer).toHaveClass('menu-page__theme-drawer--open');
        });

        it('closes the theme drawer when the back button is clicked', async () => {
            const user = userEvent.setup();
            renderMenuPage(makeThemeStore({ theme_preference: 'system', is_dark_mode_on: false }));

            await act(async () => {
                await user.click(screen.getAllByText('Theme')[0]);
            });

            const drawer = screen.getByTestId('dt_menu_theme_drawer');
            expect(drawer).toHaveClass('menu-page__theme-drawer--open');

            await act(async () => {
                await user.click(screen.getByTestId('dt_menu_theme_close'));
            });

            expect(drawer).not.toHaveClass('menu-page__theme-drawer--open');
        });

        it('renders the Light, Dark and System options inside the theme drawer and no toggle switch', () => {
            renderMenuPage(makeThemeStore({ theme_preference: 'system', is_dark_mode_on: false }));

            const drawer = screen.getByTestId('dt_menu_theme_drawer');
            expect(drawer).toContainElement(screen.getByRole('radio', { name: 'Light' }));
            expect(drawer).toContainElement(screen.getByRole('radio', { name: 'Dark' }));
            expect(drawer).toContainElement(screen.getByRole('radio', { name: 'System' }));
            expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        });

        it('marks the option matching the stored preference as selected', () => {
            renderMenuPage(makeThemeStore({ theme_preference: 'dark', is_dark_mode_on: true }));

            expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
            expect(screen.getByRole('radio', { name: 'Light' })).not.toBeChecked();
            expect(screen.getByRole('radio', { name: 'System' })).not.toBeChecked();
        });

        it('keeps System selected while the app renders dark because the OS is dark', () => {
            renderMenuPage(makeThemeStore({ theme_preference: 'system', is_dark_mode_on: true }));

            expect(screen.getByRole('radio', { name: 'System' })).toBeChecked();
            expect(screen.getByRole('radio', { name: 'Dark' })).not.toBeChecked();
        });

        it.each([
            ['Light', 'light'],
            ['Dark', 'dark'],
            ['System', 'system'],
        ])('calls setThemePreference with the matching value when %s is clicked', async (label, value) => {
            const store = makeThemeStore({ theme_preference: 'system', is_dark_mode_on: false });
            renderMenuPage(store);
            const user = userEvent.setup();

            await act(async () => {
                await user.click(screen.getByRole('radio', { name: label }));
            });

            expect(store.ui.setThemePreference).toHaveBeenCalledWith(value);
        });
    });

    describe('Help centre', () => {
        it('should open help centre URL in a new tab when clicked', async () => {
            const window_open = jest.spyOn(window, 'open').mockImplementation(() => null);
            const user = userEvent.setup();
            renderMenuPage();

            await act(async () => {
                await user.click(screen.getByText('Help centre'));
            });

            expect(window_open).toHaveBeenCalledWith('https://help.deriv.com', '_blank', 'noopener,noreferrer');
            window_open.mockRestore();
        });
    });

    describe('Logout', () => {
        it('[MBR-002] should log the client out directly and navigate to / on logout', async () => {
            const logout = jest.fn();
            const store = mockStore({
                client: { is_logged_in: true, logout },
                ui: { is_dark_mode_on: false, setDarkMode: jest.fn() },
            });
            const user = userEvent.setup();
            renderMenuPage(store);

            await act(async () => {
                await user.click(screen.getByText('Log out'));
            });

            expect(logout).toHaveBeenCalled();
            expect(history.location.pathname).toBe('/');
        });
    });
});
