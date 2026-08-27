import React from 'react';

import {
    CONTRACT_TYPES,
    formatMoney,
    getCurrencyDisplayCode,
    getDecimalPlaces,
    isAccumulatorContract,
    isValidToCancel,
} from '@deriv/shared';
import { observer } from '@deriv/stores';
import { ActionSheet, Text, TextField, ToggleSwitch } from '@deriv-com/quill-ui';
import { Localize, useTranslations } from '@deriv-com/translations';

import useContractDetails from 'AppV2/Hooks/useContractDetails';
import { getProfit } from 'AppV2/Utils/positions-utils';

import DealCancellationRemainingTime from '../DealCancellationRemainingTime/deal-cancellation-remaining-time';
import RiskManagementInfoModal from '../RiskManagementInfoModal';
import TotalProfitLoss from '../TotalProfitLoss';

type RiskManagementItemProps = {
    label: React.ReactNode;
    modal_body_content: React.ReactNode;
    is_deal_cancellation?: boolean;
    value?: number | null;
    type?: 'take_profit' | 'stop_loss';
};

const RiskManagementItem = observer(
    ({ label, modal_body_content, is_deal_cancellation = false, value, type }: RiskManagementItemProps) => {
        const [isToggleOn, setIsToggleOn] = React.useState(Boolean(value));
        const [isSheetOpen, setIsSheetOpen] = React.useState(false);
        const [isEnabled, setIsEnabled] = React.useState(false);
        const [stepperValue, setStepperValue] = React.useState<number | string>();
        const [showError, setShowError] = React.useState(false);
        const { contract_info, contract } = useContractDetails();
        const { contract_type, currency, validation_params } = contract_info;
        const { validation_errors, updateLimitOrder, clearContractUpdateConfigValues } = contract;
        const is_valid_to_cancel = isValidToCancel(contract_info);
        const is_accumulator = isAccumulatorContract(contract_type);
        const total_profit = getProfit(contract_info);
        const { localize } = useTranslations();

        React.useEffect(() => {
            if (value) {
                setStepperValue(value);
                setIsToggleOn(Boolean(value));
            }
            return () => clearContractUpdateConfigValues();
        }, [clearContractUpdateConfigValues, value]);

        const isDealCancellation = is_valid_to_cancel;
        const finalValue = Math.abs(value as number);

        const errorKey = `contract_update_${type}` as 'contract_update_stop_loss' | 'contract_update_take_profit';
        const validation_error_message = validation_errors[errorKey]?.[0] ?? '';

        const messageForMultiplier = is_valid_to_cancel ? (
            <Localize i18n_default_text='Take profit and/or stop loss are not available while deal cancellation is active.' />
        ) : null;

        const info_message = {
            [CONTRACT_TYPES.ACCUMULATOR]: (
                <Localize i18n_default_text='Take profit can’t be adjusted for ongoing accumulator contracts.' />
            ),
            [CONTRACT_TYPES.MULTIPLIER.UP]: messageForMultiplier,
            [CONTRACT_TYPES.MULTIPLIER.DOWN]: messageForMultiplier,
        };

        const onChange = (
            e: React.ChangeEvent<HTMLInputElement> | { target: { name: string; value: number | string | boolean } }
        ) => {
            const { value } = e.target;
            setStepperValue(value as number);
            setShowError(true);
            contract.onChange?.({
                name: `contract_update_${type}`,
                value,
            });
        };

        const handleToggleSwitch = (value: boolean) => {
            clearContractUpdateConfigValues();
            if (value) {
                setIsSheetOpen(true);
                setStepperValue('');
                setIsEnabled(true);
                setShowError(false);
            } else {
                contract.onChange?.({
                    name: `has_contract_update_${type}`,
                    value,
                });
                updateLimitOrder();
                setIsToggleOn(!isToggleOn);
            }
        };

        const min_value = type && (validation_params?.[type]?.min ?? 0);
        const max_value = type && (validation_params?.[type]?.max ?? 0);

        const getErrorMessage = () => {
            const field_label = type === 'take_profit' ? localize('take profit') : localize('stop loss');
            if (!stepperValue) {
                return localize('Please enter a {{field_label}} amount.', { field_label });
            }
            if (min_value && +stepperValue < +min_value) {
                return localize("Please enter a {{field_label}} amount that's at least {{min_value}}.", {
                    field_label,
                    min_value,
                });
            }
            if (max_value && +stepperValue > +max_value) {
                return localize('Maximum {{field_label}} allowed is {{max_value}}.', {
                    field_label,
                    max_value,
                });
            }
            return validation_error_message;
        };

        const error_message = showError ? getErrorMessage() : '';

        // A total profit/loss of exactly 0 is a real figure, not a missing one. The live value ticks
        // through zero, and dropping the row on that tick made it blink in and out of the sheet on
        // mobile. Only an absent or non-numeric figure hides the row — e.g. a multiplier contract
        // whose bid price has not arrived yet, where the profit computes to NaN.
        const has_total_profit =
            total_profit !== '' &&
            total_profit !== null &&
            total_profit !== undefined &&
            Number.isFinite(Number(total_profit));

        // Header save stays disabled until the drafted amount differs from the committed value
        // (and while it is empty). Existing validation still runs on save via `onSave`.
        const is_save_disabled =
            stepperValue === '' || stepperValue === undefined || Math.abs(Number(stepperValue)) === finalValue;

        const onSave = () => {
            setShowError(true);
            const current_error_message = getErrorMessage();
            if (current_error_message) {
                contract.onChange?.({
                    name: errorKey,
                    value: current_error_message,
                });
                return;
            }
            if (isEnabled) {
                contract.onChange?.({
                    name: `has_contract_update_${type}`,
                    value: true,
                });
                setIsEnabled(false);
            }
            updateLimitOrder();
            setIsSheetOpen(false);
        };

        return (
            <div className='risk-management-item__container'>
                <div className='risk-management-item'>
                    <span className='risk-management-item__title'>
                        <Text size='sm'>{label}</Text>
                        <RiskManagementInfoModal
                            header_content={label}
                            body_content={modal_body_content}
                            info_message={info_message[contract_type as keyof typeof info_message] || ''}
                        />
                    </span>
                    {!is_deal_cancellation &&
                        (is_accumulator && currency ? (
                            <Text size='sm'>
                                {formatMoney(currency, finalValue, true)} {currency}
                            </Text>
                        ) : (
                            <ToggleSwitch
                                disabled={isDealCancellation}
                                checked={isToggleOn}
                                onChange={handleToggleSwitch}
                            />
                        ))}
                    {is_valid_to_cancel && is_deal_cancellation && <DealCancellationRemainingTime />}
                </div>
                {!is_accumulator && isToggleOn && currency && (
                    <TextField
                        variant='fill'
                        inputSize='md'
                        disabled={isSheetOpen}
                        textAlignment='center'
                        value={`${formatMoney(
                            currency,
                            type == 'stop_loss' ? -finalValue : finalValue,
                            true
                        )} ${currency}`}
                        onClick={() => {
                            clearContractUpdateConfigValues();
                            setStepperValue(finalValue);
                            setIsSheetOpen(true);
                            setShowError(false);
                        }}
                        onFocus={() => setIsSheetOpen(true)}
                    />
                )}
                <ActionSheet.Root
                    expandable={false}
                    isOpen={isSheetOpen}
                    position='left'
                    onClose={() => {
                        setIsEnabled(false);
                        setIsSheetOpen(false);
                        setShowError(false);
                    }}
                >
                    <ActionSheet.Portal showHandlebar={false} shouldDetectSwipingOnContainer shouldCloseOnDrag>
                        <ActionSheet.Header
                            title={label}
                            closeAction={{ ariaLabel: localize('Close') }}
                            saveAction={{ onAction: onSave, ariaLabel: localize('Save') }}
                            isSaveActionDisabled={is_save_disabled}
                            shouldCloseOnSaveActionClick={false}
                        />
                        <ActionSheet.Content className='risk-management-item__action-sheet-content'>
                            {isSheetOpen && (
                                <TextField
                                    allowDecimals
                                    allowSign={false}
                                    className='text-field--custom'
                                    customType='commaRemoval'
                                    decimals={getDecimalPlaces(currency)}
                                    label={localize('Amount ({{currency}})', {
                                        currency: getCurrencyDisplayCode(currency),
                                    })}
                                    message={error_message}
                                    name={type}
                                    noStatusIcon
                                    onChange={onChange}
                                    placeholder={localize('Amount')}
                                    regex={/[^0-9.,]/g}
                                    status={error_message ? 'error' : 'neutral'}
                                    textAlignment='left'
                                    inputMode='decimal'
                                    value={stepperValue}
                                    variant='fill'
                                />
                            )}
                            {has_total_profit && (
                                <TotalProfitLoss
                                    currency={getCurrencyDisplayCode(currency)}
                                    is_bold={false}
                                    totalProfitLoss={total_profit}
                                />
                            )}
                        </ActionSheet.Content>
                    </ActionSheet.Portal>
                </ActionSheet.Root>
            </div>
        );
    }
);

export default RiskManagementItem;
