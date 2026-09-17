import React from 'react';
import clsx from 'clsx';

import { ActionSheet, TextField } from '@deriv-com/quill-ui';
import { Localize, useTranslations } from '@deriv-com/translations';

import { ActionSheetHeaderTitle } from 'AppV2/Components/ActionSheetHeaderTooltip';
import { AutomationLockOverlay } from 'AppV2/Components/TradeParameters/Shared';

import { getStrategyLabel, TStrategyOption } from '../automation-config';

type TStrategySelectorMobileProps = {
    options: TStrategyOption[];
    selectedValue: string;
    description?: string;
    disabled?: boolean;
    is_market_closed?: boolean;
    onSelect: (value: string) => void;
};

const StrategySelectorMobile = ({
    options,
    selectedValue,
    disabled,
    is_market_closed,
    onSelect,
}: TStrategySelectorMobileProps) => {
    const { localize } = useTranslations();
    const [is_open, setIsOpen] = React.useState(false);
    const [preview_value, setPreviewValue] = React.useState(selectedValue);

    const onClose = React.useCallback(() => {
        setIsOpen(false);
        setPreviewValue(selectedValue);
    }, [selectedValue]);

    // Re-init the draft from the committed value whenever the sheet opens (dismiss = discard).
    React.useEffect(() => {
        if (is_open) setPreviewValue(selectedValue);
    }, [is_open, selectedValue]);

    const handleSave = React.useCallback(() => {
        onSelect(preview_value);
        setIsOpen(false);
    }, [onSelect, preview_value]);

    const preview_option = options.find(o => o.value === preview_value) ?? options[0];
    const is_save_disabled = preview_value === selectedValue;

    return (
        <React.Fragment>
            <div className='trade-params__field-locked'>
                <TextField
                    variant='fill'
                    readOnly
                    disabled={disabled || is_market_closed}
                    label={<Localize i18n_default_text='Strategy' />}
                    value={getStrategyLabel(selectedValue, options)}
                    noStatusIcon
                    className='trade-params__option'
                    onClick={() => setIsOpen(true)}
                />
                {disabled && <AutomationLockOverlay />}
            </div>
            <ActionSheet.Root isOpen={is_open} onClose={onClose} position='left' expandable={false}>
                <ActionSheet.Portal showHandlebar={false} shouldDetectSwipingOnContainer shouldCloseOnDrag>
                    <ActionSheet.Header
                        title={
                            <ActionSheetHeaderTitle
                                title={<Localize i18n_default_text='Strategy' />}
                                description={preview_option?.description}
                                label={localize('Strategy')}
                            />
                        }
                        closeAction={{ ariaLabel: localize('Close') }}
                        saveAction={{ onAction: handleSave, ariaLabel: localize('Save') }}
                        isSaveActionDisabled={is_save_disabled}
                        shouldCloseOnSaveActionClick={false}
                    />
                    <ActionSheet.Content>
                        <div className='automation-popover__content'>
                            {options.map(({ value, label }) => (
                                <button
                                    key={value}
                                    type='button'
                                    className={clsx('automation-popover__option', {
                                        'automation-popover__option--selected': value === preview_value,
                                    })}
                                    onClick={() => setPreviewValue(value)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </ActionSheet.Content>
                </ActionSheet.Portal>
            </ActionSheet.Root>
        </React.Fragment>
    );
};

export default StrategySelectorMobile;
