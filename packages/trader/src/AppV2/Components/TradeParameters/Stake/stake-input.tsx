import React from 'react';
import debounce from 'lodash.debounce';
import { observer } from 'mobx-react-lite';

import { TPriceProposalResponse, TSocketError } from '@deriv/api';
import { getDecimalPlaces, mapErrorMessage, trackAnalyticsEvent } from '@deriv/shared';
import { useStore } from '@deriv/stores';
import { ActionSheet, TextField } from '@deriv-com/quill-ui';
import { Localize, useTranslations } from '@deriv-com/translations';

import { ValueChips, ValueChipsSkeleton } from 'AppV2/Components/InputPopover';
import { getStakePresets } from 'AppV2/Config/trade-parameter-presets';
import useIsVirtualKeyboardOpen from 'AppV2/Hooks/useIsVirtualKeyboardOpen';
import { useProposal } from 'AppV2/Hooks/useProposal';
import { formatAmountWithSymbol, getCurrencySymbol } from 'AppV2/Utils/currency-utils';
import { createDecimalInputGuard, getDecimalInputMaxLength } from 'AppV2/Utils/decimal-input';
import { getInsufficientBalanceMessage, parseAmount } from 'AppV2/Utils/insufficient-balance-utils';
import { mapContractTypeToStakePresetKey } from 'AppV2/Utils/trade-params-preset-utils';
import { getPayoutInfo, getStakeLadderValues } from 'AppV2/Utils/trade-params-utils';
import { getDisplayedContractTypes } from 'AppV2/Utils/trade-types-utils';
import { ExpandedProposal, getProposalInfo } from 'Stores/Modules/Trading/Helpers/proposal';
import { useTraderStore } from 'Stores/useTraderStores';

import StakeDetails from './stake-details';

const DEFAULT_PRESET_VALUES = [1, 5, 10, 20, 50, 100];

type TStakeInput = {
    onClose: () => void;
    is_open?: boolean;
    /** Mobile only: open the Stop out / Stop out level explanation as a page within the stake sheet. */
    onOpenStopOut?: () => void;
    onOpenStopOutLevel?: () => void;
    /**
     * Mobile only: publish the commit handler and dirty/error gate up to the sheet host so the
     * header check (page 0 `StakeSheetHeader`) can commit and stay disabled until the value changes.
     * Not passed on desktop, where the footer Save still lives inside this component.
     */
    registerHeaderActions?: (actions: { onSave: () => void; is_save_disabled: boolean }) => void;
};
type TNewValues = {
    amount?: string | number;
    payout_per_point?: string | number;
    barrier_1?: string | number;
};
type TStakeState = {
    proposal_request_values: TNewValues;
    stake_error: string;
    fe_stake_error: string;
    max_length: number;
    details: {
        error_1: string;
        error_2: string;
        first_contract_payout: number;
        second_contract_payout: number;
        is_first_payout_exceeded: boolean;
        is_second_payout_exceeded: boolean;
        max_payout: string | number;
        max_stake: string | number;
        min_stake: string | number;
        stop_out?: string | number;
    };
};
type TStakeAction =
    | { type: 'SET_PROPOSAL_VALUES'; payload: Partial<TNewValues> }
    | { type: 'SET_STAKE_ERROR'; payload: string }
    | { type: 'SET_FE_STAKE_ERROR'; payload: string }
    | { type: 'UPDATE_DETAILS'; payload: Partial<TStakeState['details']> }
    | { type: 'SET_MAX_LENGTH'; payload: number }
    | { type: 'RESET_ERRORS' };

const reducer = (state: TStakeState, action: TStakeAction): TStakeState => {
    switch (action.type) {
        case 'SET_PROPOSAL_VALUES':
            return {
                ...state,
                proposal_request_values: {
                    ...state.proposal_request_values,
                    ...action.payload,
                },
            };
        case 'SET_STAKE_ERROR':
            return {
                ...state,
                stake_error: action.payload,
            };
        case 'SET_FE_STAKE_ERROR':
            return {
                ...state,
                fe_stake_error: action.payload,
            };
        case 'UPDATE_DETAILS':
            return {
                ...state,
                details: {
                    ...state.details,
                    ...action.payload,
                },
            };
        case 'SET_MAX_LENGTH':
            return {
                ...state,
                max_length: action.payload,
            };
        case 'RESET_ERRORS':
            return {
                ...state,
                stake_error: '',
                fe_stake_error: '',
            };
        default:
            return state;
    }
};

