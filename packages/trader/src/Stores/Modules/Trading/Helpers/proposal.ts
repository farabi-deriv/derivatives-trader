import { TPriceProposalResponse, TSocketError } from '@deriv/api';
import {
    convertToUnix,
    getDecimalPlaces,
    getLocalizedBasis,
    getPropertyValue,
    isAccumulatorContract,
    isTurbosContract,
    mapErrorMessage,
    toMoment,
    TRADE_TYPES,
} from '@deriv/shared';

import { TTradeStore } from 'Types';

import { isRiseFallContractType } from './allow-equals';

type TObjContractBasis = {
    text: string;
    value: string;
};

type TObjMultiplier = {
    cancellation?: string;
    limit_order?: {
        take_profit?: number;
        stop_loss?: number;
    };
    multiplier?: number;
};

type TObjAccum = {
    growth_rate?: number;
    limit_order?: {
        take_profit?: number;
    };
};

type TObjExpiry = {
    date_expiry?: number;
};

type TValidationParams =
    | {
          validation_params?: {
              payout?: {
                  max: string;
              };
              max_payout?: string;
              max_ticks?: number;
              stake?: {
                  max: string;
                  min: string;
              };
              take_profit: {
                  max: string;
                  min: string;
              };
              stop_loss: { max: string; min: string };
          };
      }
    | undefined;

export type ExpandedProposal = NonNullable<TPriceProposalResponse['proposal']> & TValidationParams;

const isVisible = (elem: HTMLElement) => !(!elem || (elem.offsetWidth === 0 && elem.offsetHeight === 0));

const map_error_field: { [key: string]: string } = {
    barrier: 'barrier_1',
    barrier2: 'barrier_2',
    date_expiry: 'expiry_date',
};

export const getProposalErrorField = (response: TPriceProposalResponse) => {
    const error_field: string = getPropertyValue(response, ['error', 'details', 'field']);
    if (!error_field) {
        return null;
    }
    const error_id = map_error_field[error_field] || error_field;
    const el_error = document.getElementsByName(error_id)[0];
    return el_error && isVisible(el_error) ? error_id : null;
};

/**
 * The stake band a response reports, read from every place the API puts it (verified live):
 * the proposal payload, `error.details`, and — for InvalidMinStake, whose details carry no
 * min_stake — the message's `code_args` (["8.00"]). Read per field, not per source: a rejection
 * can carry a limit-less `proposal` object beside its error. `code_args` is trusted only for
 * that subcode; elsewhere it holds message fill-ins (e.g. the barrier list).
 */
export const getStakeLimitsFromResponse = (
    response: TPriceProposalResponse & { error?: TSocketError<'proposal'>['error'] }
): { min_stake?: number; max_stake?: number } => {
    type TStakeLimits = { min_stake?: number; max_stake?: number };
    const proposal_limits: TStakeLimits = response.proposal ?? {};
    const error_limits = (response.error?.details ?? {}) as TStakeLimits;

    const { subcode, code_args } = (response.error ?? {}) as { subcode?: string; code_args?: string[] };
    const code_args_min = subcode === 'InvalidMinStake' ? Number(code_args?.[0]) : NaN;

    const min_stake =
        proposal_limits.min_stake ??
        error_limits.min_stake ??
        (Number.isFinite(code_args_min) && code_args_min > 0 ? code_args_min : undefined);
    const max_stake = proposal_limits.max_stake ?? error_limits.max_stake;

    return { min_stake, max_stake };
};

