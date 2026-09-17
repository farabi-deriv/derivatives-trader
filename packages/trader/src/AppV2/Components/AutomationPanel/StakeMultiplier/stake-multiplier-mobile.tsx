import React from 'react';

import { ActionSheet, TextField } from '@deriv-com/quill-ui';
import { Localize, useTranslations } from '@deriv-com/translations';

import { ActionSheetHeaderTitle } from 'AppV2/Components/ActionSheetHeaderTooltip';
import { ValueChips } from 'AppV2/Components/InputPopover';
import { AutomationLockOverlay } from 'AppV2/Components/TradeParameters/Shared';
import { createDecimalInputGuard, getDecimalInputMaxLength } from 'AppV2/Utils/decimal-input';

import {
    DEFAULT_MULTIPLIER_BOUNDS,
    getStakeMultiplierError,
    getStakeMultiplierPresets,
    getStakeMultiplierRangeText,
    KNOWN_PARAM_KEYS,
    MULTIPLIER_DECIMALS,
    MULTIPLIER_PRESETS,
    TStakeMultiplierBounds,
    TStakeMultiplierParamKey,
} from '../automation-config';

type TStakeMultiplierMobileProps = {
    /** Which strategy parameter this editor edits — drives the bounds, hint and copy. */
    param_key: TStakeMultiplierParamKey;
    /** Bounds from the strategy schema; defaults to the client fallbacks. */
    bounds?: TStakeMultiplierBounds;
    selectedValue: number;
    description?: string;
    disabled?: boolean;
    is_market_closed?: boolean;
    onSelect: (value: number) => void;
};

const StakeMultiplierMobile = ({
    param_key,
    bounds = DEFAULT_MULTIPLIER_BOUNDS,
    selectedValue,
    description,
    disabled,
    is_market_closed,
    onSelect,
}: TStakeMultiplierMobileProps) => {
    const is_multiplier = param_key === KNOWN_PARAM_KEYS.MULTIPLIER;
    const { localize: localizeForLanguage, instance } = useTranslations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const localize = React.useCallback(localizeForLanguage, [instance.language]);
    const [is_open, setIsOpen] = React.useState(false);
    const [inputValue, setInputValue] = React.useState(String(selectedValue));
    const [error, setError] = React.useState('');
    const onBeforeInput = createDecimalInputGuard(MULTIPLIER_DECIMALS);
    const label = is_multiplier ? localize('Stake multiplier') : localize('Stake increment');

    const range_message = React.useMemo(
        () =>
            is_multiplier ? getStakeMultiplierRangeText(bounds, localize) : <Localize i18n_default_text='Minimum 1' />,
        [is_multiplier, bounds, localize]
    );

    // Increment keeps full presets — `unit` has no schema bounds.
    const preset_values = React.useMemo(
        () => (is_multiplier ? getStakeMultiplierPresets(bounds) : MULTIPLIER_PRESETS),
        [is_multiplier, bounds]
    );

    const onClose = React.useCallback(() => {
        setIsOpen(false);
        setInputValue(String(selectedValue));
        setError('');
    }, [selectedValue]);

    // Re-init the draft from the committed value whenever the sheet opens (dismiss = discard).
    React.useEffect(() => {
        if (is_open) {
            setInputValue(String(selectedValue));
            setError('');
        }
    }, [is_open, selectedValue]);

    // Presets fill the input rather than committing, matching the mobile Stake sheet — Save commits.
    const handlePresetSelect = React.useCallback((value: number) => {
        setInputValue(String(value));
        setError('');
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputValue(value);
        setError(value ? getStakeMultiplierError(value, param_key, localize, bounds) : '');
    };

    const handleInputSave = () => {
        const validation_error = getStakeMultiplierError(inputValue, param_key, localize, bounds);
        if (validation_error) {
            setError(validation_error);
            return;
        }
        onSelect(Number(inputValue));
        setIsOpen(false);
    };

    const is_save_disabled = !inputValue || !!error || inputValue === String(selectedValue);

    return (
        <React.Fragment>
            <div className='trade-params__field-locked'>
                <TextField
                    variant='fill'
                    readOnly
                    disabled={disabled || is_market_closed}
                    label={
                        is_multiplier ? (
                            <Localize i18n_default_text='Stake multiplier' />
                        ) : (
                            <Localize i18n_default_text='Stake increment' />
                        )
                    }
                    value={is_multiplier ? `x${selectedValue}` : `${selectedValue} ${localize('unit')}`}
                    noStatusIcon
                    className='trade-params__option'
                    onClick={() => setIsOpen(true)}
                />
                {disabled && <AutomationLockOverlay />}
            </div>
            <ActionSheet.Root isOpen={is_open} onClose={onClose} position='left' expandable={false}>
                <ActionSheet.Portal showHandlebar={false} shouldDetectSwipingOnContainer shouldCloseOnDrag>
                    <ActionSheet.Header
                        title={<ActionSheetHeaderTitle title={label} description={description} label={label} />}
                        closeAction={{ ariaLabel: localize('Close') }}
                        saveAction={{ onAction: handleInputSave, ariaLabel: localize('Save') }}
                        isSaveActionDisabled={is_save_disabled}
                        shouldCloseOnSaveActionClick={false}
                    />
                    <ActionSheet.Content>
                        <div className='automation-popover__input-wrapper'>
                            <TextField
                                label={is_multiplier ? localize('Stake multiplier') : localize('Stake increment')}
                                value={inputValue}
                                onChange={handleInputChange}
                                onBeforeInput={onBeforeInput}
                                variant='fill'
                                inputMode='decimal'
                                customType='commaRemoval'
                                allowDecimals
                                decimals={MULTIPLIER_DECIMALS}
                                regex={/[^0-9.,]/g}
                                maxLength={getDecimalInputMaxLength(inputValue, MULTIPLIER_DECIMALS)}
                                message={error || range_message}
                                status={error ? 'error' : 'neutral'}
                                textAlignment='left'
                                noStatusIcon
                            />
                            <ValueChips
                                className='value-chips--pills'
                                values={preset_values}
                                selectedValue={Number(inputValue)}
                                onSelect={handlePresetSelect}
                            />
                        </div>
                    </ActionSheet.Content>
                </ActionSheet.Portal>
            </ActionSheet.Root>
        </React.Fragment>
    );
};

export default StakeMultiplierMobile;
