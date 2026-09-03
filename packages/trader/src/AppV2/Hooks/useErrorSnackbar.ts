import React from 'react';

import { useSnackbar } from '@deriv-com/quill-ui';

import { ERROR_SNACKBAR_DURATION } from 'AppV2/Utils/layout-utils';

type TSnackbarProps = Parameters<ReturnType<typeof useSnackbar>['addSnackbar']>[0];

/**
 * Announces an error snackbar at most once per message across the whole app.
 *
 * A single proposal error is reported independently by several components — `PurchaseButton`,
 * `TradeErrorSnackbar`, `ServicesErrorSnackbar` (its field-less `contract_error` path), `Duration`
 * and `Barrier` all watch `proposal_info` and all derive the SAME sentence (the store already ran
 * `mapErrorMessage`, and re-running it is idempotent). quill's provider does not dedupe: every
 * `addSnackbar` appends with a fresh id, and `SnackbarController` renders `queue.slice(0, 1)`. So
 * two enqueues are not one toast — they are two full-length toasts played back to back with a
 * ~500ms gap. That is issue #1319: the error shows, dismisses, shows a second time, then falls
 * silent once every producer's own guard is satisfied.
 *
 * Per-component guards cannot fix that, because no producer can see the others. The dedupe record
 * therefore lives at module scope, and is written synchronously before enqueuing — checking quill's
 * `queue` instead would not work, since producers whose effects flush in the same commit all still
 * observe the pre-update context value.
 *
 * The window is the toast's own lifetime, so it also absorbs the gate flapping that made a
 * *dismissed* toast return: switching market tab wipes and refills `proposal_info`, and
 * `onSnackbarRemove: resetServicesError` clears the store, each flipping a producer's condition
 * false→true for what is still the same error. Past the window the same text speaks again — a
 * trader who re-hits an error minutes later has earned an answer, which a permanent one-shot
 * would deny them.
 *
 * Non-string messages (React elements, e.g. `Day`'s `<Localize>`) are never deduped: they have no
 * stable key, and `String(element)` is `'[object Object]'` for every one of them, which would
 * silence unrelated errors instead of duplicate ones.
 */
const DEDUPE_WINDOW_MS = ERROR_SNACKBAR_DURATION + 1000;

const announced_at = new Map<string, number>();

/**
 * Forgets every announcement. `useDismissErrorsOnMarketChange` calls this at the moment it retracts
 * the toasts, so the incoming tab is not silenced by wording that matches the tab just left — see
 * that hook for why the two have to agree. Doubles as the seam tests need, this record being module
 * state that outlives a single `render`.
 */
export const resetErrorSnackbarDedupe = () => announced_at.clear();

const useErrorSnackbar = () => {
    const { addSnackbar } = useSnackbar();

    return React.useCallback(
        (snackbar: TSnackbarProps) => {
            const key = typeof snackbar.message === 'string' ? snackbar.message : null;

            if (key !== null) {
                const now = Date.now();
                announced_at.forEach((announced, message) => {
                    if (now - announced >= DEDUPE_WINDOW_MS) announced_at.delete(message);
                });
                if (announced_at.has(key)) return false;
                announced_at.set(key, now);
            }

            addSnackbar({
                status: 'fail',
                hasCloseButton: true,
                hasFixedHeight: false,
                delay: ERROR_SNACKBAR_DURATION,
                ...snackbar,
            });
            return true;
        },
        [addSnackbar]
    );
};

export default useErrorSnackbar;
