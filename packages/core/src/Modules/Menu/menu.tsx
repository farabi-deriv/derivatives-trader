import React from 'react';
import { Redirect, useHistory } from 'react-router-dom';
import classNames from 'classnames';

import { Text } from '@deriv/components';
import {
    IllustrativeEtfIcon,
    StandaloneChevronLeftRegularIcon,
    StandaloneChevronRightRegularIcon,
    StandaloneClockThreeRegularIcon,
    StandaloneGlobeRegularIcon,
    StandaloneLifeRingRegularIcon,
    StandaloneMobileNotchRegularIcon,
    StandaloneMoonRegularIcon,
    StandaloneRightFromBracketRegularIcon,
    StandaloneSunBrightRegularIcon,
    StandaloneTableLayoutRegularIcon,
} from '@deriv/quill-icons';
import { getHelpCentreUrl, routes } from '@deriv/shared';
import { observer, useStore } from '@deriv/stores';
import { useTranslations } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';

import { MobileLanguageMenu } from 'App/Components/Layout/Header/Components/ToggleMenu';
import MenuLink from 'App/Components/Layout/Header/menu-link';

const MenuPage = observer(() => {
    const history = useHistory();
    const { isMobile } = useDevice();
    const { ui, client } = useStore();
    const { theme_preference, setThemePreference, is_dark_mode_on } = ui;
    const { is_logged_in, logout: logoutClient } = client;
    const { localize } = useTranslations();

    // Memoized: MenuPage re-renders on every observed ui change (including live system-theme
    // flips), and rebuilding the icon elements each time forces React to reconcile their subtrees.
    const theme_options = React.useMemo(
        () =>
            [
                {
                    value: 'light',
                    label: localize('Light'),
                    icon: <StandaloneSunBrightRegularIcon iconSize='sm' fill='var(--color-text-primary)' />,
                },
                {
                    value: 'dark',
                    label: localize('Dark'),
                    icon: <StandaloneMoonRegularIcon iconSize='sm' fill='var(--color-text-primary)' />,
                },
                {
                    value: 'system',
                    label: localize('System'),
                    icon: <StandaloneMobileNotchRegularIcon iconSize='sm' fill='var(--color-text-primary)' />,
                },
            ] as const,
        [localize]
    );

    const [show_language_selector, setShowLanguageSelector] = React.useState(false);
    const [show_theme_selector, setShowThemeSelector] = React.useState(false);

    const handleLogout = React.useCallback(async () => {
        try {
            await logoutClient();
            history.push(routes.index);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Logout failed:', error);
        }
    }, [logoutClient, history]);

    const handleHelpCentreClick = React.useCallback(() => {
        window.open(getHelpCentreUrl(), '_blank', 'noopener,noreferrer');
    }, []);

    if (!isMobile) return <Redirect to={routes.index} />;

    return (
        <div className='menu-page'>
            {/* Main menu view */}
            <div
                className={classNames('menu-page__main', {
                    'menu-page__main--hidden': show_language_selector || show_theme_selector,
                })}
            >
                <div className='header__menu-mobile-body-wrapper'>
                    {/* Reports Section — only for logged-in users */}
                    {is_logged_in && (
                        <div className='header__menu-section'>
                            <div className='header__menu-section-header'>
                                <Text className='header__menu-section-title' size='xsm' weight='bold'>
                                    {localize('Reports')}
                                </Text>
                            </div>
                            <div className='menu-page__item' onClick={() => history.push(routes.positions)}>
                                <MenuLink
                                    icon={<StandaloneClockThreeRegularIcon iconSize='sm' />}
                                    text={localize('Open positions')}
                                    suffix_icon={<StandaloneChevronRightRegularIcon iconSize='sm' />}
                                />
                            </div>
                            <div className='menu-page__item' onClick={() => history.push(routes.profit)}>
                                <MenuLink
                                    icon={<StandaloneTableLayoutRegularIcon iconSize='sm' />}
                                    text={localize('Trade table')}
                                    suffix_icon={<StandaloneChevronRightRegularIcon iconSize='sm' />}
                                />
                            </div>
                            <div className='menu-page__item' onClick={() => history.push(routes.statement)}>
                                <MenuLink
                                    icon={<IllustrativeEtfIcon iconSize='sm' />}
                                    text={localize('Statement')}
                                    suffix_icon={<StandaloneChevronRightRegularIcon iconSize='sm' />}
                                />
                            </div>
                        </div>
                    )}

                    {/* Settings Section */}
                    <div className='header__menu-section'>
                        <div className='header__menu-section-header'>
                            <Text className='header__menu-section-title' size='xsm' weight='bold'>
                                {localize('Settings')}
                            </Text>
                        </div>
                        <div className='menu-page__item' onClick={() => setShowLanguageSelector(true)}>
                            <MenuLink
                                icon={<StandaloneGlobeRegularIcon iconSize='sm' />}
                                text={localize('Language')}
                                suffix_icon={<StandaloneChevronRightRegularIcon iconSize='sm' />}
                            />
                        </div>
                        <div className='menu-page__item' onClick={() => setShowThemeSelector(true)}>
                            <MenuLink
                                icon={
                                    is_dark_mode_on ? (
                                        <StandaloneMoonRegularIcon iconSize='sm' />
                                    ) : (
                                        <StandaloneSunBrightRegularIcon iconSize='sm' />
                                    )
                                }
                                text={localize('Theme')}
                                suffix_icon={<StandaloneChevronRightRegularIcon iconSize='sm' />}
                            />
                        </div>
                    </div>

                    {/* Support Section */}
                    <div className='header__menu-section'>
                        <div className='header__menu-section-header'>
                            <Text className='header__menu-section-title' size='xsm' weight='bold'>
                                {localize('Support')}
                            </Text>
                        </div>
                        <div className='menu-page__item' onClick={handleHelpCentreClick}>
                            <MenuLink
                                icon={<StandaloneLifeRingRegularIcon iconSize='sm' />}
                                text={localize('Help centre')}
                                suffix_icon={<StandaloneChevronRightRegularIcon iconSize='sm' />}
                            />
                        </div>
                    </div>

                    {/* Log out */}
                    {is_logged_in && (
                        <div className='menu-page__item header__menu-logout' onClick={handleLogout}>
                            <MenuLink
                                icon={
                                    <StandaloneRightFromBracketRegularIcon
                                        iconSize='sm'
                                        fill='var(--color-text-danger)'
                                    />
                                }
                                text={localize('Log out')}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Language selector — slides in from the right as a full-screen drawer */}
            <div
                className={classNames('menu-page__language-drawer', {
                    'menu-page__language-drawer--open': show_language_selector,
                })}
                data-testid='dt_menu_language_drawer'
            >
                <div className='menu-page__header'>
                    <div
                        className='menu-page__header-close'
                        data-testid='dt_menu_language_close'
                        onClick={() => setShowLanguageSelector(false)}
                    >
                        <StandaloneChevronLeftRegularIcon iconSize='sm' fill='var(--color-text-primary)' />
                    </div>
                    <Text weight='bold' size='s'>
                        {localize('Language')}
                    </Text>
                </div>
                <MobileLanguageMenu toggleDrawer={() => setShowLanguageSelector(false)} />
            </div>

            {/* Theme selector — slides in from the right as a full-screen drawer */}
            <div
                className={classNames('menu-page__theme-drawer', {
                    'menu-page__theme-drawer--open': show_theme_selector,
                })}
                data-testid='dt_menu_theme_drawer'
            >
                <div className='menu-page__header'>
                    <div
                        className='menu-page__header-close'
                        data-testid='dt_menu_theme_close'
                        onClick={() => setShowThemeSelector(false)}
                    >
                        <StandaloneChevronLeftRegularIcon iconSize='sm' fill='var(--color-text-primary)' />
                    </div>
                    <Text weight='bold' size='s'>
                        {localize('Theme')}
                    </Text>
                </div>
                <div
                    className='menu-page__theme-options'
                    role='radiogroup'
                    aria-label={localize('Theme')}
                    data-testid='dt_menu_theme_selection'
                >
                    {/* Selection reflects the stored preference, not the resolved theme: a user
                        on System keeps System selected even while the app renders dark. */}
                    {theme_options.map(({ value, label, icon }) => (
                        <button
                            key={value}
                            type='button'
                            className={classNames('menu-page__theme-option', {
                                'menu-page__theme-option--active': theme_preference === value,
                            })}
                            role='radio'
                            aria-checked={theme_preference === value}
                            onClick={() => setThemePreference(value)}
                        >
                            {icon}
                            <Text size='s'>{label}</Text>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
});

MenuPage.displayName = 'MenuPage';

export default MenuPage;
