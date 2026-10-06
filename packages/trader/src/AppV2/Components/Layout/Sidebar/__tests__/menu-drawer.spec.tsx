import { mockStore, StoreProvider } from '@deriv/stores';
import { fireEvent, render, screen } from '@testing-library/react';

import MenuDrawer from '../menu-drawer';

jest.mock('@deriv-com/translations', () => ({
    ...jest.requireActual('@deriv-com/translations'),
    getAllowedLanguages: jest.fn(() => ({ EN: 'English', ES: 'Español' })),
    useTranslations: jest.fn(() => ({
        currentLang: 'EN',
        switchLanguage: jest.fn(),
        localize: (text: string) => text,
    })),
}));

const buildStore = ({
    is_logged_in = true,
    theme_preference = 'system',
}: { is_logged_in?: boolean; theme_preference?: 'light' | 'dark' | 'system' } = {}) =>
    mockStore({
        ui: { theme_preference, setThemePreference: jest.fn() },
        client: { is_logged_in },
    });

const renderDrawer = (store = buildStore(), handlers = {}) => {
    const props = {
        onReports: jest.fn(),
        onHelpCentre: jest.fn(),
        onLogout: jest.fn(),
        ...handlers,
    };
    render(
        <StoreProvider store={store}>
            <MenuDrawer {...props} />
        </StoreProvider>
    );
    return { store, props };
};

describe('MenuDrawer', () => {
    afterEach(() => jest.clearAllMocks());

    it.each([
        ['reports', 'onReports'],
        ['help', 'onHelpCentre'],
        ['logout', 'onLogout'],
    ] as const)('[LNV-006] the %s row calls its handler', (row, handler) => {
        const { props } = renderDrawer();

        fireEvent.click(screen.getByTestId(`dt_menu_${row}`));

        expect(props[handler]).toHaveBeenCalled();
    });

    it('[LNV-007] hides Log out for a logged-out user', () => {
        renderDrawer(buildStore({ is_logged_in: false }));

        expect(screen.queryByTestId('dt_menu_logout')).not.toBeInTheDocument();
    });

    it('[LNV-008] Theme opens a nested choice rather than flipping the theme', () => {
        // A dark/light toggle can reach neither 'system' nor back out of an explicit choice.
        const { store } = renderDrawer();

        fireEvent.click(screen.getByTestId('dt_menu_theme'));

        expect(store.ui.setThemePreference).not.toHaveBeenCalled();
        ['light', 'dark', 'system'].forEach(option =>
            expect(screen.getByTestId(`dt_menu_theme_${option}`)).toBeInTheDocument()
        );
    });

    it('[LNV-008] picking a theme records the preference and leaves the drawer open', () => {
        // The drawer must survive the choice — it used to be a flyout swap, which closed the menu.
        const { store } = renderDrawer(buildStore({ theme_preference: 'light' }));

        fireEvent.click(screen.getByTestId('dt_menu_theme'));
        fireEvent.click(screen.getByTestId('dt_menu_theme_system'));

        expect(store.ui.setThemePreference).toHaveBeenCalledWith('system');
        expect(screen.getByTestId('dt_menu_theme_system')).toBeInTheDocument();
    });

    it('[LNV-010] marks the theme currently in force', () => {
        renderDrawer(buildStore({ theme_preference: 'dark' }));

        fireEvent.click(screen.getByTestId('dt_menu_theme'));

        expect(screen.getByTestId('dt_menu_theme_dark')).toHaveClass('flyout-selector__option--active');
        expect(screen.getByTestId('dt_menu_theme_light')).not.toHaveClass('flyout-selector__option--active');
    });

    it('[LNV-010] opens Language in the same panel, with the active language marked', () => {
        renderDrawer();

        fireEvent.click(screen.getByTestId('dt_menu_language'));

        // The selector itself is unchanged; it just renders here now instead of in its own flyout.
        expect(screen.getByRole('button', { name: 'English' })).toHaveClass('flyout-selector__option--active');
        expect(screen.getByRole('button', { name: 'Español' })).not.toHaveClass('flyout-selector__option--active');
        expect(screen.queryByTestId('dt_menu_reports')).not.toBeInTheDocument();
    });

    it('[LNV-010] picking a language leaves the drawer open on the language view', async () => {
        // It used to swap flyouts, which closed the menu outright.
        renderDrawer();

        fireEvent.click(screen.getByTestId('dt_menu_language'));
        fireEvent.click(screen.getByText('Español'));

        await screen.findByText('English');
        expect(screen.queryByTestId('dt_menu_reports')).not.toBeInTheDocument();
    });

    it.each(['theme', 'language'] as const)('[LNV-011] back returns from %s to the menu list', view => {
        renderDrawer();

        fireEvent.click(screen.getByTestId(`dt_menu_${view}`));
        fireEvent.click(screen.getByTestId('dt_menu_back'));

        expect(screen.getByTestId('dt_menu_reports')).toBeInTheDocument();
    });
});
