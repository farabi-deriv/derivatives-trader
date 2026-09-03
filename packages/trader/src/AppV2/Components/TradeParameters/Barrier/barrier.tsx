import React from 'react';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';

import { mapErrorMessage, routes } from '@deriv/shared';
import { useStore } from '@deriv/stores';
import { ActionSheet, TextField } from '@deriv-com/quill-ui';
import { Localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';

import useErrorSnackbar from 'AppV2/Hooks/useErrorSnackbar';
import { getErrorSnackbarBottomOffset } from 'AppV2/Utils/layout-utils';
import { useTraderStore } from 'Stores/useTraderStores';

import { TTradeParametersProps } from '../trade-parameters';

import BarrierDesktop from './barrier-desktop';
import BarrierInput from './barrier-input';

const Barrier = observer(({ is_minimized }: TTradeParametersProps) => {
    const trade_store = useTraderStore();
    const { barrier_1, is_market_closed, validation_errors, proposal_info, trade_type_tab, symbol } = trade_store;
    const {
        ui: { is_chart_maximized },
    } = useStore();
    const { isMobile } = useDevice();
    const [is_open, setIsOpen] = React.useState(false);

    const has_error =
        (validation_errors.barrier_1?.length ?? 0) > 0 ||
        (proposal_info?.[trade_type_tab]?.has_error && proposal_info?.[trade_type_tab]?.error_field === 'barrier');

    const announceError = useErrorSnackbar();
    const [barrier_error_shown, setBarrierErrorShown] = React.useState(false);

    const onClose = React.useCallback(() => {
        setIsOpen(false);
    }, []);

    // Show error snackbar when there's a barrier error
    React.useEffect(() => {
        const proposal_error = proposal_info?.[trade_type_tab];
        const has_error = proposal_error?.has_error;
        const error_field = proposal_error?.error_field;

        // See the Duration equivalent: the former `!is_minimized` gate meant "expanded sheet only",
        // which no longer exists, so keeping it would make this unreachable on mobile.
        if (has_error && error_field === 'barrier' && !barrier_error_shown && !is_open) {
            // Deduped app-wide: `PurchaseButton` reports this same sentence off the same proposal
            // response, and quill plays two enqueues as two toasts (issue #1319).
            announceError({
                message: mapErrorMessage(proposal_error),
                hasFixedHeight: true,
                style: {
                    marginBottom: getErrorSnackbarBottomOffset({
                        pathname: routes.index,
                        is_chart_maximized,
                    }),
                },
            });
            setBarrierErrorShown(true);
        }
    }, [proposal_info, barrier_error_shown, is_open, trade_type_tab, announceError, is_chart_maximized]);

    // Reset error shown flag when modal opens
    React.useEffect(() => {
        if (is_open) {
            setBarrierErrorShown(false);
        }
    }, [is_open]);

    if (!isMobile) {
        return <BarrierDesktop is_minimized={is_minimized} />;
    }

    return (
        <>
            <TextField
                className={clsx('trade-params__option', is_minimized && 'trade-params__option--minimized')}
                disabled={is_market_closed}
                variant='fill'
                readOnly
                noStatusIcon
                label={<Localize i18n_default_text='Barrier' key={`barrier${is_minimized ? '-minimized' : ''}`} />}
                value={barrier_1}
                onClick={() => setIsOpen(true)}
                status={has_error && !is_open ? 'error' : undefined}
            />
            <ActionSheet.Root
                isOpen={is_open}
                onClose={onClose}
                position='left'
                expandable={false}
                shouldBlurOnClose={is_open}
            >
                <ActionSheet.Portal showHandlebar={false} shouldDetectSwipingOnContainer shouldCloseOnDrag>
                    <BarrierInput onClose={onClose} is_open={is_open} />
                </ActionSheet.Portal>
            </ActionSheet.Root>
        </>
    );
});

export default Barrier;
