import React from 'react';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';

import { useStore } from '@deriv/stores';

import AccountHeader from 'AppV2/Components/AccountHeader';
import AccumulatorStats from 'AppV2/Components/AccumulatorStats';
import LandscapeFullscreenButton from 'AppV2/Components/LandscapeFullscreenButton';
import LandscapeOnboarding from 'AppV2/Components/LandscapeOnboarding';
import MarketTabs from 'AppV2/Components/MarketTabs';
import TradeErrorSnackbar from 'AppV2/Components/TradeErrorSnackbar';
import LandscapeTradeParams from 'AppV2/Components/TradeParameters/Landscape/landscape-trade-params';
import useAutoHideChrome from 'AppV2/Hooks/useAutoHideChrome';
import useIsPortraitPromptBlocking from 'AppV2/Hooks/useIsPortraitPromptBlocking';

import { TradeChart } from '../Chart';

import './trade-landscape.scss';

// Immersive landscape trade surface for Accumulators: a full-height flex column of collapsible header
// (MarketTabs + AccountHeader), an always-visible AccumulatorStats strip, and a chart that fills the
// remaining space with the floating params pill over it. Sized by CSS flex only, never getChartHeight().
const TradeLandscape = observer(() => {
    const { ui } = useStore();
    const { is_landscape_chrome_hidden, closeSidebarFlyout, setHasSeenLandscapePrompt } = ui;
    const is_prompt_blocking = useIsPortraitPromptBlocking();
    const [is_overlay_open, setIsOverlayOpen] = React.useState(false);
    const [is_account_dropdown_open, setIsAccountDropdownOpen] = React.useState(false);

    // Pause the auto-hide while a parameter editor is open so the pill can't collapse mid-edit, while
    // the account dropdown is open — it hangs off the header, so collapsing strands it — and while
    // PortraitPrompt blocks the page: it listens on the document, so the overlay cannot absorb taps.
    const { is_animating } = useAutoHideChrome({
        is_paused: is_overlay_open || is_account_dropdown_open || is_prompt_blocking,
    });

    // A param sheet / market selector open at rotate leaves quill's portal `body` overflow set, and the
    // rail auto-hides out from under any open flyout — reset both on entering landscape.
    React.useEffect(() => {
        document.body.style.overflow = '';
        closeSidebarFlyout();
        // Getting here is doing what the rotate prompt asks, so it must not greet them again in portrait.
        setHasSeenLandscapePrompt(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div
            className={clsx('trade--landscape', { 'trade--landscape--animating': is_animating })}
            data-testid='dt_trade_landscape'
        >
            <header
                className={clsx('trade-landscape__header', {
                    'trade-landscape__header--collapsed': is_landscape_chrome_hidden,
                })}
            >
                <MarketTabs />
                <AccountHeader onDropdownOpenChange={setIsAccountDropdownOpen} />
            </header>
            <div className='trade-landscape__stats'>
                <AccumulatorStats />
            </div>
            <div className='trade-landscape__chart-tooltip'>
                <section className='trade__chart'>
                    <TradeChart />
                </section>
                <LandscapeTradeParams onOverlayOpenChange={setIsOverlayOpen} />
                <LandscapeFullscreenButton />
            </div>
            {/* PortraitPrompt covers the page; the card would teach a tap it blocks. */}
            {!is_prompt_blocking && <LandscapeOnboarding />}
            <TradeErrorSnackbar error_fields={['take_profit', 'stake', 'amount']} should_show_snackbar />
        </div>
    );
});

export default TradeLandscape;
