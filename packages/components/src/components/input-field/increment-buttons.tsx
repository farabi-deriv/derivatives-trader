import React from 'react';
import classNames from 'classnames';
import Button from '../button';
import { StandalonePlusRegularIcon, StandaloneMinusRegularIcon } from '@deriv/quill-icons';

export type TButtonType = 'button' | 'submit' | 'reset';

type IncrementButtonsProps = {
    decrementValue: (ev?: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => void;
    id?: string;
    incrementValue: (ev?: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => void;
    max_is_disabled: number | boolean;
    min_is_disabled: number | boolean;
    type?: TButtonType;
};

const IncrementButtons = ({
    decrementValue,
    id,
    incrementValue,
    max_is_disabled,
    min_is_disabled,
    type,
}: IncrementButtonsProps) => {
    return (
        <React.Fragment>
            <Button
                id={`${id}_add`}
                className={classNames('dc-input-wrapper__button dc-input-wrapper__button--increment', {
                    'dc-input-wrapper__button--disabled': !!max_is_disabled,
                })}
                is_disabled={!!max_is_disabled}
                onClick={incrementValue}
                tabIndex={-1}
                aria-label={'Increment value'}
                type={type}
            >
                <StandalonePlusRegularIcon
                    className={'dc-input-wrapper__icon dc-input-wrapper__icon--plus'}
                    fill={max_is_disabled ? 'var(--color-text-disabled)' : 'var(--color-text-primary)'}
                    iconSize='xs'
                />
            </Button>
            <Button
                id={`${id}_sub`}
                className={classNames('dc-input-wrapper__button dc-input-wrapper__button--decrement', {
                    'dc-input-wrapper__button--disabled': !!min_is_disabled,
                })}
                is_disabled={!!min_is_disabled}
                onClick={decrementValue}
                tabIndex={-1}
                aria-label={'Decrement value'}
                type={type}
            >
                <StandaloneMinusRegularIcon
                    className={'dc-input-wrapper__icon dc-input-wrapper__icon--minus'}
                    fill={min_is_disabled ? 'var(--color-text-disabled)' : 'var(--color-text-primary)'}
                    iconSize='xs'
                />
            </Button>
        </React.Fragment>
    );
};

export default IncrementButtons;
