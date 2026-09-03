import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';

import { useDebounce } from '@deriv/api';
import { Button, TextField, TextFieldAddon } from '@deriv-com/quill-ui';
import { Localize, useTranslations } from '@deriv-com/translations';

import { useProposal } from 'AppV2/Hooks/useProposal';
import { getDisplayedContractTypes } from 'AppV2/Utils/trade-types-utils';
import { useTraderStore } from 'Stores/useTraderStores';

import { getBarrierErrorMessage } from './barrier-error-utils';

interface BarrierContentDesktopProps {
    barrierType: string;
    onClose?: () => void;
}

const BarrierContentDesktop: React.FC<BarrierContentDesktopProps> = observer(({ barrierType, onClose }) => {
    const trade_store = useTraderStore();
    const { barrier_1, onChange, tick_data, symbol, contract_type, trade_type_tab, trade_types, barrier_choices } =
        trade_store;
    const { localize } = useTranslations();

    // Barrier support (relative offset vs absolute price), derived from the sign of the API's
    // per-expiry-type default barrier — shared with the mobile barrier input.
    const barrierSupport = trade_store.getSymbolBarrierSupport(symbol);

    // Seed from the store's API default barrier_1 when the field is empty; the hardcoded
    // fallback constants only apply when the API itself provided no default.
    const getInitialFullValue = () =>
        barrier_1 && barrier_1.trim() !== '' ? barrier_1 : trade_store.getDefaultBarrierValue(barrierSupport);
    const [inputValue, setInputValue] = useState(getInitialFullValue().replace(/^[+-]/, ''));

    const { pip_size, quote } = tick_data ?? {};

    const debouncedInputValue = useDebounce(inputValue, 300);

    const [localValidationError, setLocalValidationError] = useState<string>('');
    const [proposalRequestValues, setProposalRequestValues] = useState({
        barrier_1: getInitialFullValue(),
    });

    // The store's barrier_1 can change while the popover stays mounted (e.g. the expiry-transition
    // reseed reaction in trade-store when duration/expiry changes elsewhere on the page). Resync the
    // local input so Save can't write a stale value over the reseeded barrier — mirrors barrier-input.tsx.
    React.useEffect(() => {
        if (!barrier_1) return;
        const newValue = barrier_1.replace(/^[+-]/, '');
        setInputValue(prev => (prev !== newValue ? newValue : prev));
    }, [barrier_1]);

    const contract_types = React.useMemo(
        () => getDisplayedContractTypes(trade_types, contract_type, trade_type_tab),
        [trade_types, contract_type, trade_type_tab]
    );

    const { error: proposalError, isFetching: isLoadingProposal } = useProposal({
        trade_store,
        proposal_request_values: proposalRequestValues,
        contract_type: contract_types[0],
        is_enabled: proposalRequestValues.barrier_1 !== '' && localValidationError === '',
    });

    const apiValidationError = React.useMemo(() => {
        if (
            proposalError &&
            (proposalError.details?.field === 'barrier' || proposalError.details?.field === 'barrier2')
        ) {
            return getBarrierErrorMessage(proposalError, barrier_choices, barrierSupport);
        }
        return '';
    }, [proposalError, barrier_choices, barrierSupport]);

    const validateBarrierValue = React.useCallback(
        (value: string): string => {
            if (!value || value.trim() === '') {
                return localize('Barrier is a required field.');
            }
            if (value.endsWith('.') || /\.\s*$/.test(value)) {
                return localize('Please enter a complete number.');
            }
            const numericValue = parseFloat(value);
            if (isNaN(numericValue)) {
                return localize('Please enter a valid number.');
            }
            if (numericValue === 0) {
                return localize('Barrier cannot be zero.');
            }
            return '';
        },
        [localize]
    );

    React.useEffect(() => {
        if (debouncedInputValue === undefined) return;

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

        setLocalValidationError(prev => (prev !== error ? error : prev));

        if (!error) {
            let newValue = debouncedInputValue;
            if (barrierType === 'above_spot') {
                newValue = `+${debouncedInputValue}`;
            } else if (barrierType === 'below_spot') {
                newValue = `-${debouncedInputValue}`;
            }
            setProposalRequestValues(prev => (prev.barrier_1 !== newValue ? { barrier_1: newValue } : prev));
        }
    }, [debouncedInputValue, barrierType, localize]);

    // The API's range/format message is the most actionable correction, so it takes precedence
    // over a generic client-side message when both apply.
    const show_validation_error = localValidationError !== '' || apiValidationError !== '';
    const displayError = apiValidationError || localValidationError;

    const handleSave = () => {
        if (show_validation_error || isLoadingProposal) return;

        const finalError = validateBarrierValue(inputValue);
        if (finalError !== '') {
            setLocalValidationError(finalError);
            return;
        }

        let newValue = inputValue;
        if (barrierType === 'above_spot') {
            newValue = `+${inputValue}`;
        } else if (barrierType === 'below_spot') {
            newValue = `-${inputValue}`;
        }
        onChange({ target: { name: 'barrier_1', value: newValue } });
        onClose?.();
    };

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    return (
        <div className='barrier-content'>
            <div className='barrier-content__spot'>
                <span className='barrier-content__spot-label'>
                    <Localize i18n_default_text='Current spot' />
                </span>
                <span className='barrier-content__spot-value'>{quote ?? '0.0000'}</span>
            </div>

            <div className='barrier-content__input'>
                {barrierType === 'fixed_barrier' ? (
                    <TextField
                        customType='commaRemoval'
                        name='barrier_1'
                        noStatusIcon
                        value={inputValue}
                        allowDecimals
                        decimals={pip_size}
                        allowSign={false}
                        inputMode='decimal'
                        regex={/[^0-9.,]/g}
                        textAlignment='center'
                        onChange={handleOnChange}
                        placeholder={quote?.toString() || '0.0000'}
                        variant='fill'
                        status={show_validation_error ? 'error' : 'neutral'}
                        message={show_validation_error ? displayError : ''}
                    />
                ) : (
                    <TextFieldAddon
                        fillAddonBorderColor='var(--semantic-color-slate-solid-surface-frame-mid)'
                        customType='commaRemoval'
                        name='barrier_1'
                        noStatusIcon
                        addonLabel={barrierType === 'above_spot' ? '+' : '-'}
                        decimals={pip_size}
                        value={inputValue}
                        allowDecimals
                        inputMode='decimal'
                        allowSign={false}
                        onChange={handleOnChange}
                        placeholder={localize('Distance to spot')}
                        regex={/[^0-9.,]/g}
                        variant='fill'
                        status={show_validation_error ? 'error' : 'neutral'}
                        message={show_validation_error ? displayError : ''}
                    />
                )}
                {!show_validation_error && <div className='barrier-content__error-area' />}
            </div>

            <div className='barrier-content__actions'>
                <Button
                    fullWidth
                    size='lg'
                    variant='primary'
                    color='black-white'
                    onClick={handleSave}
                    disabled={show_validation_error || isLoadingProposal}
                    className='barrier-content__save-button'
                    label={localize('Save')}
                />
            </div>
        </div>
    );
});

export default BarrierContentDesktop;
