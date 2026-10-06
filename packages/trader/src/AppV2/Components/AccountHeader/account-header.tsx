import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';

import { useDerivativesAccount } from '@deriv/api';
import { Button, Skeleton, Text } from '@deriv/components';
import AccountSwitcher from '@deriv/core/src/App/Components/Layout/Header/account-switcher';
import { LegacyChevronDown1pxIcon } from '@deriv/quill-icons';
import {
    addComma,
    getBrandUrl,
    getCurrencyDisplayCode,
    isDemoAccountId,
    redirectToLogin,
    trackAnalyticsEvent,
} from '@deriv/shared';
import { useStore } from '@deriv/stores';
import { Localize, useTranslations } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';

import { InputPopover } from 'AppV2/Components/InputPopover';
import useIsPhoneLandscape from 'AppV2/Hooks/useIsPhoneLandscape';

import '@deriv/core/src/sass/app/_common/components/account-switcher.scss';

// Matches .acc-switcher__wrapper's 19.6rem, so the portalled panel keeps the dropdown's own width.
const LANDSCAPE_SWITCHER_WIDTH = 196;

type AccountHeaderProps = {
    balance?: string | number;
    currency?: string;
    is_logged_in?: boolean;
    is_virtual?: boolean;
    /** Fired as the account dropdown opens/closes, so a caller can pause its chrome auto-hide. */
    onDropdownOpenChange?: (is_open: boolean) => void;
};

