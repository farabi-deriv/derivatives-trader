import React from 'react';

import { useSnackbar } from '@deriv-com/quill-ui';

import { resetErrorSnackbarDedupe } from 'AppV2/Hooks/useErrorSnackbar';
import { useTraderStore } from 'Stores/useTraderStores';

/**
 * Retracts error snackbars when the active market tab changes.
 *
 * Clearing the store's error state (`clearTradeErrorState`) stops a *new* toast being raised for
 * the incoming tab, but it cannot retract one already on screen: quill owns the 4s timer, and the
 * queue outlives any component that enqueued it. Without this, an error raised on the tab you left
 * keeps sitting over the incoming tab's Buy button — the symptom issue #1246 reports.
 *
 * Only `status: 'fail'` entries are dropped, so success/info toasts (market added, automation
 * stopped, …) are untouched. The first run is skipped: mounting is not a market change, and an
 * error legitimately raised for the tab you arrived on must survive.
 *
 * Retracting also forgets what has been announced. The two mechanisms have to agree: a retraction
 * ends an announcement, so leaving the record in place would let the dedupe window swallow the
 * incoming tab's error whenever it happens to read the same as the one just pulled off screen —
 * which is common, since neighbouring trade types reject the same persisted duration with the same
 * sentence. The trader would switch to a tab that cannot trade and be told nothing.
 *
 * Forgetting here cannot resurrect the toast just retracted: `selectMarketAndTradeType` runs
 * `clearTradeErrorState()` before it writes symbol/contract_type, so by the time this effect fires
 * there is no error left in the store for a producer to re-announce.
 */
const useDismissErrorsOnMarketChange = () => {
    const { symbol, contract_type } = useTraderStore();
    const { queue, removeSnackbar } = useSnackbar();

    // Reading the queue through a ref keeps it out of the effect's deps: the effect must fire on a
    // market change only, not every time the queue itself changes (which enqueuing would do).
    const queue_ref = React.useRef(queue);
    queue_ref.current = queue;

    const previous_market = React.useRef<string | null>(null);

    React.useEffect(() => {
        const market = `${symbol}:${contract_type}`;
        const is_first_run = previous_market.current === null;
        const has_changed = previous_market.current !== market;
        previous_market.current = market;

        if (is_first_run || !has_changed) return;

        queue_ref.current
            .filter(snackbar => snackbar.status === 'fail' && snackbar.id)
            .forEach(snackbar => removeSnackbar(snackbar.id as string));

        resetErrorSnackbarDedupe();
    }, [symbol, contract_type, removeSnackbar]);
};

export default useDismissErrorsOnMarketChange;
