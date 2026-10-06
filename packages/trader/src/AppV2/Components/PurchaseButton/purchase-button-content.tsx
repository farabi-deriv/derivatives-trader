import React from 'react';
import clsx from 'clsx';

import { getGrowthRatePercentage, getLocalizedBasis } from '@deriv/shared';
import { CaptionText, Skeleton } from '@deriv-com/quill-ui';
import { useTranslations } from '@deriv-com/translations';

import { formatAmountWithSymbol } from 'AppV2/Utils/currency-utils';
import { useTraderStore } from 'Stores/useTraderStores';

type TPurchaseButtonContent = {
    /** Accumulators' selected growth rate, as a fraction. Set only where the spec asks for it. */
    growth_rate?: number;
    has_no_button_content?: boolean;
    info: ReturnType<typeof useTraderStore>['proposal_info'][0] | Record<string, never>;
    /** Accumulators' max payout — shown in place of the standard payout for a fresh accumulator. */
    max_payout?: number | string;
} & Pick<
    ReturnType<typeof useTraderStore>,
    | 'currency'
    | 'has_cancellation'
    | 'has_open_accu_contract'
    | 'is_accumulator'
    | 'is_multiplier'
    | 'is_vanilla'
    | 'is_turbos'
>;

const PurchaseButtonContent = ({
    currency,
    growth_rate,
    has_cancellation,
    has_open_accu_contract,
    has_no_button_content,
    info,
    is_accumulator,
    is_multiplier,
    is_turbos,
    is_vanilla,
    max_payout,
}: TPurchaseButtonContent) => {
    const { localize } = useTranslations();
    const { max_payout: max_payout_label, payout } = getLocalizedBasis();

    // The one caption that isn't priced by a proposal. Where it is asked for, the button is
    // otherwise label-only (`has_no_button_content`), so it has to outrank that early return —
    // and it fills the value slot directly, skipping the currency/skeleton treatment below.
    const has_growth_rate = growth_rate !== undefined;

    if (!has_growth_rate && (has_no_button_content || (is_multiplier && !has_cancellation))) return null;

    const is_accu_max_payout = is_accumulator && !has_open_accu_contract;

    const getAmount = () => {
        const { stake, obj_contract_basis } = info;
        if (is_multiplier) {
            // For multipliers, the stake value from proposal_info already includes all fees
            // (base stake + commission + DC fee if applicable)
            // So we just return the stake value directly
            const total_cost = typeof stake === 'string' ? parseFloat(stake) || 0 : stake || 0;
            return total_cost;
        }
        if (is_accu_max_payout) return max_payout;
        return obj_contract_basis?.value;
    };

    const getTextBasis = () => {
        if (has_growth_rate) return localize('Growth');
        if (is_multiplier) {
            return has_cancellation ? localize('Total cost') : undefined;
        }
        if (is_accu_max_payout) return max_payout_label;
        return payout;
    };

    const text_basis = getTextBasis();
    const amount = getAmount();

    const getValue = () => {
        // Picked locally rather than priced, so it is ready before any proposal is.
        if (has_growth_rate) return `${getGrowthRatePercentage(growth_rate)}%`;
        if (amount) return formatAmountWithSymbol(currency, amount, !is_turbos && !is_vanilla);
        if (info.has_error) return '-';
        // Renders a <span>, so it nests safely inside this <p>-based CaptionText.
        return <Skeleton.Square width={56} height={12} rounded />;
    };

    // The basis label is a static string that never depends on the proposal, so it must not wait for
    // one. Hiding it alongside a missing amount is what left the button reading just "Buy" above a
    // blank row whenever prices were in flight (#1142). Only the value slot resolves now: the amount
    // when priced, a dash once the proposal has errored (so it can't shimmer forever), and otherwise
    // a placeholder — the same three-way treatment the trade params panel uses for its Payout row.
    const has_no_basis = !text_basis;

    return (
        <CaptionText
            size='sm'
            className={clsx(
                'purchase-button__information__wrapper',
                has_no_basis && 'purchase-button__information__wrapper--disabled-placeholder'
            )}
            data-testid='dt_purchase_button_wrapper'
        >
            {!has_no_basis && (
                <React.Fragment>
                    <CaptionText
                        as='span'
                        size='sm'
                        className={clsx(!has_open_accu_contract && 'purchase-button__information__item')}
                        color='quill-typography__color--prominent'
                    >
                        {text_basis}
                    </CaptionText>
                    <CaptionText
                        as='span'
                        size='sm'
                        className={clsx(!has_open_accu_contract && 'purchase-button__information__item')}
                        color='quill-typography__color--prominent'
                    >
                        {getValue()}
                    </CaptionText>
                </React.Fragment>
            )}
        </CaptionText>
    );
};

export default PurchaseButtonContent;
