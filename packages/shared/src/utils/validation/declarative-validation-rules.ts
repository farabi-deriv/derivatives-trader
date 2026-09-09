import { addComma } from '../currency';
import { cloneObject } from '../object';
import { compareBigUnsignedInt } from '../string';

import { TFormErrorMessagesTypes } from './form-error-messages-types';

export type TOptions = {
    [key: string]: unknown;
    decimals?: string | number;
    is_required?: boolean;
    max?: number | string | null;
    min?: number | string | null;
    name1?: string;
    name2?: string;
    regex?: RegExp;
    type?: string;
};

export type TRuleOptions<S extends object = object> = {
    func?: <T extends string>(
        value: T,
        options?: TOptions,
        store?: S,
        inputs?: Pick<S, keyof S>
    ) => boolean | { is_ok: boolean; message: string };
    condition?: (store: S) => boolean;
    message?: string | (() => string);
} & TOptions;

const validRequired = (value?: string | number /* , options, field */) => {
    if (value === undefined || value === null) {
        return false;
    }

    const str = value.toString().replace(/\s/g, '');
    return str.length > 0;
};
const validBarrier = (value: string) => {
    if (value === '+' || value === '-') {
        return {
            is_ok: false,
            message: form_error_messages?.empty_barrier(),
        };
    }
    return { is_ok: /^[+-]?\d+(\.\d+)?$/.test(value) };
};
let pre_build_dvrs: TInitPreBuildDVRs, form_error_messages: TFormErrorMessagesTypes;

const isMoreThanMax = (value: number, options: TOptions) =>
    options.type === 'float' ? +value > Number(options.max) : compareBigUnsignedInt(value, options.max) === 1;

export const validNumber = (value: string, opts: TOptions) => {
    const options = cloneObject(opts);
    let message = null;
    if (options.allow_empty && value.length === 0) {
        return {
            is_ok: true,
        };
    }

    let is_ok = true;
    if ('min' in options && typeof options.min === 'function') {
        options.min = options.min();
    }
    if ('max' in options && typeof options.max === 'function') {
        options.max = options.max();
    }

    if (!(options.type === 'float' ? /^\d*(\.\d+)?$/ : /^\d+$/).test(value) || isNaN(+value)) {
        is_ok = false;
        message = form_error_messages.number();
    } else if ('min' in options && 'max' in options && +options.min === +options.max && +value !== +options.min) {
        is_ok = false;
        message = form_error_messages.value(addComma(options.min, options.decimals));
    } else if (
        'min' in options &&
        'max' in options &&
        options.min > 0 &&
        (+value < +options.min || isMoreThanMax(+value, options))
    ) {
        is_ok = false;
        const min_value = addComma(options.min, options.decimals);
        const max_value = addComma(options.max, options.decimals);
        message = form_error_messages.betweenMinMax(min_value, max_value);
    } else if (
        options.type === 'float' &&
        options.decimals &&
        !new RegExp(`^\\d+(\\.\\d{0,${options.decimals}})?$`).test(value)
    ) {
        is_ok = false;
        message = form_error_messages.decimalPlaces(options.decimals);
    } else if ('min' in options && +value < +options.min) {
        is_ok = false;
        const min_value = addComma(options.min, options.decimals);
        message = form_error_messages.minNumber(min_value);
    } else if ('max' in options && isMoreThanMax(+value, options)) {
        is_ok = false;
        const max_value = addComma(options.max, options.decimals);
        message = form_error_messages.maxNumber(max_value);
    }
    return { is_ok, message };
};

export type TInitPreBuildDVRs = ReturnType<typeof initPreBuildDVRs>;
const initPreBuildDVRs = () => ({
    barrier: {
        func: validBarrier,
        message: form_error_messages.barrier,
    },
    number: {
        func: (...args: [string, TOptions, Record<string, string | boolean>]) => {
            const [value, opts] = args;
            return validNumber(value, opts);
        },
        message: form_error_messages.number,
    },
    req: { func: validRequired, message: '' },
});

export const initFormErrorMessages = (all_form_error_messages: TFormErrorMessagesTypes) => {
    if (!pre_build_dvrs) {
        form_error_messages = all_form_error_messages;
        pre_build_dvrs = initPreBuildDVRs();
    }
};

export const getPreBuildDVRs = () => {
    return pre_build_dvrs;
};
