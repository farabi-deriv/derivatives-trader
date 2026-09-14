import React from 'react';
import ReactDOM from 'react-dom';
import { CSSTransition } from 'react-transition-group';
import classNames from 'classnames';

import { LegacyClose2pxIcon } from '@deriv/quill-icons';

import { useOnClickOutside } from '../../hooks';
import Text from '../text/text';

import Body from './modal-body';
import Footer from './modal-footer';

type TModalElement = {
    className?: string;
    has_close_icon?: boolean;
    height?: string;
    id?: string;
    is_open: boolean;
    is_vertical_centered?: boolean;
    should_close_on_click_outside?: boolean;
    should_header_stick_body?: boolean;
    small?: boolean;
    title?: string | React.ReactNode;
    toggleModal?: (e?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void;
    width?: string;
};

const ModalElement = React.forwardRef<HTMLDivElement, React.PropsWithChildren<TModalElement>>(
    (
        {
            children,
            className,
            has_close_icon = true,
            height,
            id,
            is_open,
            is_vertical_centered,
            should_close_on_click_outside,
            should_header_stick_body = true,
            small,
            title,
            toggleModal,
            width,
        },
        ref
    ) => {
        const el_ref = React.useRef(document.createElement('div'));
        const modal_root_ref = React.useRef(document.getElementById('modal_root'));
        const wrapper_ref = React.useRef<HTMLDivElement>(null);

        const portal_elements_selector = [
            '.dc-datepicker__picker',
            '.dc-mobile-dialog',
            '.dc-dropdown-list',
            '.dc-dropdown__list',
        ];

        const isPortalElementVisible = () =>
            modal_root_ref.current?.querySelectorAll(portal_elements_selector.join(', ')).length;

        const validateClickOutside = (): boolean => {
            const is_absolute_modal_visible = document.getElementById('popup_root')?.hasChildNodes();
            return (
                should_close_on_click_outside ||
                (has_close_icon && !isPortalElementVisible() && is_open && !is_absolute_modal_visible)
            );
        };

        const closeModal = () => {
            if (is_open) toggleModal?.();
        };

        useOnClickOutside(wrapper_ref, closeModal, validateClickOutside);

        React.useEffect(() => {
            const local_el_ref = el_ref;
            const local_modal_root_ref = modal_root_ref;

            local_el_ref.current.classList.add('dc-modal');
            local_modal_root_ref?.current?.appendChild?.(local_el_ref.current);

            return () => {
                local_modal_root_ref?.current?.removeChild?.(local_el_ref.current);
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);
        const closeOnEscButton = React.useCallback(
            (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    toggleModal?.();
                }
            },
            [toggleModal]
        );
        React.useEffect(() => {
            window.addEventListener('keydown', closeOnEscButton);
            return () => window.removeEventListener('keydown', closeOnEscButton);
        }, [closeOnEscButton]);

        return ReactDOM.createPortal(
            <div
                ref={node => {
                    (wrapper_ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
                    if (ref) {
                        if (typeof ref === 'function') {
                            ref(node);
                        } else {
                            (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
                        }
                    }
                }}
                id={id}
                className={classNames('dc-modal__container', {
                    [`dc-modal__container_${className}`]: className,
                    'dc-modal__container--small': small,
                    'dc-modal__container--is-vertical-centered': is_vertical_centered,
                })}
                style={{
                    height: height || 'auto',
                    width: width || 'auto',
                }}
            >
                {title && (
                    <div
                        className={classNames('dc-modal-header', {
                            'dc-modal-header__border-bottom': !should_header_stick_body,
                            [`dc-modal-header--${className}`]: className,
                        })}
                    >
                        <Text
                            as='h3'
                            color='primary'
                            weight='bold'
                            styles={{ lineHeight: '2.4rem' }}
                            className={classNames('dc-modal-header__title', {
                                [`dc-modal-header__title--${className}`]: className,
                            })}
                        >
                            {title}
                        </Text>
                        {has_close_icon && (
                            <div onClick={toggleModal} className='dc-modal-header__close' role='button'>
                                <LegacyClose2pxIcon
                                    fill='var(--color-text-primary)'
                                    iconSize='xs'
                                    data-testid='dt_modal_close_icon'
                                />
                            </div>
                        )}
                    </div>
                )}
                {children}
            </div>,
            el_ref.current
        );
    }
);

ModalElement.displayName = 'ModalElement';

const Modal = ({
    children,
    className,
    has_close_icon = true,
    height,
    id,
    is_open,
    is_vertical_centered,
    should_close_on_click_outside = false,
    should_header_stick_body = true,
    small,
    title,
    toggleModal,
    width,
}: React.PropsWithChildren<TModalElement>) => {
    const nodeRef = React.useRef(null);

    return (
        <CSSTransition
            appear
            in={is_open}
            timeout={250}
            classNames={{
                appear: 'dc-modal__container--enter',
                enter: 'dc-modal__container--enter',
                enterDone: 'dc-modal__container--enter-done',
                exit: 'dc-modal__container--exit',
            }}
            unmountOnExit
            nodeRef={nodeRef}
        >
            <ModalElement
                ref={nodeRef}
                className={className}
                should_header_stick_body={should_header_stick_body}
                id={id}
                is_open={is_open}
                is_vertical_centered={is_vertical_centered}
                title={title}
                toggleModal={toggleModal}
                has_close_icon={has_close_icon}
                height={height}
                should_close_on_click_outside={should_close_on_click_outside}
                small={small}
                width={width}
            >
                {children}
            </ModalElement>
        </CSSTransition>
    );
};

Modal.Body = Body;
Modal.Footer = Footer;

export default Modal;
