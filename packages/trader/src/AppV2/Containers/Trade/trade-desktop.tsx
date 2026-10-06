import React from 'react';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';

import { Loading } from '@deriv/components';
import { getSymbolDisplayName, getViewMarketsFromURL } from '@deriv/shared';
import { useStore } from '@deriv/stores';
import { Loader } from '@deriv-com/ui';

import AccountHeader from 'AppV2/Components/AccountHeader';
import AccumulatorStats from 'AppV2/Components/AccumulatorStats';
import AutomationActions from 'AppV2/Components/AutomationPanel/automation-actions';
import { TRADE_PANEL_TABS } from 'AppV2/Components/AutomationPanel/automation-config';
import AutomationPanel from 'AppV2/Components/AutomationPanel/automation-panel';
import AutomationGuide from 'AppV2/Components/AutomationPanel/AutomationGuide';
import ClosedMarketMessage from 'AppV2/Components/ClosedMarketMessage';
import Guide from 'AppV2/Components/Guide';
import MarketTabs, { MarketTabsSkeleton } from 'AppV2/Components/MarketTabs';
import OnboardingGuide from 'AppV2/Components/OnboardingGuide/GuideForPages';
import PurchaseButton from 'AppV2/Components/PurchaseButton';
import TradeErrorSnackbar from 'AppV2/Components/TradeErrorSnackbar';
import TradePanelTabs from 'AppV2/Components/TradePanelTabs/trade-panel-tabs';
import { TradeParameters } from 'AppV2/Components/TradeParameters';
import TradeParamsFooter from 'AppV2/Components/TradeParamsFooter';
import useActiveSymbols from 'AppV2/Hooks/useActiveSymbols';
import useAutomationSupportedTradeTypes from 'AppV2/Hooks/useAutomationSupportedTradeTypes';
import useContractsFor from 'AppV2/Hooks/useContractsFor';
import useIsAutomationEnabled from 'AppV2/Hooks/useIsAutomationEnabled';
import useNonAutomatableSymbolSnackbar from 'AppV2/Hooks/useNonAutomatableSymbolSnackbar';
import useTabletLandscape from 'AppV2/Hooks/useTabletLandscape';
import { getDisplayedContractTypes } from 'AppV2/Utils/trade-types-utils';
import { useTraderStore } from 'Stores/useTraderStores';

import { TradeChart } from '../Chart';