const createInitialState = (trade_store: ReturnType<typeof useTraderStore>, decimals: number) => {
    const { amount, contract_type, trade_type_tab, trade_types, proposal_info, validation_params, stop_out } =
        trade_store;

    const contract_types = getDisplayedContractTypes(trade_types, contract_type, trade_type_tab);
    const {
        contract_payout: first_contract_payout,
        max_payout,
        error: first_payout_error,
    } = getPayoutInfo(proposal_info[contract_types[0]]);
    const { contract_payout: second_contract_payout, error: second_payout_error } = getPayoutInfo(
        proposal_info[contract_types[1]]
    );

    const { stake } = (validation_params[contract_types[0]] || validation_params[contract_types[1]]) ?? {};
    const { max: max_stake = 0, min: min_stake = 0 } = stake ?? {};

    return {
        proposal_request_values: { amount },
        stake_error: '',
        fe_stake_error: '',
        max_length: getDecimalInputMaxLength(amount, decimals),
        details: {
            error_1: first_payout_error,
            error_2: second_payout_error,
            first_contract_payout,
            second_contract_payout,
            is_first_payout_exceeded: !!first_payout_error && first_contract_payout > Number(max_payout),
            is_second_payout_exceeded: !!second_payout_error && second_contract_payout > Number(max_payout),
            max_payout,
            max_stake,
            min_stake,
            stop_out,
        },
    };
};

