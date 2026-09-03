import React from 'react';

import { observer } from '@deriv/stores';
import { useDevice } from '@deriv-com/ui';

import ServiceErrorSheet from 'AppV2/Components/ServiceErrorSheet';
import useDismissErrorsOnMarketChange from 'AppV2/Hooks/useDismissErrorsOnMarketChange';
import useProposalReconnectReset from 'AppV2/Hooks/useProposalReconnectReset';

import TradeDesktop from './trade-desktop';
import TradeMobile from './trade-mobile';

// `observer` is load-bearing, not decoration: `useDismissErrorsOnMarketChange` reads `symbol` and
// `contract_type` through `useTraderStore`, which is a bare `useContext` with no reactivity of its
// own. Without a tracked render those reads never invalidate, so the hook's effect deps stay frozen
// at their mount values and the retraction fires only when something else happens to re-render this
// component. That made the fix for issue #1246 work by coincidence of timing.
const Trade = observer(() => {
    const { isMobile } = useDevice();

    // Re-issue the one-shot proposal query on reconnect so the stake Save button recovers after idle.
    useProposalReconnectReset();

    // Retract an error toast raised for the tab the user just left — clearing the store stops a new
    // one, but cannot dismiss one already on screen (issue #1246).
    useDismissErrorsOnMarketChange();

    return (
        <React.Fragment>
            {isMobile ? <TradeMobile /> : <TradeDesktop />}
            <ServiceErrorSheet />
        </React.Fragment>
    );
});

export default Trade;
