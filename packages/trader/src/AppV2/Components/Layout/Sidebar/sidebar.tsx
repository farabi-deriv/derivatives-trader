import React from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import classNames from 'classnames';

import { useMobileBridge } from '@deriv/api';
import { Button, Flyout, Text } from '@deriv/components';
import {
    DerivProductBrandLightDerivTraderLogoIcon,
    LabelPairedLifeRingSmRegularIcon,
    StandaloneClockThreeFillIcon,
    StandaloneClockThreeRegularIcon,
    StandaloneFileRegularIcon,
    StandaloneGlobeFillIcon,
    StandaloneGlobeRegularIcon,
    StandaloneHouseBlankRegularIcon,
    StandaloneMoonRegularIcon,
    StandaloneRightFromBracketRegularIcon,
    StandaloneSunBrightRegularIcon,
} from '@deriv/quill-icons';
import { getBrandUrl, getHelpCentreUrl, routes } from '@deriv/shared';
import { observer, useStore } from '@deriv/stores';
import { Localize, localize, useTranslations } from '@deriv-com/translations';

import PositionsDrawerTabs from '../PositionsDrawer/positions-drawer-tabs';

import LanguageSelector from './language-selector';

type TSidebarItem = {
    id: string;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    isActive: boolean;
    badge?: number;
    dataTestId?: string;
};