const AccountHeader = observer(
    ({
        balance: balanceProp,
        currency: currencyProp,
        is_logged_in: isLoggedInProp,
        is_virtual: isVirtualProp,
        onDropdownOpenChange,
    }: AccountHeaderProps = {}) => {
        const { localize } = useTranslations();
        const { client, common, ui } = useStore();
        const { is_switching_account, setIsSwitchingAccount } = ui;

        const { isMobile } = useDevice();
        const is_phone_landscape = useIsPhoneLandscape();
        const trigger_ref = React.useRef<HTMLDivElement>(null);

        // Use props if provided, otherwise fall back to store
        const balance = balanceProp ?? client.balance;
        const currency = currencyProp ?? client.currency;
        const is_logged_in = isLoggedInProp ?? client.is_logged_in;
        const { is_logging_in } = client;
        const is_virtual = isVirtualProp ?? client.is_virtual;

        const { data, isLoading, error, refetch } = useDerivativesAccount(client.loginid, is_logged_in);
        const accounts = data?.data || [];

        // Dropdown state
        const [is_dropdown_open, setIsDropdownOpen] = React.useState(false);
        const dropdown_ref = React.useRef<HTMLDivElement>(null);

        // `switchAccount` only rewrites localStorage and reconnects; `client.loginid` moves later.
        const switched_from = React.useRef<string | undefined>();

        const handleAccountSwitchStart = React.useCallback(() => {
            switched_from.current = client.loginid;
            setIsSwitchingAccount(true);
        }, [client, setIsSwitchingAccount]);

        // Release only once the switch landed: `loginid` moved off the old account.
        React.useEffect(() => {
            const has_arrived = !switched_from.current || client.loginid !== switched_from.current;

            if (has_arrived && !isLoading && (data || error)) {
                switched_from.current = undefined;
                setIsSwitchingAccount(false);
            }
        }, [client.loginid, isLoading, data, error, setIsSwitchingAccount]);

        // Close dropdown when clicking outside. Skipped in landscape: the panel is portalled out of
        // `dropdown_ref` there, so every click *inside* it would read as outside and shut it.
        // InputPopover's own overlay handles dismissal instead.
        React.useEffect(() => {
            if (!is_dropdown_open || is_phone_landscape) return;

            const handleClickOutside = (event: MouseEvent) => {
                if (dropdown_ref.current && !dropdown_ref.current.contains(event.target as Node)) {
                    setIsDropdownOpen(false);
                }
            };

            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, [is_dropdown_open, is_phone_landscape]);

        // Report the open state so the landscape surface can hold its chrome open: the dropdown is
        // anchored to the header, and letting the 8s auto-hide collapse it would strand the panel.
        React.useEffect(() => {
            onDropdownOpenChange?.(is_dropdown_open);
        }, [is_dropdown_open, onDropdownOpenChange]);

        // Never leave the caller paused if this unmounts while open (a rotate, or leaving the page).
        React.useEffect(() => () => onDropdownOpenChange?.(false), [onDropdownOpenChange]);

        const toggleDropdown = () => {
            // Refetch on the closed -> open transition only, so the account list is never stale
            if (!is_dropdown_open) refetch();
            setIsDropdownOpen(!is_dropdown_open);
        };

        // Check if balance is a valid number (handles comma-formatted strings like "10,000.00" and numeric 0)
        const isValidBalance =
            balance !== undefined &&
            balance !== null &&
            balance !== '' &&
            !isNaN(Number(String(balance).replace(/,/g, '')));

        const accountTypeHeader = is_virtual ? localize('Demo account') : localize('Real account');

        // Determine account types available
        const hasOnlyDemoAccounts = accounts.length > 0 && accounts.every(acc => isDemoAccountId(acc.account_id));

        // Button logic:
        // - If only demo accounts exist -> show "Try real"
        // - Otherwise (real only or both real and demo) -> show "Transfer"
        const buttonLabel = hasOnlyDemoAccounts ? localize('Try real') : localize('Deposit');
        const buttonType = hasOnlyDemoAccounts ? 'try_real' : 'deposit';

        const handleTransferClick = () => {
            // Track analytics event
            const eventName = 'ce_trade_types_form_v2';

            trackAnalyticsEvent(eventName, {
                action: 'click',
                button_type: buttonType,
            });

            if (hasOnlyDemoAccounts) {
                // Show modal instead of redirecting directly
                ui.toggleTryRealModal(true);
            } else {
                // Transfer button (for both account types or real-only accounts)
                const brandUrl = getBrandUrl();
                const lang_param = common.current_language ? `&lang=${common.current_language}` : '';
                window.location.href = `${brandUrl}/transfer?from=dtrader&source=options&acc=options&curr=${currency}${lang_param}`;
            }
        };

        const switcher = (
            <AccountSwitcher
                accounts={accounts}
                current_loginid={client.loginid}
                is_loading={isLoading}
                error={error}
                is_open={is_dropdown_open}
                onClose={() => setIsDropdownOpen(false)}
                onRefetch={refetch}
                onAccountSwitch={handleAccountSwitchStart}
            />
        );

        const renderAccountInfo = () => (
            <React.Fragment>
                <div className='account-header__container' ref={trigger_ref}>
                    <div
                        className={classNames('account-header__info', {
                            'account-header__info--no-switcher': hasOnlyDemoAccounts,
                        })}
                        onClick={hasOnlyDemoAccounts ? undefined : toggleDropdown}
                    >
                        <div
                            className={classNames('account-header__content', {
                                'account-header__content--active': is_dropdown_open,
                            })}
                        >
                            <div className='account-header__content-header'>
                                <Text size='xs' color={is_virtual ? 'tertiary' : 'secondary-alternate'}>
                                    {accountTypeHeader}
                                </Text>
                                {!hasOnlyDemoAccounts && (
                                    <LegacyChevronDown1pxIcon
                                        className={classNames('account-header__select-arrow', {
                                            'account-header__select-arrow--invert': is_dropdown_open && !isMobile,
                                        })}
                                        fill='var(--color-text-primary)'
                                        iconSize='xs'
                                    />
                                )}
                            </div>
                            <Text size='s' weight='bold' className='account-header__balance'>
                                {!currency ? (
                                    <Localize i18n_default_text='No currency assigned' />
                                ) : isValidBalance ? (
                                    `${addComma(balance, 2)} ${getCurrencyDisplayCode(currency)}`
                                ) : (
                                    `0.00 ${getCurrencyDisplayCode(currency)}`
                                )}
                            </Text>
                        </div>
                    </div>
                    {!hasOnlyDemoAccounts &&
                        // The dropdown opens *below* this container, and in landscape the container
                        // sits inside `.trade-landscape__header`, whose `overflow: hidden` (needed for
                        // the chrome collapse animation) clipped it away entirely — the switcher
                        // rendered but was never visible. Portal it out, keeping the same panel.
                        (is_phone_landscape ? (
                            <InputPopover
                                isOpen={is_dropdown_open}
                                onClose={() => setIsDropdownOpen(false)}
                                triggerRef={trigger_ref}
                                placement='bottom'
                                spacing={4}
                                popoverWidth={LANDSCAPE_SWITCHER_WIDTH}
                                className='account-header__switcher-popover'
                            >
                                {switcher}
                            </InputPopover>
                        ) : (
                            switcher
                        ))}
                </div>
                <Button
                    className='account-header__transfer'
                    onClick={handleTransferClick}
                    aria-label={buttonLabel}
                    type='button'
                >
                    <Text size='xs' weight='bold' color='white'>
                        {buttonLabel}
                    </Text>
                </Button>
            </React.Fragment>
        );

        // Only while auth is unsettled — at boot and across a switch — or Log in flashes on reload.
        // `isLoading` must NOT be here: the query is `enabled: is_logged_in`, and a disabled query
        // reports `status: 'loading'` forever, which left logged-out users on a permanent skeleton.
        if (is_logging_in || is_switching_account) {
            return (
                <div className='account-header'>
                    <div className='account-header--loading'>
                        <Skeleton height={44} width={240} borderRadius={22} />
                    </div>
                </div>
            );
        }

        if (!is_logged_in) {
            const handleLoginClick = () => {
                redirectToLogin(common.current_language);
            };

            return (
                <div className='account-header'>
                    <Button
                        className='account-header__login'
                        onClick={handleLoginClick}
                        aria-label={localize('Log in')}
                        type='button'
                    >
                        <Text size='xs' weight='bold' color='white'>
                            <Localize i18n_default_text='Log in' />
                        </Text>
                    </Button>
                </div>
            );
        }

        // Logged in, but the account list has not arrived yet.
        if (isLoading) {
            return (
                <div className='account-header'>
                    <div className='account-header--loading'>
                        <Skeleton height={44} width={240} borderRadius={22} />
                    </div>
                </div>
            );
        }

        return (
            <div className='account-header' ref={dropdown_ref}>
                {renderAccountInfo()}
            </div>
        );
    }
);

AccountHeader.displayName = 'AccountHeader';

export default AccountHeader;