const TradeDesktop = observer(() => {
    const chart_ref = React.useRef<HTMLDivElement>(null);
    const {
        client,
        ui: { active_sidebar_flyout },
    } = useStore();
    const { is_logged_in } = client;
    const {
        active_symbols,
        contract_type,
        is_accumulator,
        is_automation_tab,
        is_multiplier,
        is_chart_loading,
        is_market_closed,
        proposal_info,
        setActiveTradePanelTab,
        should_show_active_symbols_loading,
        trade_types: trade_types_store,
        trade_type_tab,
        is_reconciling_url_trade_type,
    } = useTraderStore();

    const { trade_types } = useContractsFor();
    const { supported_trade_types: supported_automation_trade_types, is_loading: are_strategies_loading } =
        useAutomationSupportedTradeTypes();
    const { is_enabled: is_automation_enabled, is_ready: is_automation_ready } = useIsAutomationEnabled();

    // When automation is off (EU), clear a stale persisted automation tab so the
    // fallback hooks don't act on it. Gate on readiness so a non-EU user's saved
    // tab isn't wiped mid-lookup.
    React.useEffect(() => {
        if (is_automation_ready && !is_automation_enabled && is_automation_tab) {
            setActiveTradePanelTab(TRADE_PANEL_TABS.TRADE);
        }
    }, [is_automation_ready, is_automation_enabled, is_automation_tab, setActiveTradePanelTab]);

    const is_automation_active = is_automation_enabled && is_automation_tab;
    const should_render_automation_panel = is_automation_active && supported_automation_trade_types.has(contract_type);

    useActiveSymbols();
    useNonAutomatableSymbolSnackbar();
    const { should_show_portrait_loader } = useTabletLandscape({
        is_chart_loading,
        should_show_active_symbols_loading,
    });
    // On a `view_markets=true` landing the market selector opens on load (MarketTabs); defer onboarding
    // until it's closed so they don't overlap. One-shot: seed from the param on first render, then the
    // selector's first close unblocks it for good. Not persisted — a normal visit shows onboarding as usual.
    const [should_defer_onboarding, setShouldDeferOnboarding] = React.useState(() => getViewMarketsFromURL());
    const handleMarketSelectorOpenChange = React.useCallback((is_open: boolean) => {
        if (!is_open) setShouldDeferOnboarding(false);
    }, []);

    // For handling edge cases of snackbar:
    const contract_types = getDisplayedContractTypes(trade_types_store, contract_type, trade_type_tab);
    const is_all_types_with_errors = contract_types.every(item => proposal_info?.[item]?.has_error);
    const is_any_type_with_errors = contract_types.some(item => proposal_info?.[item]?.has_error);
    const is_high_low = /^high_low$/.test(contract_type.toLowerCase());

    // Showing snackbar for all cases, except when it is Rise/Fall or Digits and only one subtype has error
    const should_show_snackbar =
        contract_types.length === 1 ||
        is_multiplier ||
        is_all_types_with_errors ||
        (is_high_low && is_any_type_with_errors);

    const symbols = React.useMemo(
        () =>
            active_symbols.map(({ underlying_symbol: underlying }) => ({
                text: getSymbolDisplayName(underlying || ''),
                value: underlying || '',
            })),
        [active_symbols]
    );

    return (
        <>
            {should_show_portrait_loader && <Loader isFullScreen color='var(--brand-primary)' />}
            {symbols.length && trade_types.length && !is_reconciling_url_trade_type ? (
                <div
                    className={clsx('trade', {
                        trade__logout: !is_logged_in,
                        'trade--flyout-open': active_sidebar_flyout !== null,
                    })}
                >
                    <div className='trade__header'>
                        {/* In automation mode, restrict the selector's trade types to supported ones — and
                            skeleton the strip until that supported set has loaded, so an unfilterable stale
                            tab is never shown as a normal tab. Manual trading renders the strip immediately. */}
                        {is_automation_active && are_strategies_loading ? (
                            <MarketTabsSkeleton />
                        ) : (
                            <MarketTabs
                                supported_trade_types={
                                    is_automation_active ? supported_automation_trade_types : undefined
                                }
                                onSelectorOpenChange={handleMarketSelectorOpenChange}
                            />
                        )}
                        <AccountHeader />
                    </div>
                    <div className='trade__grid'>
                        <div className='trade__chart-tooltip'>
                            <section
                                className={clsx('trade__chart', {
                                    'trade__chart--with-borderRadius': !is_accumulator,
                                })}
                                style={{
                                    height: '100%',
                                }}
                                ref={chart_ref}
                            >
                                <TradeChart />
                            </section>
                            {is_accumulator && <AccumulatorStats />}
                        </div>
                        <div className='trade__parameter'>
                            <div className='trade-params'>
                                <div className='trade-params__content'>
                                    <div className='trade-params__scrollable'>
                                        {should_render_automation_panel ? (
                                            <AutomationGuide />
                                        ) : (
                                            <Guide show_guide_for_selected_contract />
                                        )}
                                        <TradeParameters />
                                        <ClosedMarketMessage />
                                        {should_render_automation_panel && <AutomationPanel />}
                                    </div>
                                    {!should_render_automation_panel && !is_market_closed && <PurchaseButton />}
                                    {should_render_automation_panel && !is_market_closed && <AutomationActions />}
                                </div>
                                <TradeParamsFooter />
                            </div>
                            {is_automation_enabled && <TradePanelTabs />}
                        </div>
                    </div>
                    {/* Deferred while the selector is open on load; shows once closed. Self-gates on
                        the `guide_dtrader_v2.trade_page` flag, so it appears once total per device. */}
                    {is_logged_in && !should_defer_onboarding && <OnboardingGuide type='trade_page' />}
                </div>
            ) : (
                <div className={clsx('trade', { 'trade--flyout-open': active_sidebar_flyout !== null })}>
                    <Loading.DTraderV2 />
                </div>
            )}
            <TradeErrorSnackbar
                error_fields={['stop_loss', 'take_profit', 'date_start', 'stake', 'amount']}
                should_show_snackbar={should_show_snackbar}
            />
        </>
    );
});

export default TradeDesktop;
