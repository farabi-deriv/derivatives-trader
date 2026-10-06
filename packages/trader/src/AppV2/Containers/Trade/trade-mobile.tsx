import React from 'react';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';

import { Loading } from '@deriv/components';
import { getSymbolDisplayName, getViewMarketsFromURL } from '@deriv/shared';
import { useStore } from '@deriv/stores';

import AccumulatorStats from 'AppV2/Components/AccumulatorStats';
import ChartMaximizeButton from 'AppV2/Components/ChartMaximizeButton';
import ChartProfitLoss from 'AppV2/Components/ChartProfitLoss';
import CompactHeader from 'AppV2/Components/CompactHeader';
import CurrentSpot from 'AppV2/Components/CurrentSpot';
import LandscapePrompt from 'AppV2/Components/LandscapePrompt';
import MarketTabs from 'AppV2/Components/MarketTabs';
import OnboardingGuide from 'AppV2/Components/OnboardingGuide/GuideForPages';
import TradeErrorSnackbar from 'AppV2/Components/TradeErrorSnackbar';
import { TradeParametersContainer } from 'AppV2/Components/TradeParameters';
import useActiveSymbols from 'AppV2/Hooks/useActiveSymbols';
import useContractsFor from 'AppV2/Hooks/useContractsFor';
import { isDigitTradeType } from 'AppV2/Utils/digits';
import { CHART_MAXIMIZE_ANIMATION_MS, getChartHeight } from 'AppV2/Utils/layout-utils';
import { getDisplayedContractTypes } from 'AppV2/Utils/trade-types-utils';
import { useTraderStore } from 'Stores/useTraderStores';

import { TradeChart } from '../Chart';

const Trade = observer(() => {
    const chart_ref = React.useRef<HTMLDivElement>(null);
    const { client, contract_trade, ui } = useStore();
    const { is_logged_in } = client;
    const { is_chart_maximized, is_chart_maximize_animating, setIsChartMaximized, setChartMaximizeAnimating } = ui;
    const {
        active_symbols,
        contract_type,
        has_cancellation,
        is_accumulator,
        is_multiplier,
        is_market_closed,
        symbol,
        proposal_info,
        trade_types: trade_types_store,
        trade_type_tab,
        is_reconciling_url_trade_type,
    } = useTraderStore();
    const { trade_types } = useContractsFor();
    useActiveSymbols();

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

    // Clear contract markers when navigating to trade page from reports
    React.useEffect(() => {
        // Clear any existing contract markers from closed contracts
        if (contract_trade && 'clearClosedContractMarkers' in contract_trade) {
            contract_trade.clearClosedContractMarkers();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Chart-maximize is a chrome toggle of the trade page only — reset it on leaving so the
    // header / market strip / bottom-nav are never left hidden on other pages.
    React.useEffect(() => {
        return () => {
            setIsChartMaximized(false);
            setChartMaximizeAnimating(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Each maximize/minimize toggle flips `is_chart_maximized` and arms the height transition
    // (set in the store action). Disarm it once the transition settles so the chart height only
    // animates on toggle — not on trade-type switches or viewport/keyboard resizes.
    React.useEffect(() => {
        const timeout_id = setTimeout(() => setChartMaximizeAnimating(false), CHART_MAXIMIZE_ANIMATION_MS);
        return () => clearTimeout(timeout_id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [is_chart_maximized]);

    return (
        <>
            {symbols.length && trade_types.length && !is_reconciling_url_trade_type ? (
                <React.Fragment>
                    <div className='trade'>
                        {/* Overlays the shell header's fixed 56px slot; self-hides (fade) when not
                            maximized, so entering/leaving maximized cross-fades in place. */}
                        <CompactHeader />
                        <div
                            className={clsx('trade__market-tabs', {
                                'trade__market-tabs--collapsed': is_chart_maximized,
                            })}
                        >
                            <MarketTabs onSelectorOpenChange={handleMarketSelectorOpenChange} />
                        </div>
                        {isDigitTradeType(contract_type) && <CurrentSpot />}
                        <div className='trade__chart-tooltip'>
                            <section
                                className={clsx('trade__chart', {
                                    'trade__chart--with-borderRadius': !is_accumulator,
                                    'trade__chart--maximize-animating': is_chart_maximize_animating,
                                })}
                                style={{
                                    height: getChartHeight({
                                        is_accumulator,
                                        symbol,
                                        has_cancellation,
                                        contract_type,
                                        is_maximized: is_chart_maximized,
                                    }),
                                }}
                                ref={chart_ref}
                            >
                                <TradeChart />
                                <ChartProfitLoss />
                                <ChartMaximizeButton />
                            </section>
                        </div>
                        {is_accumulator && <AccumulatorStats />}
                    </div>
                    <TradeParametersContainer is_market_closed={is_market_closed} />
                    {/* Deferred while the selector is open on load; shows once closed. Self-gates on
                        the `guide_dtrader_v2.trade_page` flag, so it appears once total per device. */}
                    {is_logged_in && !should_defer_onboarding && <OnboardingGuide type='trade_page' />}
                    <LandscapePrompt />
                </React.Fragment>
            ) : (
                <Loading.DTraderV2 />
            )}
            <TradeErrorSnackbar
                error_fields={['stop_loss', 'take_profit', 'date_start', 'stake', 'amount']}
                should_show_snackbar={should_show_snackbar}
            />
        </>
    );
});

export default Trade;
