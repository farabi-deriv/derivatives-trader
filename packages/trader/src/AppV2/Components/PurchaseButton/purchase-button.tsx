import React from 'react';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';

import { Skeleton } from '@deriv/components';
import { StandaloneStopwatchRegularIcon } from '@deriv/quill-icons';
import {
    getCardLabelsV2,
    getIndicativePrice,
    getMarketName,
    getTradeTypeName,
    hasContractEntered,
    isAccumulatorContract,
    isOpen,
    isPendingSettlement,
    isValidToSell,
    routes,
    trackAnalyticsEvent,
} from '@deriv/shared';
import { useStore } from '@deriv/stores';
import { Button, useNotifications } from '@deriv-com/quill-ui';
import { useTranslations } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';

import RiskDisclosureModal from 'AppV2/Components/RiskDisclosureModal';
import useContractsFor from 'AppV2/Hooks/useContractsFor';
import useErrorSnackbar from 'AppV2/Hooks/useErrorSnackbar';
import useIsPhoneLandscape from 'AppV2/Hooks/useIsPhoneLandscape';
import { useRiskDisclosure } from 'AppV2/Hooks/useRiskDisclosure';
import { getCurrencySymbol } from 'AppV2/Utils/currency-utils';
import { getErrorSnackbarBottomOffset, SERVICE_ERROR } from 'AppV2/Utils/layout-utils';
import { getTradeTypeTabsList } from 'AppV2/Utils/trade-params-utils';
import { getDisplayedContractTypes } from 'AppV2/Utils/trade-types-utils';
import { useTraderStore } from 'Stores/useTraderStores';

import PurchaseButtonContent from './purchase-button-content';

const BASIS_STAKE = 'stake';
const BASIS_PAYOUT = 'payout';
const BASIS_NAME = 'basis';