export const getProposalInfo = (
    store: TTradeStore,
    response: TPriceProposalResponse & { error?: TSocketError<'proposal'>['error'] }
) => {
    const proposal: ExpandedProposal = response.proposal || ({} as ExpandedProposal);
    const profit = (proposal.payout || 0) - (proposal.ask_price || 0);
    const returns = (profit * 100) / (proposal.ask_price || 1);
    // display_value property has been removed from the API
    // Using ask_price as fallback since display_value is no longer provided
    const stake = proposal.ask_price ? proposal.ask_price.toString() : '';
    const basis_list = store.basis_list;

    const contract_basis: TObjContractBasis | undefined =
        store.is_vanilla || store.is_turbos
            ? { text: getLocalizedBasis().payout_per_point, value: 'display_number_of_contracts' }
            : basis_list.find(o => o.value !== store.basis) || ({} as TObjContractBasis);

    const is_stake = contract_basis?.value === 'stake';

    const price = is_stake ? stake : (proposal[contract_basis?.value as keyof ExpandedProposal] as string | number);

    const obj_contract_basis = {
        text: contract_basis?.text || '',
        value: price || '',
    };

    const commission = proposal.commission;
    const cancellation = proposal.cancellation;
    const accumulators_details = {
        ...proposal.contract_details,
        growth_rate: store.growth_rate,
        spot_time: proposal.spot_time,
    };

    return {
        commission,
        cancellation,
        id: proposal.id || '',
        has_error: !!response.error,
        has_error_details: !!getProposalErrorField(response),
        error_code: response?.error?.code,
        error_field: response?.error?.details?.field,
        limit_order: proposal.limit_order,
        // TODO: decide on longcode for accumulator and multiplier
        // message: proposal.longcode || mapErrorMessage(response?.error || {}),
        message: mapErrorMessage(response?.error || {}),
        obj_contract_basis,
        payout: proposal.payout,
        profit: profit.toFixed(getDecimalPlaces(store.currency)),
        returns: `${returns.toFixed(2)}%`,
        stake,
        spot: proposal.spot,
        validation_params: proposal?.validation_params,
        ...accumulators_details,
    };
};

/** Accumulators and Multipliers legitimately carry no expiry fields at all. */
const takesNoExpiry = (contract_type: string) =>
    contract_type === TRADE_TYPES.ACCUMULATOR || contract_type === TRADE_TYPES.MULTIPLIER;

/**
 * The absolute expiry timestamp an `endtime` expiry resolves to, or `undefined` when the store
 * holds no usable expiry time — a state the mobile Duration sheet used to be able to commit
 * (an expiry date with no time).
 */
const resolveDateExpiry = (store: TTradeStore) => {
    if (store.expiry_type !== 'endtime' || !store.expiry_time) return undefined;
    return convertToUnix(toMoment(store.expiry_date).unix(), store.expiry_time);
};

/** The duration the store still holds, when it is usable as a proposal expiry. */
const resolveDuration = (store: TTradeStore) => {
    const duration = parseInt(store.duration.toString());
    return duration > 0 && store.duration_unit ? { duration, duration_unit: store.duration_unit } : undefined;
};

/**
 * Whether an outgoing proposal request can carry an expiry the backend accepts: a duration with
 * its unit, or an absolute `date_expiry`. A request carrying neither is answered with "Please
 * specify either duration or date_expiry.", so `requestProposal` withholds it instead of sending
 * a request it knows will be rejected.
 */
export const hasResolvableExpiry = (store: TTradeStore) => {
    if (takesNoExpiry(store.contract_type)) return true;
    return !!resolveDateExpiry(store) || !!resolveDuration(store);
};

export const createProposalRequests = (store: TTradeStore) => {
    const requests = {} as Record<string, ReturnType<typeof createProposalRequestForContract>>;

    Object.keys(store.trade_types).forEach(type => {
        const new_req = createProposalRequestForContract(store, type);
        requests[type] = new_req;
    });

    return requests;
};

const setProposalMultiplier = (store: TTradeStore, obj_multiplier: TObjMultiplier) => {
    obj_multiplier.multiplier = store.multiplier;
    obj_multiplier.cancellation = store.has_cancellation ? store.cancellation_duration : undefined;

    obj_multiplier.limit_order = store.has_take_profit || store.has_stop_loss ? {} : undefined;

    if (store.has_take_profit && store.take_profit && obj_multiplier.limit_order) {
        obj_multiplier.limit_order.take_profit = +store.take_profit || 0; // send positive take_profit to API
    }

    if (store.has_stop_loss && store.stop_loss && obj_multiplier.limit_order) {
        obj_multiplier.limit_order.stop_loss = +store.stop_loss || 0; // send positive stop_loss to API
    }
};

