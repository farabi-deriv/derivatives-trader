import { localize } from '@deriv-com/translations';

export const FORM_ERROR_MESSAGES = {
    empty_barrier: () => localize('Barrier is a required field.'),
    barrier: () => localize('Should be a valid number.'),
    number: () => localize('Should be a valid number.'),
    decimalPlaces: decimals =>
        localize('Up to {{decimal_count}} decimal places are allowed.', { decimal_count: decimals }),
    value: value => localize('Should be {{value}}', { value }),
    betweenMinMax: (min_value, max_value) =>
        localize('Should be between {{min_value}} and {{max_value}}', {
            min_value,
            max_value,
        }),
    minNumber: min_value => localize('Should be more than {{min_value}}', { min_value }),
    maxNumber: max_value => localize('Should be less than {{max_value}}', { max_value }),
};
