import React from 'react';

import { Button, Text, TextField } from '@deriv-com/quill-ui';
import { Localize, useTranslations } from '@deriv-com/translations';

import { TabSelector } from 'AppV2/Components/InputPopover';
import {
    ChipsWithInputToggle,
    TradeParameterPopover,
    useTradeParameterPopover,
} from 'AppV2/Components/TradeParameters/Shared';
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

type TStakeMultiplierDesktopProps = {
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

const StakeMultiplierContent = ({
    param_key,
    bounds = DEFAULT_MULTIPLIER_BOUNDS,
    selectedValue,
    onSelect,
}: TStakeMultiplierDesktopProps) => {
    const is_multiplier = param_key === KNOWN_PARAM_KEYS.MULTIPLIER;
    const { closePopover } = useTradeParameterPopover();
    const { localize: localizeForLanguage, instance } = useTranslations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const localize = React.useCallback(localizeForLanguage, [instance.language]);
    const [activeTab, setActiveTab] = React.useState<'chips' | 'input'>('chips');
    const [inputValue, setInputValue] = React.useState(String(selectedValue));
    const [error, setError] = React.useState('');
    const onBeforeInput = createDecimalInputGuard(MULTIPLIER_DECIMALS);

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

    const handleChipSelectAndClose = React.useCallback(
        (value: number) => {
            onSelect(value);
            closePopover();
        },
        [onSelect, closePopover]
    );

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
        closePopover();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !error) handleInputSave();
    };

    const inputComponent = (
        <div className='automation-popover__input-wrapper'>
            <TextField
                label={is_multiplier ? localize('Stake multiplier') : localize('Stake increment')}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
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
                noStatusIcon
                autoFocus
            />
            <Button
                fullWidth
                size='lg'
                variant='primary'
                color='black-white'
                onClick={handleInputSave}
                disabled={!!error || !inputValue}
                className='automation-popover__save-button'
                label={localize('Save')}
            />
        </div>
    );

    return (
        <React.Fragment>
            <TabSelector activeTab={activeTab} onTabChange={setActiveTab} />
            <ChipsWithInputToggle
                activeTab={activeTab}
                chipValues={preset_values}
                selectedValue={selectedValue}
                onSelect={handleChipSelectAndClose}
                inputComponent={inputComponent}
            />
        </React.Fragment>
    );
};

const StakeMultiplierDesktop = ({
    param_key,
    bounds,
    selectedValue,
    description,
    disabled,
    is_market_closed,
    onSelect,
}: TStakeMultiplierDesktopProps) => {
    const { localize: localizeForLanguage, instance } = useTranslations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const localize = React.useCallback(localizeForLanguage, [instance.language]);
    const is_multiplier = param_key === KNOWN_PARAM_KEYS.MULTIPLIER;

    const fallback_description = is_multiplier ? (
        <Localize i18n_default_text='Multiplier applied to the stake after each losing trade.' />
    ) : (
        <Localize i18n_default_text='Amount added to the stake after each losing trade.' />
    );

    return (
        <TradeParameterPopover
            label={
                is_multiplier ? (
                    <Localize i18n_default_text='Stake multiplier' />
                ) : (
                    <Localize i18n_default_text='Stake increment' />
                )
            }
            value={is_multiplier ? `x${selectedValue}` : `${selectedValue} ${localize('unit')}`}
            popover_classname='automation-popover'
            popoverWidth={376}
            disabled={is_market_closed}
            is_locked={disabled}
            description={<Text size='sm'>{description || fallback_description}</Text>}
        >
            <StakeMultiplierContent
                param_key={param_key}
                bounds={bounds}
                selectedValue={selectedValue}
                onSelect={onSelect}
            />
        </TradeParameterPopover>
    );
};

export default StakeMultiplierDesktop;
