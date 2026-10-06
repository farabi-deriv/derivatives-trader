import React from 'react';

import { Loading } from '@deriv/components';
import { observer, useStore } from '@deriv/stores';
import { useDevice } from '@deriv-com/ui';

import PortraitPrompt from 'AppV2/Components/PortraitPrompt';
import ServiceErrorSheet from 'AppV2/Components/ServiceErrorSheet';
import useActiveSymbols from 'AppV2/Hooks/useActiveSymbols';
import useContractsFor from 'AppV2/Hooks/useContractsFor';
import useDismissErrorsOnMarketChange from 'AppV2/Hooks/useDismissErrorsOnMarketChange';
import useIsPhoneLandscape from 'AppV2/Hooks/useIsPhoneLandscape';
import useProposalReconnectReset from 'AppV2/Hooks/useProposalReconnectReset';
import { useTraderStore } from 'Stores/useTraderStores';

import TradeDesktop from './trade-desktop';
import TradeLandscape from './trade-landscape';
import TradeMobile from './trade-mobile';

// Stands in for a surface in landscape until the trade type is known. Startup resolves it from
// `active_symbols` and `contracts_for`, which only the surfaces' hooks fetch — and landscape mounts
// a surface only once the type is already Accumulators. On a cold open (nothing restored, so the
// type starts blank) that never happened, and the page waited forever behind PortraitPrompt.
const LandscapeTradeResolver = observer(() => {
    useActiveSymbols();
    useContractsFor();
    const { contract_type } = useTraderStore();

    // Once resolved to a type with no landscape surface, PortraitPrompt covers the page instead.
    return contract_type ? null : <Loading.DTraderV2 />;
});

// `observer` is load-bearing, not decoration: `useDismissErrorsOnMarketChange` reads `symbol` and
// `contract_type` through `useTraderStore`, which is a bare `useContext` with no reactivity of its
// own. Without a tracked render those reads never invalidate, so the hook's effect deps stay frozen
// at their mount values and the retraction fires only when something else happens to re-render this
// component. That made the fix for issue #1246 work by coincidence of timing.
const Trade = observer(() => {
    const { isMobile } = useDevice();
    const is_phone_landscape = useIsPhoneLandscape();
    const {
        common: { current_language, network_status },
    } = useStore();
    const { is_accumulator, onMount, onUnmount, pending_landscape_selection, commitPendingLandscapeSelection } =
        useTraderStore();

    // Re-issue the one-shot proposal query on reconnect so the stake Save button recovers after idle.
    useProposalReconnectReset();

    // Retract an error toast raised for the tab the user just left — clearing the store stops a new
    // one, but cannot dismiss one already on screen (issue #1246).
    useDismissErrorsOnMarketChange();

    // Owned here — the component that survives a rotate — so swapping the rendered child on rotation
    // never fires onUnmount()/onMount() and re-subscribes proposals mid-flight.
    React.useEffect(() => {
        onMount();
        return onUnmount;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [current_language, network_status.class]);

    // Land the selection landscape held back, now that portrait can render it. Owned here because
    // this component survives the rotation that the branch below swaps children on.
    React.useEffect(() => {
        if (!is_phone_landscape && pending_landscape_selection) commitPendingLandscapeSelection();
    }, [is_phone_landscape, pending_landscape_selection, commitPendingLandscapeSelection]);

    const renderTradeSurface = () => {
        // Accumulators is the only trade type with a landscape surface, so anything else gets no
        // surface rather than the portrait-only layout — TradeDesktop would otherwise show through
        // PortraitPrompt's dim. The resolver takes its place, since the type may not be known yet.
        if (is_phone_landscape) return is_accumulator ? <TradeLandscape /> : <LandscapeTradeResolver />;
        return isMobile ? <TradeMobile /> : <TradeDesktop />;
    };

    return (
        <React.Fragment>
            {renderTradeSurface()}
            {/* Self-gating: covers the surface above whenever a phone in landscape is on a trade type
                that has no landscape layout. Owned here rather than in core's LandscapeBlocker, which
                cannot reach the trader store to name the trade type. */}
            <PortraitPrompt />
            <ServiceErrorSheet />
        </React.Fragment>
    );
});

export default Trade;