const PurchaseButton = observer(() => {
    const purchaseButtonRef = React.useRef(null);
    const { localize } = useTranslations();
    const { isMobile } = useDevice();
    const { addBanner } = useNotifications();
    const announceError = useErrorSnackbar();
    const {
        portfolio: { all_positions, onClickSell },
        client,
        common: { services_error, setServicesError },
        ui: { is_chart_maximized, is_switching_account },
    } = useStore();
    const { is_logged_in } = client;
    const { trade_types: trade_types_list } = useContractsFor();
    const risk_disclosure = useRiskDisclosure();
    const {
        is_eligible: is_risk_disclosure_eligible,
        is_fully_accepted: is_risk_disclosure_accepted,
        is_evaluating: is_risk_disclosure_evaluating,
        open: openRiskDisclosure,
    } = risk_disclosure;
    const {
        basis,
        basis_list,
        contract_type,
        currency,
        has_cancellation,
        growth_rate,
        is_accumulator,
        is_chart_loading,
        is_multiplier,
        is_purchase_pending,
        is_trade_enabled_v2,
        is_turbos,
        is_vanilla_fx,
        is_vanilla,
        maximum_payout,
        proposal_info,
        onHoverPurchase,
        onPurchaseV2,
        onChange,
        symbol,
        trade_type_tab,
        trade_types,
    } = useTraderStore();

    // Remember once the chart has finished loading. Used to gate the button on the first load
    // only — later symbol switches also reload the chart, but shouldn't re-hide the button.
    const has_chart_loaded_once = React.useRef(false);
    if (is_chart_loading === false) has_chart_loaded_once.current = true;
    // Fallback so a chart that never reports ready can't trap the button on a skeleton.
    const [is_chart_load_timed_out, setIsChartLoadTimedOut] = React.useState(false);
    React.useEffect(() => {
        const timer = setTimeout(() => setIsChartLoadTimedOut(true), 10000);
        return () => clearTimeout(timer);
    }, []);
    const is_awaiting_initial_chart = !has_chart_loaded_once.current && !is_chart_load_timed_out;

    const active_accu_contract = is_accumulator
        ? all_positions.find(({ contract_info, type }) => {
              const contract_underlying = contract_info.underlying_symbol;
              return isAccumulatorContract(type) && contract_underlying === symbol && isOpen(contract_info);
          })
        : undefined;

    const has_open_accu_contract = !!active_accu_contract;

    // Accu that is expired/settleable but the backend hasn't sold it yet (is_sold still 0).
    // The server still counts it as open and rejects a new buy, so hold the Buy button in a
    // loading state until is_sold arrives — however long backend settlement takes. No timed
    // release: a stuck settlement can outlast any timeout, and an early-released Buy is
    // guaranteed to fail with an open-position-limit error.
    const is_accu_settling =
        is_accumulator &&
        !has_open_accu_contract &&
        all_positions.some(
            ({ contract_info, type }) =>
                isAccumulatorContract(type) &&
                contract_info.underlying_symbol === symbol &&
                isPendingSettlement(contract_info)
        );
    const basis_options = React.useMemo(
        () => (basis_list.length ? basis_list.map(item => item.value) : []),
        [basis_list]
    );

    // Landscape leaves the button label-only for a fresh accumulator (see below),
    // and the spec fills that empty row with the growth rate being bought at.
    // Only while choosing: once a contract is running the rate is locked and the
    // button switches to its own state.
    const is_phone_landscape = useIsPhoneLandscape();
    const landscape_growth_rate =
        is_accumulator && !has_open_accu_contract && is_phone_landscape ? growth_rate : undefined;

    const purchase_button_content_props = {
        currency,
        growth_rate: landscape_growth_rate,
        has_cancellation,
        has_open_accu_contract,
        is_accumulator,
        is_multiplier,
        is_turbos,
        is_vanilla,
        max_payout: maximum_payout,
    };
    // Do NOT swap this `isMobile` for `useIsPhoneViewport()` — landscape relies on it being false here
    // to get the spec's label-only button; swapping restores the `Max. payout` caption.
    const has_no_button_content =
        is_vanilla || is_vanilla_fx || is_turbos || (is_accumulator && !has_open_accu_contract && !isMobile);
    const contract_types = getDisplayedContractTypes(trade_types, contract_type, trade_type_tab);
    const is_valid_to_sell = active_accu_contract?.contract_info
        ? hasContractEntered(active_accu_contract.contract_info) &&
          isOpen(active_accu_contract.contract_info) &&
          isValidToSell(active_accu_contract.contract_info)
        : false;
    const current_stake =
        (is_valid_to_sell && active_accu_contract && getIndicativePrice(active_accu_contract.contract_info)) || null;
    const cardLabels = getCardLabelsV2();
    const is_accu_sell_disabled = !is_valid_to_sell || active_accu_contract?.is_sell_requested;

    React.useEffect(
        () => () => {
            if (is_multiplier) onHoverPurchase(false, contract_type);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    // Green for the up side, red for the down side.
    const getButtonColor = (trade_type: string) => {
        const tab_index = getTradeTypeTabsList(contract_type).findIndex(tab => tab.contract_type === trade_type);
        return tab_index > 0 ? 'sell' : 'purchase';
    };

    const addNotificationBannerCallback = (
        params: Parameters<typeof addBanner>[0],
        contract_id: number,
        specific_contract_type: string
    ) => {
        // Track run_contract analytics event directly
        const selected_trade_type = trade_types_list.find(({ value }) => value === contract_type);
        const trade_type_name = selected_trade_type?.text || contract_type;
        const market_type_name = getMarketName(symbol) || symbol;
        const contract_type_display = getTradeTypeName(specific_contract_type) || '';

        trackAnalyticsEvent('ce_contracts_set_up_form_v2', {
            action: 'run_contract',
            trade_type_name,
            market_type_name,
            contract_id,
            contract_type: contract_type_display,
        });

        return addBanner({
            icon: (
                <StandaloneStopwatchRegularIcon
                    iconSize='sm'
                    className='trade-notification--purchase'
                    key='contract-opened'
                />
            ),
            ...params,
        });
    };

    React.useEffect(() => {
        const is_rise_fall = /^rise_fall/.test(contract_type.toLowerCase());
        const shouldSwitchToStake =
            basis === BASIS_PAYOUT && basis_options.length > 1 && basis_options.includes(BASIS_STAKE) && !is_rise_fall;
        if (shouldSwitchToStake) {
            onChange({ target: { value: BASIS_STAKE, name: BASIS_NAME } });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [basis, basis_options, contract_type]);

    React.useEffect(() => {
        // Only check errors for the currently displayed contract types (filtered by trade_type_tab)
        // to avoid showing errors from non-displayed contract types (e.g., stale DIGITOVER error on Under tab)
        if (proposal_info && contract_types.length > 0) {
            let message = '';
            const has_error = contract_types.some(type => {
                const info = proposal_info[type];
                // Exclude MarketIsClosed errors - already handled by ClosedMarketMessage component
                if (info?.has_error && info?.message && info?.error_code !== 'MarketIsClosed') {
                    message = info.message || '';
                    return true;
                }
                return false;
            });

            // Deduped app-wide: this button reports the same sentence as `TradeErrorSnackbar` (for a
            // field-tagged error) or `ServicesErrorSnackbar` (for a field-less one) off a single
            // proposal response, and quill plays two enqueues as two sequential toasts (issue #1319).
            if (has_error && message) {
                announceError({
                    message,
                    style: {
                        // This button only renders on the Trade page.
                        marginBottom: getErrorSnackbarBottomOffset({
                            pathname: routes.index,
                            is_chart_maximized,
                        }),
                        width: 'calc(100% - var(--core-spacing-800))',
                    },
                });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [proposal_info]);

    const should_show_review_disclosure = is_risk_disclosure_eligible && !is_risk_disclosure_accepted;

    // Skeleton until disclosure eligibility and the initial chart load settle, so Buy never flashes.
    if (is_risk_disclosure_evaluating || is_awaiting_initial_chart) {
        return (
            <div
                className={clsx('purchase-button__wrapper', {
                    'purchase-button__wrapper__un-auth': !is_logged_in,
                })}
            >
                <Skeleton className='purchase-button__skeleton' height={48} borderRadius={28} />
            </div>
        );
    }

    if (should_show_review_disclosure) {
        return (
            <>
                <div
                    className={clsx('purchase-button__wrapper', {
                        'purchase-button__wrapper__un-auth': !is_logged_in,
                    })}
                >
                    <Button
                        variant='secondary'
                        color='black-white'
                        size='lg'
                        label={localize('Review risk disclosure')}
                        fullWidth
                        className='purchase-button--review-disclosure'
                        onClick={openRiskDisclosure}
                    />
                </div>
                <RiskDisclosureModal
                    is_open={risk_disclosure.is_open}
                    is_loading={risk_disclosure.is_loading}
                    is_fully_accepted={risk_disclosure.is_fully_accepted}
                    error={risk_disclosure.error}
                    onClose={risk_disclosure.close}
                    onAccept={risk_disclosure.accept}
                />
            </>
        );
    }

    return (
        <React.Fragment>
            {has_open_accu_contract ? (
                <div className='purchase-button__wrapper'>
                    <Button
                        color='black-white'
                        size='lg'
                        label={
                            is_accu_sell_disabled
                                ? `${cardLabels.CLOSE}`
                                : `${cardLabels.CLOSE} ${getCurrencySymbol(currency)}${current_stake}`
                        }
                        fullWidth
                        isOpaque
                        isLoading={active_accu_contract?.is_sell_requested}
                        className='purchase-button purchase-button--single'
                        disabled={!is_valid_to_sell}
                        onClick={() => onClickSell(active_accu_contract?.contract_info.contract_id)}
                    />
                </div>
            ) : (
                <div
                    ref={purchaseButtonRef}
                    className={clsx('purchase-button__wrapper', {
                        'purchase-button__wrapper__un-auth': !is_logged_in,
                    })}
                >
                    {(() => {
                        // Single unified Buy button; the selected side is contract_types[0].
                        const [trade_type] = contract_types;
                        if (!trade_type) return null;

                        const info = proposal_info?.[trade_type] || {};
                        const is_insufficient_balance =
                            (info.has_error && info.error_code === SERVICE_ERROR.INSUFFICIENT_BALANCE) ||
                            services_error?.code === SERVICE_ERROR.INSUFFICIENT_BALANCE;
                        const is_disabled =
                            !is_trade_enabled_v2 ||
                            (info.has_error && !is_insufficient_balance) ||
                            is_switching_account ||
                            // No price yet — nothing to buy. An error also has no id but sets
                            // has_error, keeping insufficient-balance's inform-don't-disable intact.
                            (!info.id && !info.has_error);
                        // Driven straight off the store flag, which the store sets for the whole
                        // attempt and clears on every exit. Mirroring it into local state and
                        // resetting on an is_purchase_enabled transition left the spinner stuck
                        // whenever an attempt ended without that observable changing.
                        const is_button_disabled = is_disabled && !is_purchase_pending && !is_accu_settling;
                        const is_button_loading = is_purchase_pending || is_accu_settling;

                        return (
                            <Button
                                color={getButtonColor(trade_type)}
                                size='lg'
                                label={localize('Buy')}
                                fullWidth
                                className={clsx(
                                    'purchase-button',
                                    'purchase-button--single',
                                    is_button_loading && 'purchase-button--loading'
                                )}
                                isLoading={is_button_loading}
                                isOpaque
                                disabled={is_button_disabled}
                                onMouseEnter={() => {
                                    if (isMobile || !is_multiplier || is_button_disabled) return;
                                    onHoverPurchase(true, trade_type);
                                }}
                                onMouseLeave={() => {
                                    if (isMobile || !is_multiplier) return;
                                    onHoverPurchase(false, trade_type);
                                }}
                                onClick={() => {
                                    // A buy while the previous accu is still settling is rejected by
                                    // the backend (position still counts as open) — swallow the click.
                                    if (is_accu_settling) return;
                                    if (!is_logged_in) {
                                        // Logged-out users can't buy: the server always rejects with
                                        // AuthorizationRequired. Open the auth sheet directly instead of
                                        // sending a doomed buy and awaiting proposals — that path can leave
                                        // the button stuck loading and blank the payout after the sheet closes.
                                        setServicesError(
                                            { code: SERVICE_ERROR.AUTHORIZATION_REQUIRED, type: 'buy' },
                                            true
                                        );
                                        return;
                                    }
                                    if (is_insufficient_balance) {
                                        const error =
                                            (info.has_error && {
                                                code: SERVICE_ERROR.INSUFFICIENT_BALANCE,
                                                message: info.message,
                                                type: 'buy',
                                            }) ||
                                            services_error;
                                        if (error) {
                                            setServicesError(error, true);
                                            return;
                                        }
                                    }
                                    onPurchaseV2(trade_type, isMobile, (params, contract_id) => {
                                        addNotificationBannerCallback(params, contract_id, trade_type);
                                    });
                                }}
                            >
                                {!is_button_loading && (
                                    <PurchaseButtonContent
                                        {...purchase_button_content_props}
                                        has_no_button_content={has_no_button_content}
                                        info={info}
                                    />
                                )}
                            </Button>
                        );
                    })()}
                </div>
            )}
        </React.Fragment>
    );
});

export default PurchaseButton;