const StakeInput = observer(
    ({ onClose, is_open, onOpenStopOut, onOpenStopOutLevel, registerHeaderActions }: TStakeInput) => {
        const { localize } = useTranslations();
        const trade_store = useTraderStore();
        const {
            client: { balance, currency: account_currency },
        } = useStore();
        const {
            amount,
            basis,
            contract_type,
            currency,
            symbol,
            barrier_1,
            is_accumulator,
            is_multiplier,
            is_turbos,
            is_vanilla,
            onChange,
            trade_type_tab,
            trade_types,
            stake_preset_limits,
        } = trade_store;

        const decimals = getDecimalPlaces(currency);
        const [state, dispatch] = React.useReducer(reducer, null, () => createInitialState(trade_store, decimals));
        const { proposal_request_values, stake_error, fe_stake_error, details } = state;

        const contract_types = React.useMemo(
            () => getDisplayedContractTypes(trade_types, contract_type, trade_type_tab),
            [trade_types, contract_type, trade_type_tab]
        );

        const should_show_payout_details = !is_accumulator && !is_multiplier && !is_turbos && !is_vanilla;

        // scroll the page when a virtual keyboard pops up
        const input_id = 'stake_input';
        const { is_key_board_visible: should_scroll } = useIsVirtualKeyboardOpen(input_id);

        React.useEffect(() => {
            if (should_scroll) window?.scrollTo({ top: 225, behavior: 'smooth' });
        }, [should_scroll]);

        React.useEffect(() => {
            const initial_state = createInitialState(trade_store, decimals);
            dispatch({ type: 'SET_PROPOSAL_VALUES', payload: initial_state.proposal_request_values });
            dispatch({ type: 'UPDATE_DETAILS', payload: initial_state.details });
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        // Parallel proposal without subscription
        // For Rise/Fall and all Digits we should do 2 proposal requests
        const should_send_multiple_proposals = contract_types.length > 1 && !is_multiplier;
        const has_both_errors = !!details.error_1 && !!details.error_2;
        // Need for cases with Rise/Fall and Digits, when only one response contains error and we should allow to save the value
        const should_show_stake_error =
            !should_send_multiple_proposals || (should_send_multiple_proposals && has_both_errors);

        const {
            data: response_1,
            error: error_1,
            isFetching: is_fetching_1,
        } = useProposal({
            trade_store,
            proposal_request_values,
            contract_type: contract_types[0],
            is_enabled: is_open && proposal_request_values.amount !== '',
        });
        const {
            data: response_2,
            error: error_2,
            isFetching: is_fetching_2,
        } = useProposal({
            trade_store,
            proposal_request_values,
            contract_type: contract_types[1],
            is_enabled: is_open && should_send_multiple_proposals && proposal_request_values.amount !== '',
        });

        const is_loading_proposal = is_fetching_1 || (should_send_multiple_proposals && is_fetching_2);

        const handleProposalResponse = (
            data: TPriceProposalResponse | undefined,
            queryError: TSocketError<'proposal'>['error'] | undefined,
            contractType: 'first' | 'second'
        ) => {
            const proposal = data?.proposal;

            // In case if the value is empty we are showing custom error text from FE (in onSave function)
            if (proposal_request_values.amount === '') {
                dispatch({ type: 'SET_STAKE_ERROR', payload: '' });
                return;
            }

            // Handle edge cases for Vanilla contracts
            if (
                is_vanilla &&
                queryError?.details?.barrier_choices &&
                Array.isArray(queryError.details.barrier_choices)
            ) {
                const { barrier_choices } = queryError.details;
                if (!barrier_choices?.includes(barrier_1)) {
                    const index = Math.floor(barrier_choices.length / 2);
                    dispatch({
                        type: 'SET_PROPOSAL_VALUES',
                        payload: { barrier_1: barrier_choices[index] as number },
                    });
                    return;
                }
            }

            // Handle edge cases for Turbo contracts
            if (
                is_turbos &&
                queryError?.details?.payout_per_point_choices &&
                Array.isArray(queryError.details.payout_per_point_choices) &&
                queryError?.details?.field === 'payout_per_point'
            ) {
                const { payout_per_point_choices } = queryError.details;
                const index = Math.floor(payout_per_point_choices.length / 2);
                dispatch({
                    type: 'SET_PROPOSAL_VALUES',
                    payload: { payout_per_point: payout_per_point_choices[index] as number },
                });
                return;
            }

            // Set proposal error
            const new_error = queryError ? mapErrorMessage(queryError) : '';
            const is_error_field_match =
                ['amount', 'stake'].includes(queryError?.details?.field ?? '') || !queryError?.details?.field;
            dispatch({ type: 'SET_STAKE_ERROR', payload: is_error_field_match ? new_error : '' });

            // Handle old contracts with payout (Rise/Fall, Higher/Lower, Touch/No Touch, Digits)
            if (should_show_payout_details) {
                // Combine data and error to match getProposalInfo expected format
                const combined_response = {
                    ...data,
                    error: queryError || undefined,
                };
                const new_proposal = getProposalInfo(trade_store, combined_response);
                const { contract_payout, max_payout, error } = getPayoutInfo(new_proposal);

                dispatch({
                    type: 'UPDATE_DETAILS',
                    payload: {
                        ...(max_payout ? { max_payout } : {}),
                        [`${contractType}_contract_payout`]: contract_payout || 0,
                        [`is_${contractType}_payout_exceeded`]: !!error && contract_payout > Number(max_payout),
                        [`error_${contractType === 'first' ? 1 : 2}`]: error,
                    },
                });
            } else {
                // Recovery for minimum and maximum allowed values in case of errors
                if ((!details.min_stake || !details.max_stake) && queryError?.details) {
                    const { max_stake, min_stake } = queryError.details;
                    if (max_stake && min_stake) {
                        dispatch({
                            type: 'UPDATE_DETAILS',
                            payload: {
                                max_stake: max_stake as string | number,
                                min_stake: min_stake as string | number,
                            },
                        });
                    }
                }

                // Update proposal details after a successful API call
                if (proposal) {
                    const { limit_order, validation_params } = proposal as ExpandedProposal;
                    const { max, min } = validation_params?.stake ?? {};
                    const { order_amount } = limit_order?.stop_out ?? {};

                    dispatch({
                        type: 'UPDATE_DETAILS',
                        payload: {
                            ...(is_multiplier && order_amount ? { stop_out: order_amount } : {}),
                            ...(details.max_stake || details.min_stake ? {} : { max_stake: max, min_stake: min }),
                        },
                    });
                } else if (!proposal && is_multiplier) {
                    dispatch({
                        type: 'UPDATE_DETAILS',
                        payload: { stop_out: 0 },
                    });
                }
            }
        };

        React.useEffect(() => {
            if (response_1 || error_1) handleProposalResponse(response_1, error_1 || undefined, 'first');
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [response_1, error_1]);

        React.useEffect(() => {
            if (response_2 || error_2) handleProposalResponse(response_2, error_2 || undefined, 'second');
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [response_2, error_2]);

        const currency_symbol = getCurrencySymbol(currency);

        const getInputMessage = () =>
            !!details.min_stake &&
            !!details.max_stake && (
                <Localize
                    i18n_default_text='Range {{min_stake}} - {{max_stake}}'
                    values={{
                        min_stake: formatAmountWithSymbol(currency, +details.min_stake),
                        max_stake: formatAmountWithSymbol(currency, +details.max_stake),
                    }}
                />
            );

        // Separate local display value from the debounced API-triggering value
        // so user keystrokes are visible immediately while API calls are debounced
        const [displayAmount, setDisplayAmount] = React.useState(String(proposal_request_values.amount ?? ''));

        // Tracks the last tapped preset so the commit-time analytics can distinguish an unedited
        // preset selection ('preset' + value) from a typed amount ('custom')
        const preset_source = React.useRef<number | null>(null);

        // Whether the user has edited the draft in this sheet (typed or tapped a preset) — the
        // auto-defaulting below must never clobber a deliberate value.
        const has_user_edited = React.useRef(false);

        // Floor and cap both come from the store, so mobile matches desktop and the ladder appears
        // only once this market's own limits are known — never a row that is about to be replaced.
        const preset_key = mapContractTypeToStakePresetKey(contract_type);
        const base_preset_values = (preset_key ? getStakePresets(preset_key) : undefined) ?? DEFAULT_PRESET_VALUES;
        const preset_values = getStakeLadderValues(
            base_preset_values,
            stake_preset_limits?.floor,
            stake_preset_limits?.max
        );

        // No ladder until the limits arrive; the skeleton holds the row.
        const is_awaiting_stake_limits = !preset_values.length;

        // Sync display amount when proposal_request_values changes externally (e.g. on init)
        React.useEffect(() => {
            setDisplayAmount(String(proposal_request_values.amount ?? ''));
        }, [proposal_request_values.amount]);

        // Debounced function to update proposal values and trigger API call
        const debouncedUpdateProposal = React.useMemo(
            () =>
                debounce((new_value: string) => {
                    dispatch({ type: 'RESET_ERRORS' });
                    dispatch({
                        type: 'SET_PROPOSAL_VALUES',
                        payload: { amount: new_value },
                    });
                }, 300), // Wait 300ms after user stops typing
            []
        );

        // Preset tap fills the input and validates immediately (no typing debounce); Save commits
        const onPresetSelect = (value: number) => {
            preset_source.current = value;
            has_user_edited.current = true;
            debouncedUpdateProposal.cancel();
            setDisplayAmount(String(value));
            dispatch({ type: 'RESET_ERRORS' });
            dispatch({ type: 'SET_MAX_LENGTH', payload: getDecimalInputMaxLength(String(value), decimals) });
            dispatch({ type: 'SET_PROPOSAL_VALUES', payload: { amount: value } });
        };

        // Default the draft to the minimum quick pick (the stake the store settles on) when the
        // limits land while the sheet is open — and heal a stale seed: on a fast market switch the
        // sheet can open already seeded with the previous market's stake before the store's own
        // correction round trip settles, leaving an untouched draft below the new floor with a
        // stale error. A user-edited draft is never clobbered (`has_user_edited`; on the arrival
        // transition the input was disabled, so no edit can precede it), and an untouched draft at
        // or above the floor (a stake customised on this market earlier) is left alone.
        const was_awaiting_limits = React.useRef(is_awaiting_stake_limits);
        React.useEffect(() => {
            const was_awaiting = was_awaiting_limits.current;
            was_awaiting_limits.current = is_awaiting_stake_limits;
            const min_quick_pick = preset_values[0];
            if (is_awaiting_stake_limits || !min_quick_pick) return;
            const is_stale_seed = !has_user_edited.current && Number(displayAmount) < Number(min_quick_pick);
            if (!was_awaiting && !is_stale_seed) return;

            debouncedUpdateProposal.cancel();
            setDisplayAmount(String(min_quick_pick));
            dispatch({ type: 'RESET_ERRORS' });
            dispatch({ type: 'SET_MAX_LENGTH', payload: getDecimalInputMaxLength(String(min_quick_pick), decimals) });
            dispatch({ type: 'SET_PROPOSAL_VALUES', payload: { amount: min_quick_pick } });
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [is_awaiting_stake_limits, preset_values[0], amount, displayAmount]);

        const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const new_value = String(e.target.value);
            preset_source.current = null; // typing overrides a previous preset tap
            has_user_edited.current = true;
            setDisplayAmount(new_value); // Immediate display update
            dispatch({
                type: 'SET_MAX_LENGTH',
                payload: getDecimalInputMaxLength(new_value, decimals),
            });
            if (new_value.endsWith('.') || new_value.endsWith(',')) {
                dispatch({
                    type: 'SET_FE_STAKE_ERROR',
                    payload: localize('Should be a valid number.'),
                });
                return;
            }
            // The text is well-formed again, so clear the FE error. Has to happen before the early
            // returns below: they skip the proposal, so `RESET_ERRORS` never runs.
            if (fe_stake_error) dispatch({ type: 'SET_FE_STAKE_ERROR', payload: '' });

            // Same value as the last proposal, so no API request. Drop any pending debounce too, or an
            // older value lands and leaves the validated amount out of sync with the display.
            const is_equal = new_value === String(proposal_request_values.amount);
            if (is_equal) {
                debouncedUpdateProposal.cancel();
                return;
            }

            // If both old and new values are numerically zero (e.g. "0" → "0.0" → "0.00"),
            // update the display value without resetting the existing API error, since the
            // proposal query key is identical (parseFloat produces 0 for all) and React Query
            // returns a cached response that won't re-trigger the error-handling useEffect.
            const current_amount = String(proposal_request_values.amount);
            if (new_value !== '' && current_amount !== '' && Number(new_value) === 0 && Number(current_amount) === 0) {
                dispatch({ type: 'SET_PROPOSAL_VALUES', payload: { amount: new_value } });
                return;
            }

            // Use debounced function to reduce API calls
            debouncedUpdateProposal(new_value);
        };

        // Cleanup debounced function on unmount
        React.useEffect(() => {
            return () => {
                debouncedUpdateProposal.cancel();
            };
        }, [debouncedUpdateProposal]);

        const decimalGuard = createDecimalInputGuard(decimals);

        const onBeforeInputChange = (e: React.FormEvent<HTMLInputElement>) => {
            const typed_char = (e.nativeEvent as InputEvent)?.data ?? '';

            // Stake-specific: when the user types a separator while the input
            // is at most 10 chars, pre-bump `max_length` so the dispatch state
            // permits the longer "X.YY" form (the next digit needs the room).
            if (['.', ','].includes(typed_char) && (displayAmount?.length ?? 0) <= 10) {
                dispatch({
                    type: 'SET_MAX_LENGTH',
                    payload: decimals ? 11 + decimals : 10,
                });
            }

            // Block typing digits past the max decimal places. Shared guard
            // — TextFieldWithSteppers would otherwise round via `toFixed()`,
            // silently incrementing the value (e.g. 5.34 + "5" => 5.35).
            decimalGuard(e);
        };

        const onSave = () => {
            // Flush any pending debounced update so proposal_request_values.amount is up to date
            debouncedUpdateProposal.flush();
            // If displayAmount diverges from the last validated amount, the API hasn't
            // seen the new value yet — block the save until validation completes.
            const validated_amount = String(proposal_request_values.amount ?? '');
            if (displayAmount !== validated_amount) return;
            // Prevent from saving if user clicks before we get theAPI response or if we get an error in response or the field is empty
            if (
                is_fetching_1 ||
                (should_send_multiple_proposals && is_fetching_2) ||
                (should_show_stake_error && stake_error) ||
                fe_stake_error ||
                balance_hint
            )
                return;
            if (displayAmount === '') {
                dispatch({
                    type: 'SET_FE_STAKE_ERROR',
                    payload: localize('Amount is a required field.'),
                });
                return;
            }
            // Setting new stake value to the store and send it in streaming proposal
            onChange({ target: { name: 'amount', value: displayAmount } });
            const preset_value = preset_source.current;
            const is_preset_commit = preset_value !== null && String(preset_value) === displayAmount;
            trackAnalyticsEvent('ce_trade_types_form_v2', {
                action: 'customizing_trades',
                input_method: is_preset_commit ? 'preset' : 'custom',
                parameter_type: 'stake',
                ...(is_preset_commit ? { preset_value } : {}),
            });
            onClose();
        };

        // The drafted amount is only the sum being charged while `basis` is `stake` — on `payout`
        // basis (kept for Rise/Fall by `PurchaseButton`, and persisted) it is a target payout, so
        // comparing it against the balance would warn about a trade the user can afford. Anything
        // other than `stake` therefore stays silent and leaves the gate at Buy as the authority.
        const parsed_balance = parseAmount(balance);
        // A zero/negative balance is surfaced here too (the helper's empty-balance branch), not just
        // Buy: an unaffordable preset must show something rather than nothing while the balance is 0.
        const balance_hint =
            basis === 'stake' && Number.isFinite(parsed_balance)
                ? getInsufficientBalanceMessage({
                      balance,
                      stake: displayAmount,
                      currency: account_currency,
                      fallback: null,
                  })
                : null;

        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
                const isSaveDisabled =
                    is_loading_proposal ||
                    !!fe_stake_error ||
                    !!(should_show_stake_error && stake_error) ||
                    !!balance_hint;
                if (!isSaveDisabled) {
                    onSave();
                }
            }
        };

        // One window covering the whole validation of the typed amount: the debounce gap before the
        // request goes out, plus the request itself. `is_loading_proposal` alone is false during that
        // gap, and false again between the two proposals a Rise/Fall sheet sends, so the check flickered
        // on and off while the draft was still settling. This is also exactly what `onSave` enforces, so
        // the check is enabled only when tapping it would really commit.
        const is_validating = displayAmount !== String(proposal_request_values.amount ?? '') || is_loading_proposal;

        // The former footer disable conditions AND-ed with a dirty gate: the header check stays disabled
        // while the drafted stake still equals the committed store value (dismiss = discard). The
        // balance hint also gates Save — an unaffordable stake shouldn't be committable from here.
        const is_save_disabled =
            !displayAmount ||
            is_validating ||
            !!fe_stake_error ||
            !!(should_show_stake_error && stake_error) ||
            !!balance_hint ||
            displayAmount === String(amount ?? '');

        // Mobile: publish the commit handler + gate to the sheet host (page 0 `StakeSheetHeader`) so the
        // header check owns Save. Desktop leaves `registerHeaderActions` undefined and keeps its own footer.
        React.useEffect(() => {
            registerHeaderActions?.({ onSave, is_save_disabled });
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [is_save_disabled, displayAmount, proposal_request_values.amount, is_loading_proposal]);

        return (
            <React.Fragment>
                <ActionSheet.Content className='stake-content'>
                    <TextField
                        allowDecimals
                        allowSign={false}
                        className='text-field--custom'
                        customType='commaRemoval'
                        data-testid='dt_stake_input'
                        decimals={decimals}
                        // Not editable before the limits exist — the draft is validated against
                        // a band that has not arrived and replaced when the ladder lands.
                        disabled={is_awaiting_stake_limits}
                        inputMode='decimal'
                        id={input_id}
                        label={localize('Stake ({{currency}})', { currency: currency_symbol })}
                        maxLength={state.max_length}
                        message={
                            fe_stake_error ||
                            (should_show_stake_error && stake_error) ||
                            balance_hint ||
                            getInputMessage()
                        }
                        name='amount'
                        noStatusIcon
                        onChange={onInputChange}
                        onBeforeInput={onBeforeInputChange}
                        onKeyDown={handleKeyDown}
                        regex={/[^0-9.,]/g}
                        status={
                            fe_stake_error || (should_show_stake_error && stake_error) || balance_hint
                                ? 'error'
                                : 'neutral'
                        }
                        textAlignment='left'
                        value={displayAmount}
                        variant='fill'
                    />
                    {is_awaiting_stake_limits ? (
                        <ValueChipsSkeleton className='value-chips--pills' />
                    ) : (
                        <ValueChips
                            className='value-chips--pills'
                            values={preset_values}
                            selectedValue={Number(displayAmount)}
                            onSelect={onPresetSelect}
                            formatValue={value => `${currency_symbol}${value}`}
                        />
                    )}
                    <StakeDetails
                        contract_type={contract_type}
                        contract_types={contract_types}
                        currency={currency}
                        details={details}
                        is_loading_proposal={is_loading_proposal}
                        is_multiplier={is_multiplier}
                        is_empty={!displayAmount}
                        should_show_payout_details={should_show_payout_details}
                        onOpenStopOut={onOpenStopOut}
                        onOpenStopOutLevel={onOpenStopOutLevel}
                    />
                </ActionSheet.Content>
            </React.Fragment>
        );
    }
);

export default StakeInput;
