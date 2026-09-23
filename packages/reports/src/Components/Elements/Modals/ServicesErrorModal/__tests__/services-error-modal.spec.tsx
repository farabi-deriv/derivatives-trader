import React from 'react';
import { render, screen } from '@testing-library/react';
import { Modal } from '@deriv/components';
import ServicesErrorModal from '../services-error-modal';
import AuthorizationRequiredModal from '../authorization-required-modal';
import CompanyWideLimitExceededModal from '../company-wide-limit-exceeded-modal';
import InsufficientBalanceModal from '../insufficient-balance-modal';

jest.mock('../authorization-required-modal', () => jest.fn(() => 'AuthorizationRequiredModal'));
jest.mock('../insufficient-balance-modal', () => jest.fn(() => 'InsufficientBalanceModal'));
jest.mock('../company-wide-limit-exceeded-modal', () => jest.fn(() => 'CompanyWideLimitExceededModal'));

type TModal = {
    (): JSX.Element;
    Body?: React.FC;
    Footer?: React.FC;
};
jest.mock('@deriv/components', () => {
    const original_module = jest.requireActual('@deriv/components');
    const Modal: TModal = jest.fn(() => <div>Modal</div>);
    Modal.Body = jest.fn(() => <div />);
    Modal.Footer = jest.fn(() => <div />);
    return {
        ...original_module,
        Modal,
    };
});

describe('<ServicesErrorModal />', () => {
    const modal_props = {
        is_visible: true,
        onConfirm: jest.fn(),
        is_logged_in: true,
    };
    it('Should return null if code or message is missing', () => {
        const services_error_mock = {
            code: '',
            message: '',
            type: '',
        };
        const { container } = render(
            <ServicesErrorModal services_error={services_error_mock} {...modal_props} is_logged_in is_virtual />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('AuthorizationRequiredModal should render when code is AuthorizationRequired', () => {
        const services_error_mock = {
            code: 'AuthorizationRequired',
            message: 'AuthorizationRequired',
            type: '',
        };
        render(<ServicesErrorModal services_error={services_error_mock} {...modal_props} is_logged_in />);
        expect(screen.getByText('AuthorizationRequiredModal')).toBeInTheDocument();
    });

    it('InsufficientBalanceModal should render when code is InsufficientBalance', () => {
        const services_error_mock = {
            code: 'InsufficientBalance',
            message: 'InsufficientBalance',
            type: '',
        };
        render(<ServicesErrorModal services_error={services_error_mock} {...modal_props} is_virtual />);
        expect(screen.getByText('InsufficientBalanceModal')).toBeInTheDocument();
    });

    it('CompanyWideLimitExceededModal should render when code is CompanyWideLimitExceeded', () => {
        const services_error_mock = {
            code: 'CompanyWideLimitExceeded',
            message: 'CompanyWideLimitExceeded',
            type: '',
        };
        render(<ServicesErrorModal services_error={services_error_mock} {...modal_props} />);
        expect(screen.getByText('CompanyWideLimitExceededModal')).toBeInTheDocument();
    });

    it('Default case should render when code is not specified in switch case', () => {
        const services_error_mock = {
            code: 'Default Error',
            message: 'Default Error',
            title: 'Default Error',
            type: '',
        };
        render(<ServicesErrorModal services_error={services_error_mock} {...modal_props} />);
        expect(screen.getByText('Modal')).toBeInTheDocument();
    });

    // The services-error surface is fed only by `buy`, `sell`, `cancel` and `contract_update`, none
    // of which can report POI/POA status — so these four are the whole switch, and each one must
    // keep receiving the props it did before the unreachable arm was dropped.
    describe('[DCR-053] the surviving services-error branches', () => {
        const propsOfLastRender = (component: unknown) =>
            (component as jest.Mock).mock.calls[(component as jest.Mock).mock.calls.length - 1][0];

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('[DCR-053] routes every remaining code to its own modal and an unknown code to the generic one', () => {
            const branches = [
                { code: 'AuthorizationRequired', rendered: 'AuthorizationRequiredModal' },
                { code: 'InsufficientBalance', rendered: 'InsufficientBalanceModal' },
                { code: 'CompanyWideLimitExceeded', rendered: 'CompanyWideLimitExceededModal' },
                { code: 'SomeCodeTheApiAddedLater', rendered: 'Modal' },
            ];

            branches.forEach(({ code, rendered }) => {
                const { unmount } = render(
                    <ServicesErrorModal
                        services_error={{ code, message: `${code} happened`, type: 'buy' }}
                        {...modal_props}
                    />
                );
                expect(screen.getByText(rendered)).toBeInTheDocument();
                unmount();
            });
        });

        it('[DCR-053] hands AuthorizationRequiredModal the login state and the confirm handler', () => {
            render(
                <ServicesErrorModal
                    services_error={{ code: 'AuthorizationRequired', message: 'Please log in.', type: 'sell' }}
                    {...modal_props}
                    is_logged_in={false}
                />
            );

            expect(propsOfLastRender(AuthorizationRequiredModal)).toEqual(
                expect.objectContaining({
                    is_logged_in: false,
                    is_visible: true,
                    toggleModal: modal_props.onConfirm,
                })
            );
        });

        it('[DCR-053] hands InsufficientBalanceModal the mapped message and the virtual flag', () => {
            render(
                <ServicesErrorModal
                    services_error={{ code: 'InsufficientBalance', message: 'Your balance is too low.', type: 'buy' }}
                    {...modal_props}
                    is_virtual
                />
            );

            expect(propsOfLastRender(InsufficientBalanceModal)).toEqual(
                expect.objectContaining({
                    is_virtual: true,
                    is_visible: true,
                    message: 'Your balance is too low.',
                    toggleModal: modal_props.onConfirm,
                })
            );
        });

        it('[DCR-053] keeps CompanyWideLimitExceeded on its own modal rather than the generic one', () => {
            render(
                <ServicesErrorModal
                    services_error={{ code: 'CompanyWideLimitExceeded', message: 'Limit reached.', type: 'buy' }}
                    {...modal_props}
                />
            );

            expect(propsOfLastRender(CompanyWideLimitExceededModal)).toEqual(
                expect.objectContaining({ is_visible: true, onConfirm: modal_props.onConfirm })
            );
            expect(Modal).not.toHaveBeenCalled();
        });

        it('[DCR-053] titles the generic modal from the error type and renders nothing without a code', () => {
            const { unmount } = render(
                <ServicesErrorModal
                    services_error={{
                        code: 'SomeCodeTheApiAddedLater',
                        message: 'Unexpected.',
                        type: 'contract_update',
                    }}
                    {...modal_props}
                />
            );
            expect(propsOfLastRender(Modal)).toEqual(
                expect.objectContaining({
                    is_open: true,
                    small: true,
                    title: 'Contract Update Error',
                    toggleModal: modal_props.onConfirm,
                })
            );
            unmount();

            const { container } = render(
                <ServicesErrorModal services_error={{ code: '', message: '', type: '' }} {...modal_props} />
            );
            expect(container).toBeEmptyDOMElement();
        });
    });
});