const Sidebar = observer(() => {
    const { ui, client, portfolio, common } = useStore();
    const { currentLang } = useTranslations();
    const { is_dark_mode_on, active_sidebar_flyout, setSidebarFlyout, closeSidebarFlyout } = ui;
    const { is_logged_in, logout } = client;
    const { current_language } = common;
    const { active_positions_count, onMount, onUnmount } = portfolio;
    const location = useLocation();
    const history = useHistory();
    const sidebar_ref = React.useRef<HTMLElement>(null);
    const { sendBridgeEvent, isBridgeAvailable } = useMobileBridge();
    const is_on_index = location.pathname === routes.index;

    React.useEffect(() => {
        onMount();
        return () => onUnmount();
    }, [onMount, onUnmount]);

    React.useEffect(() => {
        if (active_sidebar_flyout && !is_on_index) {
            closeSidebarFlyout();
        }
    }, [is_on_index, active_sidebar_flyout, closeSidebarFlyout]);

    const isActiveRoute = (path: string) => {
        if (path === routes.index) {
            return location.pathname === routes.index;
        }
        return location.pathname.startsWith(path);
    };

    const handleThemeToggle = () => {
        ui.setDarkMode(!is_dark_mode_on);
    };

    const handleLanguageToggle = () => {
        setSidebarFlyout(active_sidebar_flyout === 'language' ? null : 'language');
    };

    const handleLogout = () => {
        closeSidebarFlyout();
        sendBridgeEvent('trading:back', () => {
            logout();
        });
    };

    const handlePositionsToggle = () => {
        setSidebarFlyout(active_sidebar_flyout === 'positions' ? null : 'positions');
    };

    const handleReportsClick = () => {
        setSidebarFlyout(null);
        history.push(routes.reports);
    };

    const handleHelpCentreClick = () => {
        closeSidebarFlyout();
        window.open(getHelpCentreUrl(), '_blank', 'noopener,noreferrer');
    };

    const handleHomeClick = () => {
        closeSidebarFlyout();
        sendBridgeEvent('trading:home', () => {
            const brandUrl = getBrandUrl();
            const lang_param = current_language ? `&lang=${current_language}` : '';
            const currency = client.currency || '';
            window.location.href = `${brandUrl}/home?source=options&acc=options&curr=${currency}${lang_param}`;
        });
    };

    const closeFlyout = () => {
        closeSidebarFlyout();
    };

    // Main navigation items
    const isPositionsActive = active_sidebar_flyout === 'positions';
    const isReportsActive = isActiveRoute(routes.reports);

    const navigationItems: TSidebarItem[] = [
        {
            id: 'home',
            icon: <StandaloneHouseBlankRegularIcon iconSize='sm' fill='var(--color-text-primary)' />,
            label: localize('Home'),
            onClick: handleHomeClick,
            isActive: false,
            dataTestId: 'dt_sidebar_home',
        },
        {
            id: 'positions',
            icon: isPositionsActive ? (
                <StandaloneClockThreeFillIcon fill='var(--color-nav-item-active)' iconSize='sm' />
            ) : (
                <StandaloneClockThreeRegularIcon fill='var(--color-text-primary)' iconSize='sm' />
            ),
            label: localize('Positions'),
            onClick: handlePositionsToggle,
            isActive: isPositionsActive,
            badge: active_positions_count,
            dataTestId: 'dt_sidebar_positions',
        },
        {
            id: 'reports',
            icon: <StandaloneFileRegularIcon fill='var(--color-text-primary)' iconSize='sm' />,
            label: localize('Reports'),
            onClick: handleReportsClick,
            isActive: isReportsActive,
            dataTestId: 'dt_sidebar_reports',
        },
    ];

    // Utility items (bottom section)
    const isLanguageActive = active_sidebar_flyout === 'language';

    const utilityItems = [
        {
            id: 'help',
            icon: <LabelPairedLifeRingSmRegularIcon fill='var(--color-text-primary)' />,
            label: localize('Help'),
            onClick: handleHelpCentreClick,
            isActive: false,
            dataTestId: 'dt_sidebar_help',
        },
        {
            id: 'language',
            icon: isLanguageActive ? (
                <StandaloneGlobeFillIcon fill='var(--color-nav-item-active)' iconSize='sm' />
            ) : (
                <StandaloneGlobeRegularIcon fill='var(--color-text-primary)' iconSize='sm' />
            ),
            label: localize('Language'),
            onClick: handleLanguageToggle,
            isActive: isLanguageActive,
            dataTestId: 'dt_sidebar_language',
        },
        {
            id: 'theme',
            icon: is_dark_mode_on ? (
                <StandaloneSunBrightRegularIcon fill='var(--color-text-primary)' iconSize='sm' />
            ) : (
                <StandaloneMoonRegularIcon fill='var(--color-text-primary)' iconSize='sm' />
            ),
            label: localize('Theme'),
            onClick: handleThemeToggle,
            isActive: false,
            dataTestId: 'dt_sidebar_theme',
        },
        {
            id: 'logout',
            icon: <StandaloneRightFromBracketRegularIcon iconSize='sm' fill='var(--color-text-primary)' />,
            label: isBridgeAvailable ? localize('Back to app') : localize('Log out'),
            onClick: handleLogout,
            isActive: false,
            dataTestId: 'dt_sidebar_logout',
        },
    ];

    const getFlyoutContent = () => {
        switch (active_sidebar_flyout) {
            case 'language':
                return {
                    title: <Localize i18n_default_text='Language' />,
                    content: <LanguageSelector onLanguageChange={closeFlyout} />,
                    footer: null,
                };
            case 'positions':
                return {
                    title: <Localize i18n_default_text='Positions' />,
                    content: <PositionsDrawerTabs />,
                    footer: null,
                };
            default:
                return null;
        }
    };

    const flyoutContent = React.useMemo(() => getFlyoutContent(), [active_sidebar_flyout, currentLang]);

    return (
        <React.Fragment>
            <aside
                ref={sidebar_ref}
                className={classNames('sidebar', {
                    sidebar__hidden: !isActiveRoute(routes.index),
                })}
                data-testid='dt_sidebar'
            >
                {/* Logo Section */}
                <div className='sidebar__header'>
                    <DerivProductBrandLightDerivTraderLogoIcon width={32} height={32} />
                </div>
                <div className='sidebar__separator' />
                {/* Main Navigation */}
                <nav className='sidebar__nav'>
                    <div className='sidebar__nav-main'>
                        {navigationItems.map((item, index) => {
                            const shouldShow = item.id === 'home' || is_logged_in;

                            if (!shouldShow) return null;

                            return (
                                <Button
                                    key={item.id}
                                    className={classNames('sidebar__item', {
                                        'sidebar__item--active': item.isActive,
                                    })}
                                    onClick={item.onClick}
                                    data-testid={item.dataTestId}
                                    aria-label={item.label}
                                    type='button'
                                >
                                    <Text className='sidebar__item-icon'>{item.icon}</Text>
                                    <Text className='sidebar__item-label'>{item.label}</Text>
                                    {item.badge !== undefined && item.badge > 0 && (
                                        <Text className='sidebar__item-badge'>{item.badge}</Text>
                                    )}
                                </Button>
                            );
                        })}
                    </div>
                    {/* Utility Section */}
                    <div className='sidebar__nav-utility'>
                        <div className='sidebar__separator' />
                        {utilityItems.map(item => {
                            const shouldShow = item.id === 'logout' ? is_logged_in : true;

                            if (!shouldShow) return null;

                            return (
                                <Button
                                    key={item.id}
                                    className={classNames('sidebar__item', {
                                        'sidebar__item--active': item.isActive,
                                    })}
                                    onClick={item.onClick}
                                    data-testid={item.dataTestId}
                                    aria-label={item.label}
                                    type='button'
                                >
                                    <Text className='sidebar__item-icon'>{item.icon}</Text>
                                    <Text className='sidebar__item-label'>{item.label}</Text>
                                </Button>
                            );
                        })}
                    </div>
                </nav>
            </aside>

            {/* Single Flyout with conditional content - unmount when navigating away to avoid flash.
                is_open keys on the resolved content, not the raw flyout value: `active_sidebar_flyout`
                is persisted, so a value with no case in getFlyoutContent (e.g. 'theme' from a build
                that had a theme flyout) must not rehydrate into an open-but-empty panel. */}
            {is_on_index && (
                <Flyout
                    is_open={flyoutContent !== null}
                    onClose={closeFlyout}
                    title={flyoutContent?.title}
                    footer_content={flyoutContent?.footer}
                >
                    {flyoutContent?.content}
                </Flyout>
            )}
        </React.Fragment>
    );
});

export default Sidebar;
