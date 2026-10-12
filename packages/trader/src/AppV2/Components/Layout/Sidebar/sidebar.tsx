import React from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import classNames from 'classnames';

import { useIsRtl } from '@deriv/api';
import { Button, Flyout, Text } from '@deriv/components';
import {
    DerivProductBrandLightDerivTraderLogoIcon,
    LabelPairedLifeRingSmRegularIcon,
    StandaloneBarsRegularIcon,
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

import useIsPhoneLandscape from 'AppV2/Hooks/useIsPhoneLandscape';
import usePortraitOnlyRedirect from 'AppV2/Hooks/usePortraitOnlyRedirect';
import IcManualTradingFill from 'Assets/SvgComponents/settings/ic-manual-trading-fill.svg';

import PositionsDrawerTabs from '../PositionsDrawer/positions-drawer-tabs';

import LanguageSelector from './language-selector';
import MenuDrawer from './menu-drawer';

type TSidebarItem = {
    id: string;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    isActive: boolean;
    badge?: number;
    dataTestId?: string;
    /** Hidden from a public user. Trade and Menu work signed out, as on the bottom nav. */
    requires_auth?: boolean;
};

const Sidebar = observer(() => {
    const { ui, client, portfolio, common } = useStore();
    const { currentLang } = useTranslations();
    const { is_dark_mode_on, active_sidebar_flyout, setSidebarFlyout, closeSidebarFlyout } = ui;
    const is_phone_landscape = useIsPhoneLandscape();
    const is_rtl = useIsRtl();
    const { is_logged_in, logout } = client;
    const { current_language } = common;
    const { active_positions_count, onMount, onUnmount } = portfolio;
    const location = useLocation();
    const history = useHistory();
    const sidebar_ref = React.useRef<HTMLElement>(null);
    const is_on_index = location.pathname === routes.index;
    const { redirect, rotate_prompt } = usePortraitOnlyRedirect();

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
        logout();
    };

    const handlePositionsToggle = () => {
        setSidebarFlyout(active_sidebar_flyout === 'positions' ? null : 'positions');
    };

    const handleMenuToggle = () => {
        setSidebarFlyout(active_sidebar_flyout === 'menu' ? null : 'menu');
    };

    const handleTradeClick = () => {
        closeSidebarFlyout();
        if (!is_on_index) history.push(routes.index);
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
        const brandUrl = getBrandUrl();
        const lang_param = current_language ? `&lang=${current_language}` : '';
        const currency = client.currency || '';
        redirect(`${brandUrl}/home?source=options&acc=options&curr=${currency}${lang_param}`);
    };

    const closeFlyout = () => {
        closeSidebarFlyout();
    };

    // Landscape drops the flyout's header, so its close button goes with it — a press outside, or Escape
    // for keyboard and switch users, is the way out. The rail is excluded: its own handlers toggle the
    // flyout, and closing here first would let the toggle immediately re-open it.
    React.useEffect(() => {
        if (!is_phone_landscape || !active_sidebar_flyout) return undefined;
        const onOutsidePointerDown = (event: PointerEvent) => {
            if ((event.target as Element | null)?.closest?.('.dc-flyout, .sidebar')) return;
            closeSidebarFlyout();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeSidebarFlyout();
        };
        document.addEventListener('pointerdown', onOutsidePointerDown, { capture: true, passive: true });
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onOutsidePointerDown, { capture: true });
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [is_phone_landscape, active_sidebar_flyout, closeSidebarFlyout]);

    // Main navigation items
    const isPositionsActive = active_sidebar_flyout === 'positions';
    const isReportsActive = isActiveRoute(routes.reports);
    const isMenuActive = active_sidebar_flyout === 'menu';

    const home_item: TSidebarItem = {
        id: 'home',
        icon: <StandaloneHouseBlankRegularIcon iconSize='sm' fill='var(--color-text-primary)' />,
        label: localize('Home'),
        onClick: handleHomeClick,
        isActive: false,
        dataTestId: 'dt_sidebar_home',
    };

    const positions_item: TSidebarItem = {
        id: 'positions',
        // Landscape has no current page but Trade, so nothing else takes the filled icon.
        icon:
            isPositionsActive && !is_phone_landscape ? (
                <StandaloneClockThreeFillIcon fill='var(--color-nav-item-active)' iconSize='sm' />
            ) : (
                <StandaloneClockThreeRegularIcon fill='var(--color-text-primary)' iconSize='sm' />
            ),
        label: localize('Positions'),
        onClick: handlePositionsToggle,
        isActive: isPositionsActive,
        badge: active_positions_count,
        dataTestId: 'dt_sidebar_positions',
        requires_auth: true,
    };

    /**
     * The mobile bottom nav's items, minus Automate (no landscape surface to open). Only the items are
     * copied, not the model: there Positions and Menu are routes, here drawers, since navigating away
     * tears down the chart and its proposal subscription.
     */
    const landscape_items: TSidebarItem[] = [
        home_item,
        {
            id: 'trade',
            // Native 14: unlike the quill glyphs beside it, this asset fills its viewBox, so 24 read a
            // third larger. Colour comes from the class — it paints with `currentColor`, not a prop.
            icon: <IcManualTradingFill className='sidebar__trade-icon' width={14} height={14} />,
            label: localize('Trade'),
            onClick: handleTradeClick,
            // The rail's only page; a drawer opens over it rather than leaving it.
            isActive: true,
            dataTestId: 'dt_sidebar_trade',
        },
        positions_item,
        {
            id: 'menu',
            icon: <StandaloneBarsRegularIcon iconSize='sm' fill='var(--color-text-primary)' />,
            label: localize('Menu'),
            onClick: handleMenuToggle,
            isActive: isMenuActive,
            dataTestId: 'dt_sidebar_menu',
        },
    ];

    const desktop_items: TSidebarItem[] = [
        home_item,
        positions_item,
        {
            id: 'reports',
            icon: <StandaloneFileRegularIcon fill='var(--color-text-primary)' iconSize='sm' />,
            label: localize('Reports'),
            onClick: handleReportsClick,
            isActive: isReportsActive,
            dataTestId: 'dt_sidebar_reports',
            requires_auth: true,
        },
    ];

    const navigationItems = is_phone_landscape ? landscape_items : desktop_items;

    // Utility items (bottom section)
    const isLanguageActive = active_sidebar_flyout === 'language';

    // Landscape moves these behind the Menu drawer; the Figma hides this list there too.
    const utilityItems = is_phone_landscape
        ? []
        : [
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
                  label: localize('Log out'),
                  onClick: handleLogout,
                  isActive: false,
                  dataTestId: 'dt_sidebar_logout',
                  requires_auth: true,
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
            case 'menu':
                return {
                    title: <Localize i18n_default_text='Menu' />,
                    content: (
                        <MenuDrawer
                            onReports={handleReportsClick}
                            onHelpCentre={handleHelpCentreClick}
                            onLogout={handleLogout}
                        />
                    ),
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
                            if (item.requires_auth && !is_logged_in) return null;

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
                    {/* Omitted when empty, or its separator renders as a stray rule under the last item. */}
                    {utilityItems.length > 0 && (
                        <div className='sidebar__nav-utility' data-testid='dt_sidebar_utility'>
                            <div className='sidebar__separator' />
                            {utilityItems.map(item => {
                                if (item.requires_auth && !is_logged_in) return null;

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
                    )}
                </nav>
            </aside>

            {/* Dims the page behind an open side sheet. The outside-press effect above already counts a
                tap here as "outside", so it dismisses without a handler of its own. Kept mounted so it
                fades with the sheet's slide instead of snapping. */}
            {is_on_index && is_phone_landscape && (
                <div
                    className={classNames('landscape-flyout-backdrop', {
                        'landscape-flyout-backdrop--visible': flyoutContent !== null,
                    })}
                    data-testid='dt_landscape_flyout_backdrop'
                />
            )}

            {/* Single Flyout with conditional content - unmount when navigating away to avoid flash.
                is_open keys on the resolved content, not the raw flyout value: `active_sidebar_flyout`
                is persisted, so a value with no case in getFlyoutContent (e.g. 'theme' from a build
                that had a theme flyout) must not rehydrate into an open-but-empty panel. */}
            {is_on_index && (
                // Arabic landscape keeps the page left-to-right (see AppContent); its side sheets read
                // right-to-left, as in portrait.
                <div dir={is_phone_landscape && is_rtl ? 'rtl' : undefined}>
                    <Flyout
                        className={active_sidebar_flyout ? `dc-flyout--${active_sidebar_flyout}` : undefined}
                        is_open={flyoutContent !== null}
                        onClose={closeFlyout}
                        title={flyoutContent?.title}
                        footer_content={flyoutContent?.footer}
                    >
                        {flyoutContent?.content}
                    </Flyout>
                </div>
            )}

            {rotate_prompt}
        </React.Fragment>
    );
});

export default Sidebar;
