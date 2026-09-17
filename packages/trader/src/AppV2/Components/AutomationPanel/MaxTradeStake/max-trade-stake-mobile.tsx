import React from 'react';

import { getDecimalPlaces } from '@deriv/shared';
import { ActionSheet, Text, TextField, ToggleSwitch } from '@deriv-com/quill-ui';
import { Localize, useTranslations } from '@deriv-com/translations';

import { ActionSheetHeaderTitle } from 'AppV2/Components/ActionSheetHeaderTooltip';
import { AutomationLockOverlay } from 'AppV2/Components/TradeParameters/Shared';
import { getCurrencySymbol } from 'AppV2/Utils/currency-utils';
import { createDecimalInputGuard, getDecimalInputMaxLength } from 'AppV2/Utils/decimal-input';

type TMaxTradeStakeMobileProps = {
    currency: string;
    initialValue: number | null;
    initialStake?: number;
    description?: string;
    disabled?: boolean;
    is_market_closed?: boolean;
    onSave: (value: number | null) => void;
};

const MaxTradeStakeMobile = ({
    currency,
    initialValue,
    initialStake,
    description,
    disabled,
    is_market_closed,
    onSave,
}: TMaxTradeStakeMobileProps) => {
    const { localize } = useTranslations();
    const currency_symbol = getCurrencySymbol(currency);
    const [is_open, setIsOpen] = React.useState(false);
    const [is_enabled, setIsEnabled] = React.useState(initialValue !== null);
    const [value, setValue] = React.useState(initialValue ? String(initialValue) : '');
    const [error, setError] = React.useState('');
    const decimals = getDecimalPlaces(currency);
    const onBeforeInput = createDecimalInputGuard(decimals);

    const onClose = React.useCallback(() => {
        setIsOpen(false);
        setIsEnabled(initialValue !== null);
        setValue(initialValue ? String(initialValue) : '');
        setError('');
    }, [initialValue]);

    // Re-init the draft from the committed value whenever the sheet opens (dismiss = discard).
    React.useEffect(() => {
        if (is_open) {
            setIsEnabled(initialValue !== null);
            setValue(initialValue ? String(initialValue) : '');
            setError('');
        }
    }, [is_open, initialValue]);

    const handleToggle = (enabled: boolean) => {
        setIsEnabled(enabled);
        if (!enabled) {
            setValue('');
            setError('');
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setValue(e.target.value);
        setError('');
    };

    const handleSave = () => {
        if (!is_enabled) {
            onSave(null);
            setIsOpen(false);
            return;
        }
        const num = Number(value);
        if (!value || isNaN(num) || num <= 0) {
            setError(localize('Please enter a valid amount greater than 0'));
            return;
        }
        if (initialStake !== undefined && num < initialStake) {
            setError(
                localize('Max. stake must be equal or greater than {{stake}}', {
                    stake: initialStake,
                })
            );
            return;
        }
        onSave(num);
        setIsOpen(false);
    };

    // Mirror the value handleSave would commit so the header save only enables on an actual change.
    const drafted_value = !is_enabled ? null : value === '' ? null : Number(value);
    const is_save_disabled = drafted_value === initialValue;

    return (
        <React.Fragment>
            <div className='trade-params__field-locked'>
                <TextField
                    variant='fill'
                    readOnly
                    disabled={disabled || is_market_closed}
                    label={<Localize i18n_default_text='Max. stake' />}
                    value={initialValue ? `${currency_symbol}${initialValue}` : '-'}
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
                                title={<Localize i18n_default_text='Max. stake' />}
                                description={description}
                                label={localize('Max. stake')}
                            />
                        }
                        closeAction={{ ariaLabel: localize('Close') }}
                        saveAction={{ onAction: handleSave, ariaLabel: localize('Save') }}
                        isSaveActionDisabled={is_save_disabled}
                        shouldCloseOnSaveActionClick={false}
                    />
                    <ActionSheet.Content>
                        <div className='automation-popover__input-wrapper'>
                            <div className='automation-popover__toggle-header'>
                                <Text size='sm'>
                                    <Localize i18n_default_text='Max. stake' />
                                </Text>
                                <ToggleSwitch checked={is_enabled} onChange={handleToggle} />
                            </div>
                            <div className='automation-popover__toggle-content'>
                                <TextField
                                    label={`${localize('Amount')} (${currency_symbol})`}
                                    value={value}
                                    onChange={handleChange}
                                    onBeforeInput={onBeforeInput}
                                    placeholder={localize('Amount')}
                                    variant='fill'
                                    inputMode='decimal'
                                    customType='commaRemoval'
                                    allowDecimals
                                    decimals={decimals}
                                    regex={/[^0-9.,]/g}
                                    maxLength={getDecimalInputMaxLength(value, decimals)}
                                    message={error || undefined}
                                    status={error ? 'error' : 'neutral'}
                                    noStatusIcon
                                    disabled={!is_enabled}
                                />
                                {!is_enabled && (
                                    <div
                                        className='automation-popover__toggle-overlay'
                                        onClick={() => handleToggle(true)}
                                    />
                                )}
                            </div>
                        </div>
                    </ActionSheet.Content>
                </ActionSheet.Portal>
            </ActionSheet.Root>
        </React.Fragment>
    );
};

export default MaxTradeStakeMobile;
