import React from 'react';

import { routes } from '@deriv/shared';
import { observer, useStore } from '@deriv/stores';

import { getErrorSnackbarBottomOffset } from 'AppV2/Utils/layout-utils';

import useErrorSnackbar from '../../Hooks/useErrorSnackbar';
import useTradeError, { TErrorFields } from '../../Hooks/useTradeError';

/**
 * Enqueues an auto-dismissing error snackbar whenever a BE error matching one of the passed
 * `error_fields` is present in the proposal.
 *
 * Architectural note: this component only ENQUEUES snackbars via `useSnackbar` — it renders
 * nothing on purpose. Displaying the queue requires a `SnackbarController` mounted in the same
 * `SnackbarProvider` tree; AppV2's root already mounts the single controller (see
 * `ServicesErrorSnackbar`, mounted in AppV2/app.tsx on every route). Do not render another
 * `SnackbarController` here: every controller portals the *same* provider queue into
 * `document.body`, so a second one stacks an identical fixed snackbar on top of the first,
 * and the lower copy swallows taps (its buttons stop receiving pointer events).
 */
const TradeErrorSnackbar = observer(
    ({ error_fields, should_show_snackbar }: { error_fields: TErrorFields[]; should_show_snackbar?: boolean }) => {
        const {
            ui: { is_chart_maximized },
        } = useStore();
        const announceError = useErrorSnackbar();
        const { is_error_matching_field: has_error, message } = useTradeError({
            error_fields, // array with BE error_fields, for which we will track errors.
        });

        // The gate below is not a one-shot: switching market tab wipes and refills `proposal_info`,
        // so it flips true→false→true for what is still the same error. `useErrorSnackbar` absorbs
        // that, and — unlike a guard local to this component — also the copies of this very sentence
        // that `PurchaseButton` and `ServicesErrorSnackbar` raise for the same proposal response.
        React.useEffect(() => {
            if (!has_error || !should_show_snackbar) return;

            announceError({
                message,
                style: {
                    // This component only ever renders on the Trade page.
                    marginBottom: getErrorSnackbarBottomOffset({
                        pathname: routes.index,
                        is_chart_maximized,
                    }),
                    width: 'calc(100% - var(--core-spacing-800)',
                },
            });
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [has_error, should_show_snackbar, message]);

        return null;
    }
);

export default TradeErrorSnackbar;
