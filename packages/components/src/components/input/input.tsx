import React from 'react';
import classNames from 'classnames';
import Field from '../field';
import Text from '../text/text';

export type TInputProps = {
    autoComplete?: string;
    bottom_label?: string;
    className?: string;
    classNameError?: string;
    classNameHint?: string;
    classNameWarn?: string;
    data_testId?: string;
    disabled?: boolean;
    error?: string;
    field_className?: string;
    hint?: React.ReactNode;
    id?: string;
    inputMode?: React.HTMLAttributes<HTMLInputElement | HTMLTextAreaElement>['inputMode'];
    input_id?: string;
    is_relative_hint?: boolean;
    label_className?: string;
    label?: string;
    leading_icon?: React.ReactElement;
    maxLength?: number;
    name?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
    onMouseDown?: React.MouseEventHandler<HTMLInputElement | HTMLTextAreaElement>;
    onMouseUp?: React.MouseEventHandler<HTMLInputElement | HTMLTextAreaElement>;
    onFocus?: React.FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
    onPaste?: React.ClipboardEventHandler<HTMLInputElement | HTMLTextAreaElement>;
    onKeyUp?: React.FormEventHandler<HTMLInputElement | HTMLTextAreaElement>;
    onKeyDown?: React.FormEventHandler<HTMLInputElement | HTMLTextAreaElement>;
    onInput?: React.FormEventHandler<HTMLInputElement | HTMLTextAreaElement>;
    onClick?: React.MouseEventHandler<HTMLInputElement | HTMLTextAreaElement>;
    onMouseEnter?: React.MouseEventHandler<HTMLInputElement | HTMLTextAreaElement>;
    onMouseLeave?: React.MouseEventHandler<HTMLInputElement | HTMLTextAreaElement>;
    placeholder?: string;
    ref?: React.RefObject<
        React.ComponentType extends 'textarea'
            ? HTMLTextAreaElement
            : React.ComponentType extends 'input'
              ? HTMLInputElement
              : never
    >;
    required?: boolean;
    trailing_icon?: React.ReactElement | null;
    type?: string;
    value?: string | number;
    warn?: string;
    readOnly?: boolean;
    is_autocomplete_disabled?: string;
    is_hj_whitelisted?: string;
} & Omit<React.ComponentProps<'input'>, 'ref'>;

type TInputWrapper = {
    has_footer: boolean;
};

const InputWrapper = ({ children, has_footer }: React.PropsWithChildren<TInputWrapper>) =>
    has_footer ? <div className='dc-input__wrapper'>{children}</div> : <React.Fragment>{children}</React.Fragment>;

const Input = React.forwardRef<HTMLInputElement & HTMLTextAreaElement, TInputProps>(
    (
        {
            bottom_label,
            className,
            classNameError,
            classNameHint,
            classNameWarn,
            disabled = false,
            error,
            field_className,
            hint,
            input_id,
            is_relative_hint,
            label_className,
            label,
            leading_icon,
            trailing_icon,
            warn,
            data_testId,
            maxLength,
            placeholder,
            ...props
        },
        ref?
    ) => {
        const has_footer = !!hint && !!is_relative_hint;
        const field_placeholder = label ? '' : placeholder;

        return (
            <InputWrapper has_footer={has_footer}>
                <div
                    className={classNames('dc-input', className, {
                        'dc-input--disabled': disabled,
                        'dc-input--error': error,
                        'dc-input--hint': hint,
                        'dc-input--bottom-label-active': bottom_label,
                    })}
                >
                    <div
                        className={classNames('dc-input__container', {
                            'dc-input__container--disabled': disabled,
                            'dc-input__container--error': error,
                        })}
                    >
                        {leading_icon &&
                            React.cloneElement(leading_icon, {
                                className: classNames('dc-input__leading-icon', leading_icon.props.className),
                                iconSize: leading_icon.props.iconSize || 'xs',
                                fill: leading_icon.props.fill || 'var(--color-text-primary)',
                            })}
                        {props.type === 'textarea' ? (
                            <textarea
                                ref={ref}
                                data-testid={data_testId}
                                {...(props as React.ComponentProps<'textarea'>)}
                                className={classNames('dc-input__field dc-input__textarea', {
                                    'dc-input__field--placeholder-visible': !label && placeholder,
                                })}
                                onChange={props.onChange}
                                disabled={disabled}
                                id={input_id}
                                maxLength={maxLength}
                                placeholder={field_placeholder}
                            />
                        ) : (
                            <input
                                ref={ref}
                                data-testid={data_testId}
                                {...props}
                                className={classNames('dc-input__field', field_className, {
                                    'dc-input__field--placeholder-visible': !label && placeholder,
                                })}
                                onFocus={props.onFocus}
                                onChange={props.onChange}
                                onKeyDown={props.onKeyDown}
                                onMouseDown={props.onMouseDown}
                                onMouseUp={props.onMouseUp}
                                onPaste={props.onPaste}
                                disabled={disabled}
                                data-lpignore={props.type === 'password' ? undefined : true}
                                id={input_id}
                                aria-label={label as string}
                                maxLength={maxLength}
                                placeholder={field_placeholder}
                            />
                        )}
                        {trailing_icon &&
                            React.cloneElement(trailing_icon, {
                                className: classNames('dc-input__trailing-icon', trailing_icon.props.className),
                                iconSize: trailing_icon.props.iconSize || 'xs',
                                fill: trailing_icon.props.fill || 'var(--color-text-primary)',
                            })}
                        {label && (
                            <label className={classNames('dc-input__label', label_className)} htmlFor={props.id}>
                                {label}
                            </label>
                        )}
                    </div>
                    <div>
                        {!has_footer && (
                            <React.Fragment>
                                {error && <Field className={classNameError} message={error} type='error' />}
                                {warn && <Field className={classNameWarn} message={warn} type='warn' />}
                                {!error && hint && !is_relative_hint && (
                                    <div className='dc-input__hint'>
                                        <Text as='p' color='secondary' size='xxs' className={classNameHint}>
                                            {hint}
                                        </Text>
                                    </div>
                                )}
                            </React.Fragment>
                        )}
                    </div>
                </div>
                {has_footer && (
                    // Added like below for backward compatibility.
                    // TODO: refactor existing usages to use "relative" hints
                    // i.e. get rid of absolute hints, errors, counters.
                    <div className='dc-input__footer'>
                        {error && <Field className={classNameError} message={error} type='error' />}
                        {warn && <Field className={classNameWarn} message={warn} type='warn' />}
                        {!error && hint && (
                            <div className='dc-input__hint dc-input__hint--relative'>
                                <Text color='secondary' line-height='m' size='xxs'>
                                    {hint}
                                </Text>
                            </div>
                        )}
                    </div>
                )}
                {bottom_label && !error && (
                    <div className='dc-input__bottom-label'>
                        <Text size='xs' color='secondary'>
                            {bottom_label}
                        </Text>
                    </div>
                )}
            </InputWrapper>
        );
    }
);

Input.displayName = 'Input';

export default Input;
