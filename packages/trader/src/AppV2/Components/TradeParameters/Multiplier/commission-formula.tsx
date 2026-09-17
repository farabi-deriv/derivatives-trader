import { Money } from '@deriv/components';
import { Localize } from '@deriv-com/translations';

type TCommissionValue = number | string | null | undefined;

type TCommissionFormulaProps = {
    commission: TCommissionValue;
    multiplier: TCommissionValue;
    amount: TCommissionValue;
    currency: string;
};

/**
 * V1-parity commission percentage: (commission * 100) / (multiplier * stake), to 4 dp.
 * The stake is the base `amount`, NOT the proposal ask_price (which already bundles commission + DC fee).
 * Returns null when it cannot be derived (missing commission, or a zero/NaN divisor) so callers can
 * suppress the tooltip rather than render `NaN%`.
 */
export const getCommissionPercentage = (
    commission: TCommissionValue,
    multiplier: TCommissionValue,
    amount: TCommissionValue
): string | null => {
    const divisor = Number(multiplier) * Number(amount);
    if (commission == null || !Number.isFinite(divisor) || divisor === 0) return null;
    return ((Number(commission) * 100) / divisor).toFixed(4);
};

/**
 * Renders the dynamic commission formula, e.g. `0.0400% of (10.00 * 10)` (matching V1 wording).
 * Returns null when the percentage cannot be derived.
 */
const CommissionFormula = ({ commission, multiplier, amount, currency }: TCommissionFormulaProps) => {
    const commission_percentage = getCommissionPercentage(commission, multiplier, amount);

    if (commission_percentage === null) return null;

    return (
        <Localize
            i18n_default_text='<0>{{commission_percentage}}%</0> of (<1/> × {{multiplier}})'
            values={{ commission_percentage, multiplier }}
            components={[<strong key={0} />, <Money key={1} amount={Number(amount)} currency={currency} />]}
        />
    );
};

export default CommissionFormula;
