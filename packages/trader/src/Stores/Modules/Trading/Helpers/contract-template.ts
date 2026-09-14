import type { TAutoContractTemplate } from '@deriv/api';
import { convertToUnix, isAccumulatorContract, isMultiplierContract, toMoment } from '@deriv/shared';

import type TradeStore from '../trade-store';

import { isRiseFallContractType } from './allow-equals';

/**
 * Returns the API contract type (e.g. `CALL`, `ACCU`, `DIGITMATCH`) to use
 * for an autotrader contract template, derived from the current trade store.
 */
export const getApiContractType = (store: TradeStore): string => {
    const available_keys = Object.keys(store.trade_types);
    if (store.trade_type_tab && available_keys.includes(store.trade_type_tab)) {
        return store.trade_type_tab;
    }
    return available_keys[0] ?? store.contract_type;
};

/**
 * Builds an autotrader contract template from the current trade store state.
 * Maps trade store field names to the API's contract_template shape.
 * Only includes fields that are relevant to the selected contract type.
 */
const buildContractTemplate = (store: TradeStore): TAutoContractTemplate => {
    const contract_type = getApiContractType(store);

    const template: TAutoContractTemplate = {
        contract_type,
        currency: store.currency,
        underlying_symbol: store.symbol,
    };

    if (store.amount != null) template.amount = store.amount;
    if (store.basis) template.basis = store.basis as 'stake' | 'payout';

    // Accumulator and Multiplier contracts don't take a duration — including
    // it makes the server reject the contract on buy. Manual trading skips
    // these fields the same way (see `createProposalRequestForContract` ->
    // `getDurationParams` in proposal.ts).
    const has_duration = !isAccumulatorContract(contract_type) && !isMultiplierContract(contract_type);
    if (has_duration) {
        // Mirror manual's `getDurationParams`: send `date_expiry` for End
        // Time, otherwise `duration`/`duration_unit`.
        if (store.expiry_type === 'endtime' && store.expiry_date && store.expiry_time) {
            template.date_expiry = convertToUnix(toMoment(store.expiry_date).unix(), store.expiry_time);
        } else {
            if (store.duration != null) template.duration = store.duration;
            if (store.duration_unit)
                template.duration_unit = store.duration_unit as TAutoContractTemplate['duration_unit'];
        }
    }

    // Mirrors `createProposalRequestForContract` in `proposal.ts`. Rise/Fall
    // is excluded and digit contracts source from `last_digit` instead of
    // `barrier_1` so a stale Higher/Lower value (e.g. `+1.54`) can't leak
    // through and get rejected by the BE.
    const is_digit_contract = store.form_components.indexOf('last_digit') !== -1;
    const supports_barrier =
        !isAccumulatorContract(contract_type) &&
        !isMultiplierContract(contract_type) &&
        !isRiseFallContractType(contract_type) &&
        (store.barrier_count > 0 || is_digit_contract);
    if (supports_barrier) {
        const barrier_value = is_digit_contract ? String(store.last_digit) : store.barrier_1;
        if (barrier_value) template.barrier = barrier_value;
        if (store.barrier_count === 2 && store.barrier_2) template.barrier2 = store.barrier_2;
    }

    // Only include growth_rate for accumulator contracts
    if (isAccumulatorContract(contract_type) && store.growth_rate) {
        template.growth_rate = store.growth_rate;
    }

    // Only include multiplier for multiplier contracts
    if (isMultiplierContract(contract_type) && store.multiplier) {
        template.multiplier = store.multiplier;
    }

    // limit_order shape differs by contract type — mirror manual proposal
    // (`setProposalMultiplier` / `setProposalAccumulator` in `proposal.ts`):
    //   - Multipliers: stop_loss + take_profit
    //   - Accumulators: take_profit only
    const is_multiplier = isMultiplierContract(contract_type);
    const is_accumulator = isAccumulatorContract(contract_type);
    const take_profit_amount = store.has_take_profit ? store.take_profit : undefined;
    const stop_loss_amount = is_multiplier && store.has_stop_loss ? store.stop_loss : undefined;
    if ((is_multiplier || is_accumulator) && (take_profit_amount || stop_loss_amount)) {
        template.limit_order = {};
        if (take_profit_amount) template.limit_order.take_profit = +take_profit_amount || 0;
        if (stop_loss_amount) template.limit_order.stop_loss = +stop_loss_amount || 0;
    }

    return template;
};

/**
 * Validates that a contract template has all required fields for auto_start.
 * Returns an error message string if invalid, or null if valid.
 */
const validateContractTemplate = (template: TAutoContractTemplate): string | null => {
    if (!template.contract_type) return 'Contract type is required';
    if (!template.currency) return 'Currency is required';
    if (!template.underlying_symbol) return 'Symbol is required';
    return null;
};

/**
 * Convenience for the two-step "build then validate" sequence used by the
 * auto_start click handlers.
 */
export const buildAndValidateContractTemplate = (store: TradeStore) => {
    const template = buildContractTemplate(store);
    const error = validateContractTemplate(template);
    return { template, error };
};
