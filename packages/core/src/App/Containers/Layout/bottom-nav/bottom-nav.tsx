import React from 'react';
import { matchPath, useHistory, useLocation } from 'react-router';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';

import { useDerivativesAccount } from '@deriv/api';
import {
    StandaloneBarsRegularIcon,
    StandaloneClockThreeFillIcon,
    StandaloneClockThreeRegularIcon,
    StandaloneHouseBlankFillIcon,
    StandaloneHouseBlankRegularIcon,
} from '@deriv/quill-icons';
import { getAccountId, getBrandUrl, routes, trackAutomateTabTapped } from '@deriv/shared';
import { useStore } from '@deriv/stores';
import { Badge, Navigation } from '@deriv-com/quill-ui';
import { Localize } from '@deriv-com/translations';

import IcAutomationTrading from 'Assets/SvgComponents/settings/ic-automation-trading.svg';
import IcAutomationTradingFill from 'Assets/SvgComponents/settings/ic-automation-trading-fill.svg';
import IcManualTrading from 'Assets/SvgComponents/settings/ic-manual-trading.svg';
import IcManualTradingFill from 'Assets/SvgComponents/settings/ic-manual-trading-fill.svg';

type BottomNavProps = {
    className?: string;
};

const BottomNav = observer(({ className }: BottomNavProps) => {
    const history = useHistory();
    const location = useLocation();
    const { client, portfolio, common, ui } = useStore();
    const { active_positions_count } = portfolio;
    const { currency, is_logged_in, loginid } = client;
    const { current_language } = common;
    const { is_chart_maximized } = ui;
    const { data: derivatives_account, isError: is_derivatives_account_error } = useDerivativesAccount(
        loginid,
        is_logged_in
    );
    // Show Automate to public users and logged-in non-EU (DIEL) accounts.
    // `is_public_user` excludes a mid-restore session so an EU account doesn't
    // flash the tab in. Mirrors the trader hook (core can't import it).
    const automation_group = derivatives_account?.data?.find(account => account.account_id === loginid)?.group;
    const is_public_user = !is_logged_in && !getAccountId();
    const is_account_resolved = !!derivatives_account || is_derivatives_account_error;
    const is_automation_enabled = is_public_user || (is_account_resolved && automation_group !== 'DIEL Default Group');

    const bottomNavItems = React.useMemo(
        () => [
            {
                icon: <StandaloneHouseBlankRegularIcon iconSize='sm' fill='var(--color-text-primary)' />,
                activeIcon: <StandaloneHouseBlankFillIcon iconSize='sm' />,
                label: <Localize i18n_default_text='Home' />,
                path: null,
                action: 'home' as const,
            },
            {
                icon: (
                    <div className='bottom-nav-item__icon-wrapper'>
                        <IcManualTrading width={14} height={14} />
                    </div>
                ),
                activeIcon: (
                    <div className='bottom-nav-item__icon-wrapper'>
                        <IcManualTradingFill width={14} height={14} />
                    </div>
                ),
                label: <Localize i18n_default_text='Trade' />,
                path: routes.index,
            },
            ...(is_automation_enabled
                ? [
                      {
                          icon: (
                              <div className='bottom-nav-item__icon-wrapper'>
                                  <IcAutomationTrading width={20} height={16} />
                              </div>
                          ),
                          activeIcon: (
                              <div className='bottom-nav-item__icon-wrapper'>
                                  <IcAutomationTradingFill width={20} height={16} />
                              </div>
                          ),
                          label: <Localize i18n_default_text='Automate' />,
                          path: routes.trader_automate,
                      },
                  ]
                : []),
            ...(is_logged_in
                ? [
                      {
                          icon:
                              active_positions_count > 0 ? (
                                  <Badge
                                      variant='notification'
                                      position='top-right'
                                      label={active_positions_count.toString()}
                                      color='danger'
                                      size='sm'
                                      contentSize='sm'
                                      className='bottom-nav-item__position-badge'
                                  >
                                      <StandaloneClockThreeRegularIcon iconSize='sm' fill='var(--color-text-primary)' />
                                  </Badge>
                              ) : (
                                  <StandaloneClockThreeRegularIcon iconSize='sm' fill='var(--color-text-primary)' />
                              ),
                          activeIcon:
                              active_positions_count > 0 ? (
                                  <Badge
                                      variant='notification'
                                      position='top-right'
                                      label={active_positions_count.toString()}
                                      color='danger'
                                      size='sm'
                                      contentSize='sm'
                                      className='bottom-nav-item__position-badge'
                                  >
                                      <StandaloneClockThreeFillIcon iconSize='sm' fill='var(--color-text-primary)' />
                                  </Badge>
                              ) : (
                                  <StandaloneClockThreeFillIcon iconSize='sm' />
                              ),
                          label: (
                              <React.Fragment>
                                  <span className='user-guide__anchor' />
                                  <Localize i18n_default_text='Positions' />
                              </React.Fragment>
                          ),
                          path: routes.trader_positions,
                      },
                  ]
                : []),
            {
                icon: <StandaloneBarsRegularIcon iconSize='sm' fill='var(--color-text-primary)' />,
                activeIcon: <StandaloneBarsRegularIcon iconSize='sm' />,
                label: <Localize i18n_default_text='Menu' />,
                path: routes.menu,
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [active_positions_count, is_logged_in, is_automation_enabled]
    );

    const selectedIndex = React.useMemo(() => {
        if (
            location.pathname === routes.positions ||
            location.pathname === routes.profit ||
            location.pathname === routes.statement
        ) {
            return -1; // No icon highlighted for report sub-routes
        }
        if (matchPath(location.pathname, { path: routes.contract, exact: true })) {
            return -1; // No icon highlighted for contract details page
        }
        const idx = bottomNavItems.findIndex(item => item.path === location.pathname);
        return idx > -1 ? idx : 1; // Default to Trade
    }, [bottomNavItems, location.pathname]);

    const handleSelect = (index: number) => {
        const item = bottomNavItems[index];

        if (item.action === 'home') {
            const brandUrl = getBrandUrl();
            const lang_param = current_language ? `&lang=${encodeURIComponent(current_language)}` : '';
            const curr = encodeURIComponent(currency || '');
            window.location.href = `${brandUrl}/home?source=options&acc=options&curr=${curr}${lang_param}`;
            return;
        }

        if (item.path === routes.trader_automate) {
            // Map the route the user is leaving to a human-readable tab name.
            const previous_tab =
                {
                    [routes.index]: 'trade',
                    [routes.trader_positions]: 'positions',
                    [routes.menu]: 'menu',
                }[location.pathname] ?? 'home';
            trackAutomateTabTapped({ previous_tab });
        }

        if (item.path) {
            history.push(item.path);
        }
    };

    return (
        <Navigation.Bottom
            className={classNames('bottom-nav-container', className, {
                'bottom-nav-container--chart-maximized': is_chart_maximized,
            })}
            onChange={(_, index) => handleSelect(index)}
        >
            {bottomNavItems.map((item, index) => (
                <Navigation.BottomAction
                    key={index}
                    index={index}
                    activeIcon={<></>}
                    icon={index === selectedIndex ? item.activeIcon : item.icon}
                    label={item.label}
                    selected={index === selectedIndex}
                    showLabel
                    className={classNames(
                        'bottom-nav-item',
                        index === selectedIndex && 'bottom-nav-item--active',
                        item.path === routes.index && 'bottom-nav-item--trade',
                        item.path === routes.trader_automate && 'bottom-nav-item--automate',
                        item.path === routes.trader_positions && 'bottom-nav-item--positions'
                    )}
                />
            ))}
        </Navigation.Bottom>
    );
});

export default BottomNav;
