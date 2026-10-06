import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

import { StandalonePlusBoldIcon } from '@deriv/quill-icons';
import {
    getRedesignPlatform,
    getSymbolDisplayName,
    getViewMarketsFromURL,
    isAccumulatorContract,
    pickDefaultSymbol,
    removeViewMarketsFromURL,
    trackTradeTabClosed,
    trackTradeTabLimitReached,
    trackTradeTabOpened,
    trackTradeTabSwitched,
} from '@deriv/shared';
import { observer, useStore } from '@deriv/stores';
import { Tooltip, useSnackbar } from '@deriv-com/quill-ui';
import { localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';

import useAutomationLockedSnackbar from 'AppV2/Hooks/useAutomationLockedSnackbar';
import useAvailableContracts from 'AppV2/Hooks/useAvailableContracts';
import useIsPhoneLandscape from 'AppV2/Hooks/useIsPhoneLandscape';
import { getMaxOpenMarkets, TOpenMarket } from 'AppV2/Utils/open-markets-utils';
import { filterPositionsBySymbolAndTradeType, getTotalPositionsProfit } from 'AppV2/Utils/positions-utils';
import { isSameTradeTypeCategory } from 'AppV2/Utils/trade-types-utils';
import { useTraderStore } from 'Stores/useTraderStores';

import MarketSelection from '../MarketSelection';

import MarketTab from './market-tab';

import './market-tabs.scss';

// Seed attempts per Automate visit: the `.catch()` releases the latch, so a dead WS would otherwise retry forever.
const MAX_SEED_ATTEMPTS = 3;

type TMarketTabs = {
    /** When set (e.g. in Automate), restrict the selector's trade types to these values and
     * disable any open tab whose trade type isn't in the set. */
    supported_trade_types?: Set<string>;
    /** Notified when the market selector opens/closes — used to defer page onboarding while it's open. */
    onSelectorOpenChange?: (is_open: boolean) => void;
};

/**
 * The Trade page's market strip: an "add" (+) button that opens the market selector plus one tab per
 * open market. A tab is the ({symbol, contract_type}) PAIR, so a symbol can be open under several
 * trade types at once. The open list lives in the trade store (`open_markets`), recorded from
 * explicit selections (`selectMarketAndTradeType`) — never derived from the churning store state.
 * When `supported_trade_types` is set, tabs with an unsupported trade type are shown but disabled.
 */
const MarketTabs = observer(({ supported_trade_types, onSelectorOpenChange }: TMarketTabs = {}) => {
    const { isMobile } = useDevice();
    const is_phone_landscape = useIsPhoneLandscape();
    const is_phone_viewport = isMobile || is_phone_landscape;
    // Tab cap: 4 on a phone, 7 on web. Viewport, not width — a rotated phone is still a phone.
    const max_open_markets = getMaxOpenMarkets(is_phone_viewport);
    useAvailableContracts();
    // Kept so the async seed can read LIVE store state at commit time — a captured value freezes at
    // the last render, which never happens again once the strip unmounts.
    const trade_store = useTraderStore();
    const {
        active_symbols,
        symbol,
        contract_type,
        open_markets,
        is_selecting_market,
        is_reconciling_url_trade_type,
        is_automation_market_locked,
        automation_run_market,
        removeOpenMarket,
        setAutomationSupportedTradeTypes,
        selectMarketAndTradeType,
        setReplacingMarket,
        is_market_selector_open,
        setMarketSelectorOpen,
    } = trade_store;
    const {
        client: { currency },
        portfolio: { active_positions },
    } = useStore();
    // Shown when a tab is clicked while the strip is locked by an active automation run.
    const showLockedSnackbar = useAutomationLockedSnackbar(
        localize('Tab switching is locked until automation is stopped.')
    );
    // On mobile the disabled "+" explains itself via a snackbar (tooltips need hover); see below.
    const { addSnackbar } = useSnackbar();
    //While any contract is running, re-render on a 1s cadence so
    // every tab's P/L shows on load and stays live (the chart P/L pill refreshes the same way).
    const has_open_positions = active_positions.length > 0;
    const [, refreshPnl] = useState(0);
    useEffect(() => {
        if (!has_open_positions) return undefined;
        const interval_id = setInterval(() => refreshPnl(tick => tick + 1), 1000);
        return () => clearInterval(interval_id);
    }, [has_open_positions]);
    // Selector open state lives in the trade store so the onboarding tour can open/close it.
    const is_selector_open = is_market_selector_open;
    // Anchor for the desktop selector popover (ignored by the mobile full-screen modal).
    const add_button_ref = useRef<HTMLButtonElement>(null);
    // Guards the "add a default supported market" fallback so it fires at most once per entry into a
    // filtered mode with no tradeable tab (reset once a supported market is active again).
    const has_added_default_ref = useRef(false);
    const seed_attempts_ref = useRef(0);
    // Previous open-tab count, for emitting tab open/close/limit analytics off real count changes.
    const prev_tab_count_ref = useRef<number | null>(null);

    // Open/close the selector and notify the parent (so it can defer page onboarding while open).
    // Fires only on real open/close actions, so a view_markets landing can't spuriously unblock.
    // Closing also clears any pending "replace this tab" intent so a later add/select isn't hijacked.
    const setSelectorOpen = useCallback(
        (open: boolean) => {
            setMarketSelectorOpen(open);
            onSelectorOpenChange?.(open);
            if (!open) setReplacingMarket(null);
        },
        [onSelectorOpenChange, setReplacingMarket, setMarketSelectorOpen]
    );

    const handleOpenSelector = () => {
        setReplacingMarket(null);
        setSelectorOpen(true);
    };

    // Open the selector on load when Deriv Home's "View all markets" entry sets `view_markets=true`.
    useEffect(() => {
        if (getViewMarketsFromURL()) {
            setSelectorOpen(true);
            removeViewMarketsFromURL();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // In a filtered mode (e.g. Automate), hand the supported set to the store so its tab-strip writer
    // guards every add against it (an unsupported trade type can never enter or persist) and drops any
    // unsupported tab already carried over/restored. Without this such a tab renders permanently
    // disabled — and a disabled tab can never be active, so its remove "×" never shows and it can't be
    // closed. The seed effect below then keeps a supported market active if this removed the active one.
    useEffect(() => {
        if (supported_trade_types?.size) setAutomationSupportedTradeTypes(supported_trade_types);
    }, [supported_trade_types, setAutomationSupportedTradeTypes]);

    // In a filtered mode (e.g. Automate), keep the strip on a usable market when the active market's
    // trade type isn't supported: first hop to the most-recent tradeable tab (leaving disabled tabs
    // untouched); if none is open, add a default supported market so automation is ready with no
    // clicks (Rise/Fall when available, else the first supported type, on the app default symbol).
    useEffect(() => {
        // While a run is active, the pin-to-run-market effect below owns market selection.
        if (is_automation_market_locked) return;
        if (is_selecting_market || is_reconciling_url_trade_type) return;
        if (!supported_trade_types?.size) {
            has_added_default_ref.current = false;
            seed_attempts_ref.current = 0;
            return;
        }

        const active_is_supported_tab =
            supported_trade_types.has(contract_type) &&
            open_markets.some(
                market => market.symbol === symbol && isSameTradeTypeCategory(market.contract_type, contract_type)
            );
        if (active_is_supported_tab) {
            has_added_default_ref.current = false;
            seed_attempts_ref.current = 0;
            return;
        }
        const tradeable = [...open_markets].reverse().find(market => supported_trade_types.has(market.contract_type));
        if (tradeable) {
            if (tradeable.symbol !== symbol || tradeable.contract_type !== contract_type)
                selectMarketAndTradeType(tradeable.symbol, tradeable.contract_type);
            return;
        }
        // No tradeable tab open — add a default supported market.
        const trade_type = supported_trade_types.has('rise_fall') ? 'rise_fall' : [...supported_trade_types][0];
        // Resolved before the latch/budget are spent — a bail here never starts the seed that releases them.
        if (!trade_type) return;
        if (has_added_default_ref.current || seed_attempts_ref.current >= MAX_SEED_ATTEMPTS) return;
        has_added_default_ref.current = true;
        seed_attempts_ref.current += 1;
        (async () => {
            const default_symbol = (await pickDefaultSymbol(active_symbols)) || symbol;
            // The writer picks its collection from the LIVE mode, so committing after the user left
            // Automate would inject this default into the MANUAL strip and overwrite their market.
            if (!default_symbol || !trade_store.is_automation_mode) return;
            await selectMarketAndTradeType(default_symbol, trade_type);
        })().catch(() => {
            // Release the latch so a later run can retry, bounded by MAX_SEED_ATTEMPTS.
            has_added_default_ref.current = false;
        });
    }, [
        supported_trade_types,
        contract_type,
        open_markets,
        symbol,
        active_symbols,
        selectMarketAndTradeType,
        is_automation_market_locked,
        is_selecting_market,
        is_reconciling_url_trade_type,
        trade_store,
    ]);

    // While a run is active in the automation view, pin the strip to the market the bot is running
    // on. The active market is shared with manual trading, so the user may have drifted it there
    // (the automation view was left free to browse); on return, snap back to the run's exact tab.
    // Matched by symbol + trade-type category (a symbol can have several open tabs); when the run's
    // trade type is unknown (recovered run), fall back to symbol alone. Gated by
    // `is_automation_market_locked` so it never touches manual trading.
    const run_market_symbol = automation_run_market?.symbol ?? null;
    const run_market_type = automation_run_market?.contract_type ?? null;
    useEffect(() => {
        if (!is_automation_market_locked || !run_market_symbol) return;
        const isRunTab = (market: TOpenMarket) =>
            market.symbol === run_market_symbol &&
            (!run_market_type || isSameTradeTypeCategory(market.contract_type, run_market_type));
        // Already on the run's tab? Nothing to do.
        if (isRunTab({ symbol, contract_type })) return;
        const run_tab = open_markets.find(isRunTab);
        if (run_tab) selectMarketAndTradeType(run_tab.symbol, run_tab.contract_type);
    }, [
        is_automation_market_locked,
        run_market_symbol,
        run_market_type,
        symbol,
        contract_type,
        open_markets,
        selectMarketAndTradeType,
    ]);

    // Analytics: emit tab open/close/limit events off the authoritative open-tab count. An increase is
    // a new tab (skipping the initial default tab, so prev >= 1); reaching max_open_markets is the limit
    // event; a decrease is a close (only ever reached via the '×' remove handler).
    useEffect(() => {
        const prev = prev_tab_count_ref.current;
        const current = open_markets.length;
        prev_tab_count_ref.current = current;
        if (prev === null) return; // baseline the first observed count without emitting
        // Viewport, or a landscape phone reports `platform: 'web'` with the phone `limit: 4`.
        const platform = getRedesignPlatform(is_phone_viewport);
        if (current > prev && prev >= 1) {
            trackTradeTabOpened({ tab_count_after_open: current, platform });
            if (current >= max_open_markets) trackTradeTabLimitReached({ limit: max_open_markets, platform });
        } else if (current < prev) {
            trackTradeTabClosed({ tab_count_after_close: current, platform });
        }
    }, [open_markets.length, is_phone_viewport, max_open_markets]);

    // A tab is the active one when its symbol matches AND its trade type is the same as the store's
    // *category* — not necessarily the exact value. The store can resolve a tab's trade type to a
    // sibling in the same category (e.g. rise_fall → rise_fall_equal when "Allow equals" is on, or
    // useContractsFor swapping turbos long↔short); the tab is always recorded with the canonical
    // value, so an exact-equality check would leave nothing selected. Two tabs can never share a
    // category, so this never double-activates.
    const isActiveMarket = (market: TOpenMarket) =>
        market.symbol === symbol && isSameTradeTypeCategory(market.contract_type, contract_type);

    // A tab is disabled when its trade type isn't supported in the current mode (e.g. Automate) —
    // including the currently-selected market, so carrying an unsupported type into Automate greys
    // its tab out (rather than silently switching it). An empty set means "not loaded yet".
    // Also disabled while an automation run locks the strip: every non-active tab greys out so the
    // strip stays pinned to the running market (the active tab keeps its highlight + live P/L).
    const isDisabled = (market: TOpenMarket) =>
        (!!supported_trade_types?.size && !supported_trade_types.has(market.contract_type)) ||
        (is_automation_market_locked && !isActiveMarket(market));

    // Tradeable = not disabled in the current mode. Used to keep at least one tradeable tab around.
    const tradeable_count = open_markets.filter(market => !isDisabled(market)).length;
    // Landscape can only show Accumulators, so the last of those is the last tab it can land on.
    const accumulator_count = open_markets.filter(market => isAccumulatorContract(market.contract_type)).length;

    const handleSelect = (market: TOpenMarket) => {
        // While a run locks the strip, the only tappable tab is the active (running) one — block its
        // replace-selector path too, so the running market can't be swapped out. Non-active tabs are
        // greyed and route through `onDisabledClick` instead.
        if (is_automation_market_locked) {
            showLockedSnackbar();
            return;
        }
        // Tapping an inactive tab activates it. Tapping the already-active tab opens the selector to
        // REPLACE that tab (the store swaps it in place on the next selection) — re-committing the
        // active pair would be a no-op that could e.g. toggle "Allow equals" off, so we don't.
        if (isActiveMarket(market)) {
            setReplacingMarket(market);
            setSelectorOpen(true);
        } else {
            trackTradeTabSwitched({
                tab_count: open_markets.length,
                from_market: getSymbolDisplayName(symbol),
                to_market: getSymbolDisplayName(market.symbol),
            });
            selectMarketAndTradeType(market.symbol, market.contract_type);
        }
    };

    const handleRemove = (market: TOpenMarket) => {
        const is_active_pair = isActiveMarket(market);
        if (is_active_pair) {
            const index = open_markets.findIndex(
                item => item.symbol === market.symbol && item.contract_type === market.contract_type
            );
            const remaining = open_markets.filter((_, i) => i !== index);
            if (!remaining.length) return; // keep at least one active market
            // Activate the tab immediately to the RIGHT of the closed one; if it was the last tab, the
            // one immediately to its LEFT. (After removing `index`, the former right neighbour sits at
            // `remaining[index]`.) Skip disabled tabs but keep that right→left preference.
            const ordered = [...remaining.slice(index), ...remaining.slice(0, index).reverse()];
            const enabled = ordered.filter(item => !isDisabled(item));
            // Landscape renders Accumulators only: any other neighbour is held behind PortraitPrompt
            // rather than committed, so the strip would be left pointing at the tab just removed.
            const renderable = is_phone_landscape
                ? enabled.find(item => isAccumulatorContract(item.contract_type))
                : undefined;
            const next = renderable ?? enabled[0] ?? ordered[0];
            selectMarketAndTradeType(next.symbol, next.contract_type);
        }
        removeOpenMarket(market);
    };

    const is_at_max = open_markets.length >= max_open_markets;
    const is_add_disabled = is_at_max || is_automation_market_locked;

    // Explains why the "+" is disabled: locked during an automation run, or at the tab cap.
    let add_disabled_reason = '';
    if (is_automation_market_locked) {
        add_disabled_reason = localize('Opening new tabs is locked until automation is stopped.');
    } else if (is_at_max) {
        add_disabled_reason = localize('You can open up to {{max}} tabs at a time. Close one to add another.', {
            max: max_open_markets,
        });
    }

    const add_button = (
        <button
            ref={add_button_ref}
            type='button'
            className='market-tabs__add'
            aria-label={localize('Add market')}
            // Desktop disables it and explains on hover. A touch device has neither, so keep it
            // tappable + aria-disabled and answer the tap with a snackbar.
            disabled={is_add_disabled && !is_phone_viewport}
            aria-disabled={is_add_disabled}
            onClick={() => {
                if (!is_add_disabled) {
                    handleOpenSelector();
                } else if (is_phone_viewport && add_disabled_reason) {
                    addSnackbar({ message: add_disabled_reason, hasCloseButton: true, hasFixedHeight: false });
                }
            }}
        >
            <StandalonePlusBoldIcon iconSize='md' fill='var(--color-text-primary)' />
        </button>
    );

    return (
        <div
            // Landscape takes the icon-only strip: Figma gives the selector 456px and desktop tabs want
            // 264px each, so they crushed to bare icons.
            className={clsx('market-tabs', {
                'market-tabs--desktop': !is_phone_viewport,
                'market-tabs--landscape': is_phone_landscape,
            })}
            data-testid='dt_market_tabs'
        >
            {add_disabled_reason && !is_phone_viewport ? (
                <Tooltip
                    as='div'
                    className='market-tabs__add-tooltip'
                    tooltipContent={add_disabled_reason}
                    tooltipPosition='bottom'
                    popoverAlign='start'
                >
                    {add_button}
                </Tooltip>
            ) : (
                add_button
            )}
            <div className='market-tabs__list' data-testid='dt_market_tabs_list'>
                {open_markets.map(market => {
                    const is_disabled = isDisabled(market);
                    // Keep at least one tab overall, and never let the last tradeable tab be closed
                    // (else the user would be left with only un-tradeable markets).
                    const is_last_landscape_tab =
                        is_phone_landscape && isAccumulatorContract(market.contract_type) && accumulator_count === 1;
                    const is_removable =
                        open_markets.length > 1 && (is_disabled || tradeable_count > 1) && !is_last_landscape_tab;
                    // Live P/L for this market + trade type (computed inline so the observer tracks
                    // bid-price updates); null when nothing is running so the tab shows no P/L.
                    const positions = filterPositionsBySymbolAndTradeType(
                        active_positions,
                        market.symbol,
                        market.contract_type
                    );
                    const profit = positions.length ? getTotalPositionsProfit(positions) : null;
                    // Active = the tab whose symbol + trade-type category match the store; a
                    // disabled (unsupported) tab is never shown as active.
                    const is_active = isActiveMarket(market) && !is_disabled;
                    return (
                        <MarketTab
                            key={`${market.symbol}__${market.contract_type}`}
                            market={market}
                            is_active={is_active}
                            // Only the active tab's tap opens the selector — and not even that while a
                            // run locks the strip, where `handleSelect` shows the locked snackbar
                            // instead. Told explicitly so the tab never advertises an affordance
                            // (chevron cue / aria-haspopup) that its tap won't deliver.
                            opens_selector={is_active && !is_automation_market_locked}
                            is_removable={is_removable}
                            is_disabled={is_disabled}
                            profit={profit}
                            currency={currency}
                            onSelect={handleSelect}
                            onRemove={handleRemove}
                            onDisabledClick={is_automation_market_locked ? showLockedSnackbar : undefined}
                        />
                    );
                })}
            </div>
            <MarketSelection
                isOpen={is_selector_open}
                setIsOpen={setSelectorOpen}
                triggerRef={add_button_ref}
                supported_trade_types={supported_trade_types}
            />
        </div>
    );
});

export default MarketTabs;
