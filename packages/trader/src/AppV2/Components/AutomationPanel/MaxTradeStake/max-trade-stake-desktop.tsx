import React from 'react';

import { getDecimalPlaces } from '@deriv/shared';
import { Button, Text, TextField, ToggleSwitch } from '@deriv-com/quill-ui';
import { Localize, useTranslations } from '@deriv-com/translations';

import { TradeParameterPopover, useTradeParameterPopover } from 'AppV2/Components/TradeParameters/Shared';
import { getCurrencySymbol } from 'AppV2/Utils/currency-utils';
import { createDecimalInputGuard, getDecimalInputMaxLength } from 'AppV2/Utils/decimal-input';

type TMaxTradeStakeDesktopProps = {
    currency: string;
    initialValue: number | null;
    initialStake?: number;
    description?: string;
    disabled?: boolean;
    is_market_closed?: boolean;
    onSave: (value: number | null) => void;
};

const MaxTradeStakeContent = ({ currency, initialValue, initialStake, onSave }: TMaxTradeStakeDesktopProps) => {
    const { closePopover } = useTradeParameterPopover();
    const { localize } = useTranslations();
    const [is_enabled, setIsEnabled] = React.useState(initialValue !== null);
    const [value, setValue] = React.useState(initialValue ? String(initialValue) : '');
    const [error, setError] = React.useState('');
    const decimals = getDecimalPlaces(currency);
    const onBeforeInput = createDecimalInputGuard(decimals);

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
            closePopover();
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
        closePopover();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !error) handleSave();
    };

    return (
        <div className='automation-popover__input-wrapper'>
            <div className='automation-popover__toggle-header'>
                <Text size='sm'>
                    <Localize i18n_default_text='Max. stake' />
                </Text>
                <ToggleSwitch checked={is_enabled} onChange={handleToggle} />
            </div>
            <div className='automation-popover__toggle-content'>
                <TextField
                    label={`${localize('Amount')} (${getCurrencySymbol(currency)})`}
                    value={value}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
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
                    <div className='automation-popover__toggle-overlay' onClick={() => handleToggle(true)} />
                )}
            </div>
            <Button
                fullWidth
                size='lg'
                variant='primary'
                color='black-white'
                onClick={handleSave}
                disabled={is_enabled && (!!error || !value)}
                className='automation-popover__save-button'
                label={localize('Save')}
            />
        </div>
    );
};

const MaxTradeStakeDesktop = ({
    currency,
    initialValue,
    initialStake,
    description,
    disabled,
    is_market_closed,
    onSave,
}: TMaxTradeStakeDesktopProps) => {
    const currency_symbol = getCurrencySymbol(currency);

    return (
        <TradeParameterPopover
            label={<Localize i18n_default_text='Max. stake' />}
            value={initialValue ? `${currency_symbol}${initialValue}` : '-'}
            popover_classname='automation-popover'
            disabled={is_market_closed}
            is_locked={disabled}
            description={
                <Text size='sm'>
                    {description || (
                        <Localize i18n_default_text='Maximum stake per individual trade. Leave empty for no limit.' />
                    )}
                </Text>
            }
        >
            <MaxTradeStakeContent
                currency={currency}
                initialValue={initialValue}
                initialStake={initialStake}
                onSave={onSave}
            />
        </TradeParameterPopover>
    );
};

export default MaxTradeStakeDesktop;
