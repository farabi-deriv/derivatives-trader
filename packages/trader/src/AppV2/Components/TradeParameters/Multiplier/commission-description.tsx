import { Text } from '@deriv-com/quill-ui';
import { Localize } from '@deriv-com/translations';

import CommissionFormula, { getCommissionPercentage } from './commission-formula';

import './commission-description.scss';

type TCommissionValue = number | string | null | undefined;

type TCommissionDescriptionProps = {
    commission: TCommissionValue;
    multiplier: TCommissionValue;
    amount: TCommissionValue;
    currency: string;
};

/**
 * The commission explanation shown as a page within the multiplier / stake action sheets: a sentence
 * describing how commission is derived, plus the dynamic formula in an emphasised pill. Renders
 * nothing when the percentage can't be derived.
 */
const CommissionDescription = ({ commission, multiplier, amount, currency }: TCommissionDescriptionProps) => {
    const commission_percentage = getCommissionPercentage(commission, multiplier, amount);

    if (commission_percentage === null) return null;

    return (
        <div className='commission-description'>
            <Text as='div'>
                <Localize
                    i18n_default_text='Commission is calculated as {{commission_percentage}}% of your stake multiplied by the multiplier.'
                    values={{ commission_percentage }}
                />
            </Text>
            <Text as='div' bold className='commission-description__formula'>
                <CommissionFormula
                    commission={commission}
                    multiplier={multiplier}
                    amount={amount}
                    currency={currency}
                />
            </Text>
        </div>
    );
};

export default CommissionDescription;
