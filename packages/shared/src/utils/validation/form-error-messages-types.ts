type TMessage = () => string;
type TParameter = string | number;

export type TFormErrorMessagesTypes = Record<'empty_barrier' | 'barrier' | 'number', TMessage> & {
    decimalPlaces: (decimals: TParameter) => string;
    value: (value: TParameter) => string;
    betweenMinMax: (min_value: TParameter, max_value: TParameter) => string;
    minNumber: (min_value: TParameter) => string;
    maxNumber: (max_value: TParameter) => string;
};