const setProposalAccumulator = (store: TTradeStore, obj_accumulator: TObjAccum) => {
    obj_accumulator.growth_rate = store.growth_rate;

    obj_accumulator.limit_order = store.has_take_profit ? {} : undefined;

    if (store.has_take_profit && store.take_profit && obj_accumulator.limit_order) {
        obj_accumulator.limit_order.take_profit = +store.take_profit || 0; // send positive take_profit to API
    }
};

export const createProposalRequestForContract = (store: TTradeStore, type_of_contract: string) => {
    const obj_accumulator: TObjAccum = {};
    const obj_expiry: TObjExpiry = {};
    const obj_multiplier: TObjMultiplier = {};
    let limit_order;

    const date_expiry = resolveDateExpiry(store);
    if (date_expiry) {
        obj_expiry.date_expiry = date_expiry;
    }

    const getDurationParams = () => {
        // ACCUMULATOR and MULTIPLIER contracts don't use duration parameters
        if (takesNoExpiry(store.contract_type)) {
            return {};
        }

        if (store.expiry_type === 'duration') {
            // Ensure we have valid duration and duration_unit values
            const duration = parseInt(store.duration.toString());
            const duration_unit = store.duration_unit;

            return {
                duration,
                duration_unit,
            };
        }

        // For endtime, ensure we have a valid expiry_date
        if (store.expiry_type === 'endtime' && obj_expiry.date_expiry) {
            return obj_expiry;
        }

        // An `endtime` expiry that resolves no date_expiry (a date committed without a time) used
        // to fall through to `{}`, sending a request with no expiry at all — the exact shape the
        // backend rejects with "Please specify either duration or date_expiry.". Fall back to the
        // duration the store still holds; when there is no usable duration either,
        // `hasResolvableExpiry` is what stops the request from being sent at all.
        return resolveDuration(store) ?? {};
    };

    if (store.contract_type === TRADE_TYPES.MULTIPLIER) {
        setProposalMultiplier(store, obj_multiplier);
    }

    if (store.contract_type === TRADE_TYPES.ACCUMULATOR) {
        setProposalAccumulator(store, obj_accumulator);
    }

    if (isTurbosContract(store.contract_type) && store.has_take_profit && store.take_profit) {
        limit_order = { take_profit: +store.take_profit || 0 };
    }

    return {
        proposal: 1,
        subscribe: 1,
        amount: parseFloat(store.amount.toString()) || 0,
        basis: store.basis,
        contract_type: type_of_contract,
        currency: store.currency,
        underlying_symbol: store.symbol,
        ...(store.start_date && store.start_time && { date_start: convertToUnix(store.start_date, store.start_time) }),
        ...getDurationParams(),
        ...((store.barrier_count > 0 || store.form_components.indexOf('last_digit') !== -1) &&
            !isAccumulatorContract(type_of_contract) &&
            !isTurbosContract(type_of_contract) &&
            !isRiseFallContractType(type_of_contract) && {
                barrier:
                    store.barrier ||
                    store.barrier_1 ||
                    (store.form_components.indexOf('last_digit') !== -1 ? store.last_digit : undefined),
            }),
        ...(store.barrier_count === 2 &&
            !isAccumulatorContract(type_of_contract) &&
            !isRiseFallContractType(type_of_contract) && {
                barrier2: store.barrier_2,
            }),
        ...(isTurbosContract(type_of_contract) && {
            payout_per_point:
                store.payout_per_point || store.payout_choices?.[Math.floor((store.payout_choices?.length ?? 0) / 2)],
        }),
        limit_order,
        ...obj_accumulator,
        ...obj_multiplier,
    };
};
