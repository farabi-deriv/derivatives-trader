import React from 'react';
import { observer } from 'mobx-react-lite';

import { useDebounce } from '@deriv/api';
import { isTurbosContract } from '@deriv/shared';
import { ActionSheet, Text, TextField, TextFieldAddon } from '@deriv-com/quill-ui';
import { Localize, useTranslations } from '@deriv-com/translations';

import { ActionSheetHeaderTitle } from 'AppV2/Components/ActionSheetHeaderTooltip';
import { HorizontalTabSelector } from 'AppV2/Components/InputPopover';
import { useProposal } from 'AppV2/Hooks/useProposal';
import { getDisplayedContractTypes } from 'AppV2/Utils/trade-types-utils';
import { useTraderStore } from 'Stores/useTraderStores';

import BarrierDescription from './barrier-description';
import { getBarrierErrorMessage } from './barrier-error-utils';

type TSign = '+' | '-';

const BarrierInput = observer(({ onClose, is_open }: { onClose: (val: boolean) => void; is_open?: boolean }) => {
    const trade_store = useTraderStore();
    const { barrier_1, onChange, tick_data, symbol, contract_type, trade_type_tab, trade_types, barrier_choices } =
        trade_store;

    const { localize } = useTranslations();

    const sign_tab_items = React.useMemo(
        () => [
            { value: '+', label: localize('Above spot') },
            { value: '-', label: localize('Below spot') },
        ],
        [localize]
    );

    // Barrier support (relative offset vs absolute price), derived from the sign of the API's
    // per-expiry-type default barrier — shared with the desktop barrier input.
    const barrierSupport = trade_store.getSymbolBarrierSupport(symbol);
    const isRelative = barrierSupport === 'relative';

    // Helper function to calculate initial state from barrier_1 value
    const calculateInitialState = React.useCallback(() => {
        const source_value =
            barrier_1 && barrier_1.trim() !== '' ? barrier_1 : trade_store.getDefaultBarrierValue(barrierSupport);

        if (source_value.startsWith('-')) {
            return { sign: '-' as TSign, inputValue: source_value.slice(1), barrierValue: source_value };
        }
        if (source_value.startsWith('+')) {
            return { sign: '+' as TSign, inputValue: source_value.slice(1), barrierValue: source_value };
        }
        return { sign: '+' as TSign, inputValue: source_value, barrierValue: source_value };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [barrier_1, barrierSupport]);

    // Calculate initial state immediately to prevent empty value validation
    const initialState = calculateInitialState();

    // Local state for editing - initialize with calculated values
    const [sign, setSign] = React.useState<TSign>(initialState.sign);
    const [inputValue, setInputValue] = React.useState(initialState.inputValue);
    const [isInitialized, setIsInitialized] = React.useState(false);

    // Local state for proposal request values (similar to Stake component)
    const [proposalRequestValues, setProposalRequestValues] = React.useState({
        barrier_1: initialState.barrierValue,
    });

    // Debounce the input value for real-time validation (300ms for responsive UX)
    const debouncedInputValue = useDebounce(inputValue, 300);

    const { pip_size } = tick_data ?? {};
    const barrier_ref = React.useRef<HTMLInputElement | null>(null);

    // Local validation error state for real-time feedback - must be declared before useProposal
    const [localValidationError, setLocalValidationError] = React.useState<string>('');

    // Get contract_types for proposal validation - only compute when modal is open
    const contract_types = React.useMemo(
        () => (is_open ? getDisplayedContractTypes(trade_types, contract_type, trade_type_tab) : []),
        [is_open, trade_types, contract_type, trade_type_tab]
    );

    // Use proposal hook for real-time API validation without updating store
    // Only enable when modal is open, value is not empty, and client-side validation passes
    const { error: proposalError, isFetching: isLoadingProposal } = useProposal({
        trade_store,
        proposal_request_values: proposalRequestValues,
        contract_type: contract_types[0],
        is_enabled: is_open && proposalRequestValues.barrier_1 !== '' && localValidationError === '',
    });

    // Initialize state when modal opens - fixed to avoid circular dependency
    React.useEffect(() => {
        // Only update store if barrier_1 is empty and we need to set a default
        if (!barrier_1 || barrier_1.trim() === '') {
            onChange({
                target: {
                    name: 'barrier_1',
                    value: trade_store.getDefaultBarrierValue(barrierSupport),
                },
            });
        }

        // Mark as initialized to enable validation
        setIsInitialized(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [barrier_1, barrierSupport]); // Exclude onChange as it's from parent

    // Update local state when barrier_1 changes from external sources (e.g., symbol change)
    React.useEffect(() => {
        if (!isInitialized || !barrier_1) {
            return;
        }

        // Inline state calculation to avoid dependency issues
        let newSign: TSign = '+';
        let newInputValue = '';

        if (barrier_1.startsWith('+')) {
            newSign = '+';
            newInputValue = barrier_1.slice(1);
        } else if (barrier_1.startsWith('-')) {
            newSign = '-';
            newInputValue = barrier_1.slice(1);
        } else {
            newInputValue = barrier_1;
        }

        // Only update if values actually changed
        setSign(prevSign => (prevSign !== newSign ? newSign : prevSign));
        setInputValue(prevValue => (prevValue !== newInputValue ? newInputValue : prevValue));
    }, [barrier_1, isInitialized]);

    // Track API validation errors from useProposal hook
    const apiValidationError = React.useMemo(() => {
        if (
            proposalError &&
            (proposalError.details?.field === 'barrier' || proposalError.details?.field === 'barrier2')
        ) {
            return getBarrierErrorMessage(proposalError, barrier_choices, barrierSupport);
        }
        return '';
    }, [proposalError, barrier_choices, barrierSupport]);

    // Client-side validation function that replicates store validation rules
    const validateBarrierValue = React.useCallback(
        (value: string): string => {
            // Skip validation if component is not initialized to prevent flash of error
            if (!isInitialized) {
                return '';
            }

            if (!value || value.trim() === '') {
                return localize('Barrier is a required field.');
            }

            // Check for incomplete decimal values like "0." or trailing decimals
            if (value.endsWith('.') || /\.\s*$/.test(value)) {
                return localize('Please enter a complete number.');
            }

            const numericValue = parseFloat(value);
            if (isNaN(numericValue)) {
                return localize('Please enter a valid number.');
            }

            // Check for zero values on ALL barrier types (both relative and fixed)
            if (numericValue === 0) {
                return localize('Barrier cannot be zero.');
            }

            return ''; // No error
        },
        [localize, isInitialized]
    );

    // Effect to run client-side validation and update proposal request values on debounced input changes
    React.useEffect(() => {
        // Only run validation after component is initialized and we have a meaningful value
        if (!isInitialized || debouncedInputValue === undefined) {
            return;
        }

        // Inline validation to avoid dependency issues
        let error = '';

        if (!debouncedInputValue || debouncedInputValue.trim() === '') {
            error = localize('Barrier is a required field.');
        } else if (debouncedInputValue.endsWith('.') || /\.\s*$/.test(debouncedInputValue)) {
            error = localize('Please enter a complete number.');
        } else {
            const numericValue = parseFloat(debouncedInputValue);
            if (isNaN(numericValue)) {
                error = localize('Please enter a valid number.');
            } else if (numericValue === 0) {
                error = localize('Barrier cannot be zero.');
            }
        }

        // Only update state if the error actually changed
        setLocalValidationError(prevError => {
            if (prevError !== error) {
                return error;
            }
            return prevError;
        });

        // Update proposal request values for API validation (without updating store)
        if (!error) {
            const newValue = isRelative ? `${sign}${debouncedInputValue}` : debouncedInputValue;

            // Only update if the value actually changed
            setProposalRequestValues(prev => {
                if (prev.barrier_1 !== newValue) {
                    return { barrier_1: newValue };
                }
                return prev;
            });
        }
    }, [debouncedInputValue, sign, isRelative, isInitialized]);

    // Show validation errors in real-time (client-side + API errors). The API's range/format
    // message is the most actionable correction, so it takes precedence when both apply.
    const show_validation_error = localValidationError !== '' || apiValidationError !== '';
    const displayError = apiValidationError || localValidationError;

    // Mirror the value handleSave would commit so the header save only enables on an actual change.
    const drafted_barrier = isRelative ? `${sign}${inputValue}` : inputValue;

    // One window covering the whole validation of the drafted barrier: the debounce gap before the
    // request goes out, plus the request itself. `isLoadingProposal` alone is false during that gap, so
    // the check flickered on and off while the draft was still settling. It is also what `handleSave`
    // enforces below, so the check is enabled only when tapping it would really commit.
    const is_validating = drafted_barrier !== proposalRequestValues.barrier_1 || isLoadingProposal;
    const is_save_disabled = show_validation_error || is_validating || drafted_barrier === barrier_1;

    const handleSignToggle = (value: string) => {
        setSign(value as TSign);
    };

    const handleOnChange = (e: { target: { name: string; value: string } }) => {
        setInputValue(e.target.value);
    };

    const handleSave = () => {
        // Prevent save while a validation error shows or the draft has not been validated yet
        if (show_validation_error || is_validating) {
            return;
        }

        // Run final validation before saving
        const finalError = validateBarrierValue(inputValue);

        if (finalError === '') {
            // Update the trade store (this is the ONLY place where we update the store)
            onChange({ target: { name: 'barrier_1', value: drafted_barrier } });
            onClose(true);
        } else {
            // Update local error state if validation fails
            setLocalValidationError(finalError);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const isSaveDisabled = show_validation_error || is_validating;
            if (!isSaveDisabled) {
                handleSave();
            }
        }
    };

    return (
        <>
            <ActionSheet.Header
                title={
                    <ActionSheetHeaderTitle
                        title={<Localize i18n_default_text='Barrier' />}
                        description={
                            <BarrierDescription
                                barrierSupport={barrierSupport}
                                is_turbos={isTurbosContract(contract_type)}
                            />
                        }
                        label={localize('Barrier')}
                    />
                }
                closeAction={{ ariaLabel: localize('Close') }}
                saveAction={{ onAction: handleSave, ariaLabel: localize('Save') }}
                isSaveActionDisabled={is_save_disabled}
                shouldCloseOnSaveActionClick={false}
            />
            <ActionSheet.Content>
                <div className='barrier-params'>
                    {isRelative && (
                        <HorizontalTabSelector
                            className='barrier-params__sign'
                            items={sign_tab_items}
                            selectedValue={sign}
                            onSelect={handleSignToggle}
                        />
                    )}

                    <div>
                        {isRelative ? (
                            <TextFieldAddon
                                fillAddonBorderColor='var(--semantic-color-slate-solid-surface-frame-mid)'
                                customType='commaRemoval'
                                name='barrier_1'
                                noStatusIcon
                                addonLabel={sign}
                                decimals={pip_size}
                                value={inputValue}
                                allowDecimals
                                inputMode='decimal'
                                allowSign={false}
                                status={show_validation_error ? 'error' : 'neutral'}
                                onChange={handleOnChange}
                                onKeyDown={handleKeyDown}
                                placeholder={localize('Distance to spot')}
                                regex={/[^0-9.,]/g}
                                variant='fill'
                                message={show_validation_error ? displayError : ''}
                                ref={barrier_ref}
                            />
                        ) : (
                            <TextField
                                customType='commaRemoval'
                                name='barrier_1'
                                noStatusIcon
                                status={show_validation_error ? 'error' : 'neutral'}
                                value={inputValue}
                                allowDecimals
                                decimals={pip_size}
                                allowSign={false}
                                inputMode='decimal'
                                regex={/[^0-9.,]/g}
                                textAlignment='center'
                                onChange={handleOnChange}
                                onKeyDown={handleKeyDown}
                                placeholder={localize('Price')}
                                variant='fill'
                                message={show_validation_error ? displayError : ''}
                                ref={barrier_ref}
                            />
                        )}
                        {!show_validation_error && <div className='barrier-params__error-area' />}
                    </div>
                    <div className='barrier-params__current-spot-wrapper'>
                        <Text size='sm'>
                            <Localize i18n_default_text='Current spot' />
                        </Text>
                        <Text size='sm'>{tick_data?.quote}</Text>
                    </div>
                </div>
            </ActionSheet.Content>
        </>
    );
});

export default BarrierInput;
