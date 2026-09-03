import React from 'react';
import { useLocation } from 'react-router';

import { CONTRACT_TYPES, TRADE_TYPES } from '@deriv/shared';
import { mockStore } from '@deriv/stores';
import { useSnackbar } from '@deriv-com/quill-ui';
import { render } from '@testing-library/react';

import { resetErrorSnackbarDedupe } from 'AppV2/Hooks/useErrorSnackbar';
import { ERROR_SNACKBAR_DURATION, getErrorSnackbarBottomOffset, SERVICE_ERROR } from 'AppV2/Utils/layout-utils';

import TraderProviders from '../../../../trader-providers';
import ServicesErrorSnackbar from '../services-error-snackbar';

jest.mock('@deriv-com/quill-ui', () => ({
    ...jest.requireActual('@deriv-com/quill-ui'),
    useSnackbar: jest.fn(),
}));
jest.mock('react-router', () => ({
    useLocation: jest.fn(),
}));

describe('ServicesErrorSnackbar', () => {
    let default_mock_store: ReturnType<typeof mockStore>;
    let mockAddSnackbar = jest.fn();

    beforeEach(() => {
        // The dedupe record in useErrorSnackbar is module scope, so it outlives a single render.
        resetErrorSnackbarDedupe();
        default_mock_store = mockStore({
            client: { is_logged_in: true },
            common: {
                services_error: {
                    code: 'SomeAwesomeError',
                    message: 'Mock error message',
                    type: 'buy',
                },
                resetServicesError: jest.fn(),
            },
        });
        mockAddSnackbar = jest.fn();
        (useSnackbar as jest.Mock).mockReturnValue({ addSnackbar: mockAddSnackbar });
    });

    const mockServicesErrorSnackbar = () => {
        return (
            <TraderProviders store={default_mock_store}>
                <ServicesErrorSnackbar />
            </TraderProviders>
        );
    };

    it('calls useSnackbar if it is trading page, there is a services_error and it is not a modal error', () => {
        (useLocation as jest.Mock).mockReturnValue({
            pathname: '/',
        });
        render(mockServicesErrorSnackbar());

        expect(mockAddSnackbar).toHaveBeenCalled();
    });

    it('passes an auto-dismiss delay to addSnackbar so the error toast does not persist forever', () => {
        (useLocation as jest.Mock).mockReturnValue({
            pathname: '/',
        });
        render(mockServicesErrorSnackbar());

        expect(mockAddSnackbar).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'fail',
                delay: ERROR_SNACKBAR_DURATION,
            })
        );
    });

    it('positions the trade-page toast clear of the Buy button', () => {
        (useLocation as jest.Mock).mockReturnValue({
            pathname: '/',
        });
        render(mockServicesErrorSnackbar());

        expect(mockAddSnackbar).toHaveBeenCalledWith(
            expect.objectContaining({
                style: expect.objectContaining({
                    marginBottom: getErrorSnackbarBottomOffset({ pathname: '/', is_logged_in: true }),
                }),
            })
        );
    });

    it('calls useSnackbar if it is a company wide limit error', () => {
        (useLocation as jest.Mock).mockReturnValue({
            pathname: '/',
        });
        default_mock_store.common.services_error = {
            code: SERVICE_ERROR.COMPANY_WIDE_LIMIT_EXCEEDED,
            message: 'Mock error message',
            type: 'buy',
        };
        render(mockServicesErrorSnackbar());

        expect(mockAddSnackbar).toHaveBeenCalled();
    });

    it('calls useSnackbar if it is trading page and there is an error without error_field in proposal_info and arrays in validation_errors are empty', () => {
        (useLocation as jest.Mock).mockReturnValue({
            pathname: '/',
        });
        default_mock_store.common.services_error = {};
        default_mock_store.modules.trade = {
            proposal_info: {
                [CONTRACT_TYPES.MULTIPLIER.UP]: {
                    id: '',
                    has_error: true,
                    has_error_details: false,
                    error_code: 'ContractBuyValidationError',
                    message: 'This trade is temporarily unavailable.',
                    obj_contract_basis: {
                        text: '',
                        value: '',
                    },
                },
            },
            trade_types: {
                [CONTRACT_TYPES.MULTIPLIER.DOWN]: 'Multiply Down',
                [CONTRACT_TYPES.MULTIPLIER.UP]: 'Multiply Up',
            },
            contract_type: TRADE_TYPES.MULTIPLIER,
            trade_type_tab: '',
            validation_errors: {
                stop_loss: [],
                take_profit: [],
                amount: [],
                barrier_1: [],
                barrier_2: [],
                duration: [],
                start_date: [],
                start_time: [],
                expiry_date: [],
                expiry_time: [],
            },
        };
        render(mockServicesErrorSnackbar());

        expect(mockAddSnackbar).toHaveBeenCalled();
    });

    it('calls useSnackbar if it is positions page and there is a services_error', () => {
        (useLocation as jest.Mock).mockReturnValue({
            pathname: '/positions',
        });
        render(mockServicesErrorSnackbar());

        expect(mockAddSnackbar).toHaveBeenCalled();
    });

    it('does not call useSnackbar if it is reports page and there is a services_error', () => {
        (useLocation as jest.Mock).mockReturnValue({
            pathname: '/reports',
        });
        render(mockServicesErrorSnackbar());

        expect(mockAddSnackbar).not.toHaveBeenCalled();
    });

    it('does not call useSnackbar if there is no services_error', () => {
        default_mock_store.common.services_error = {};
        render(mockServicesErrorSnackbar());

        expect(mockAddSnackbar).not.toHaveBeenCalled();
    });

    // Dismissing this toast runs `onSnackbarRemove: resetServicesError`, which clears the store and
    // flips the gate true→false; while the condition is still live it flips straight back, and the
    // effect ran again for the same text (issue #1319). useErrorSnackbar suppresses that, and also
    // the copy PurchaseButton raises for a field-less proposal error off the same response. Each step
    // supplies a NEW store object — the mock store is not observable, so mutating it in place would
    // not re-render.
    it('does not re-announce the same text when a reset flips the gate back', () => {
        const ERROR = { code: 'SomeAwesomeError', message: 'Mock error message', type: 'buy' };
        const storeWith = (services_error: Record<string, unknown>) =>
            mockStore({
                client: { is_logged_in: true },
                common: { services_error: services_error as never, resetServicesError: jest.fn() },
            });
        const renderWith = (store: ReturnType<typeof mockStore>) => (
            <TraderProviders store={store}>
                <ServicesErrorSnackbar />
            </TraderProviders>
        );
        (useLocation as jest.Mock).mockReturnValue({ pathname: '/' });

        const { rerender } = render(renderWith(storeWith(ERROR)));
        expect(mockAddSnackbar).toHaveBeenCalledTimes(1);

        rerender(renderWith(storeWith({}))); // the reset a dismissal performs
        rerender(renderWith(storeWith(ERROR))); // …the condition is still live

        expect(mockAddSnackbar).toHaveBeenCalledTimes(1);
    });
});
