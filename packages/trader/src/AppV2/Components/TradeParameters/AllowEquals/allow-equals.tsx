import React from 'react';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';

import { TooltipPortal } from '@deriv/components';
import { clickAndKeyEventHandler } from '@deriv/shared';
import { ActionSheet, Heading, Text, TextField, ToggleSwitch, useSnackbar } from '@deriv-com/quill-ui';
import { Localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';

import { hasCallPutEqual, hasDurationForCallPutEqual } from 'Stores/Modules/Trading/Helpers/allow-equals';
import { useTraderStore } from 'Stores/useTraderStores';

import { AutomationLockOverlay } from '../Shared';
import { TTradeParametersProps } from '../trade-parameters';

const AllowEquals = observer(({ is_minimized }: TTradeParametersProps) => {
    const {
        contract_types_list,
        duration_unit,
        expiry_type,
        is_equal,
        is_market_closed,
        is_automation_params_locked,
        onChange,
        symbol,
    } = useTraderStore();
    const { isDesktop } = useDevice();
    const { addSnackbar } = useSnackbar();

    // Locked while the market is closed or an automation run is active.
    const is_disabled = is_market_closed || is_automation_params_locked;

    const [is_open, setIsOpen] = React.useState(false);

    const has_callputequal_duration = hasDurationForCallPutEqual(symbol, contract_types_list, duration_unit);
    const has_callputequal = hasCallPutEqual(contract_types_list);
    const has_allow_equals = (has_callputequal_duration || expiry_type === 'endtime') && has_callputequal;

    const onToggleSwitch = (is_enabled: boolean) => {
        onChange({ target: { name: 'is_equal', value: Number(is_enabled) } });
        setIsOpen(false);
    };

    const openDescription = (e?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
        if (is_disabled) return;
        if (isDesktop) return;
        clickAndKeyEventHandler(() => setIsOpen(true), e);
    };

    const closeSheet = () => setIsOpen(false);

    // Minimized field toggles is_equal inline and notifies via snackbar (no action sheet).
    const toggleAllowEquals = () => {
        if (is_disabled) return;
        const next = !is_equal;
        onChange({ target: { name: 'is_equal', value: Number(next) } });
        addSnackbar({
            message: next ? (
                <Localize i18n_default_text='You will win a payout if the exit spot is equal to the entry spot.' />
            ) : (
                <Localize i18n_default_text='Allow equals turned off.' />
            ),
            hasCloseButton: true,
        });
    };

    if (!has_allow_equals) return null;

    if (is_minimized) {
        return (
            <div className='trade-params__field-locked'>
                <TextField
                    variant='fill'
                    readOnly
                    disabled={is_disabled}
                    label={<Localize i18n_default_text='Allow equals' key='allow-equals-minimized' />}
                    noStatusIcon
                    onClick={toggleAllowEquals}
                    value={is_equal ? 'Yes' : '-'}
                    className={clsx(
                        'trade-params__option',
                        'trade-params__option--minimized',
                        'allow-equals__minimized',
                        is_equal && !is_disabled && 'allow-equals__field--active'
                    )}
                />
                {is_automation_params_locked && <AutomationLockOverlay />}
            </div>
        );
    }

    const description = <Localize i18n_default_text='Win a payout if the exit spot is equal to the entry spot.' />;
    const title_handlers = isDesktop ? {} : { onClick: openDescription, onKeyDown: openDescription };
    const title = (
        <Text
            size='sm'
            className={clsx('allow-equals__title', is_disabled && 'allow-equals__title--disabled')}
            {...title_handlers}
        >
            <Localize i18n_default_text='Allow equals' />
        </Text>
    );

    return (
        <React.Fragment>
            <div
                className={clsx('allow-equals__wrapper', is_automation_params_locked && 'trade-params__field-locked')}
                data-testid='dt_allow_equals_wrapper'
            >
                {isDesktop ? (
                    <TooltipPortal message={description} position='left' className='allow-equals__tooltip'>
                        {title}
                    </TooltipPortal>
                ) : (
                    title
                )}
                <ToggleSwitch checked={!!is_equal} onChange={onToggleSwitch} disabled={is_disabled} />
                {is_automation_params_locked && <AutomationLockOverlay />}
            </div>
            {!isDesktop && (
                <ActionSheet.Root isOpen={is_open} onClose={closeSheet} position='left' expandable={false}>
                    <ActionSheet.Portal shouldCloseOnDrag>
                        <ActionSheet.Content className='allow-equals__definition__wrapper'>
                            <Heading.H4 className='allow-equals__definition__title'>
                                <Localize i18n_default_text='Allow equals' />
                            </Heading.H4>
                            <Text as='div'>{description}</Text>
                        </ActionSheet.Content>
                        <ActionSheet.Footer
                            alignment='vertical'
                            primaryAction={{
                                content: <Localize i18n_default_text='Got it' />,
                                onAction: closeSheet,
                            }}
                            className='allow-equals__button'
                        />
                    </ActionSheet.Portal>
                </ActionSheet.Root>
            )}
        </React.Fragment>
    );
});

export default AllowEquals;
