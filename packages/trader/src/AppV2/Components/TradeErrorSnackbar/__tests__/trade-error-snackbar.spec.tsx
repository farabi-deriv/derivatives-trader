import React from 'react';

import { CONTRACT_TYPES, routes, TRADE_TYPES } from '@deriv/shared';
import { mockStore } from '@deriv/stores';
import { useSnackbar } from '@deriv-com/quill-ui';
import { render } from '@testing-library/react';

import { resetErrorSnackbarDedupe } from 'AppV2/Hooks/useErrorSnackbar';
import { ERROR_SNACKBAR_DURATION, getErrorSnackbarBottomOffset } from 'AppV2/Utils/layout-utils';

import TraderProviders from '../../../../trader-providers';
import TradeErrorSnackbar from '../trade-error-snackbar';

jest.mock('@deriv-com/quill-ui', () => ({
    ...jest.requireActual('@deriv-com/quill-ui'),
    useSnackbar: jest.fn(),
}));

describe('TradeErrorSnackbar', () => {
    let default_mock_store: ReturnType<typeof mockStore>,
        default_mock_props: React.ComponentProps<typeof TradeErrorSnackbar>;
    let mockAddSnackbar = jest.fn();

    beforeEach(() => {
        // The dedupe record in useErrorSnackbar is module scope, so it outlives a single render.
        resetErrorSnackbarDedupe();
        default_mock_store = mockStore({
            client: { is_logged_in: true },
            modules: {
                trade: {
                    contract_type: TRADE_TYPES.TURBOS.LONG,
                    proposal_info: {
                        TURBOSLONG: {
                            has_error: true,
                            has_error_details: false,
                            error_code: 'ContractBuyValidationError',
                            error_field: 'take_profit',
                            message: 'Enter an amount equal to or lower than 1701.11.',
                        },
                    },
                    validation_errors: {
                        amount: [],
                        barrier_1: [],
                        barrier_2: [],
                        duration: [],
                        start_date: [],
                        start_time: [],
                        stop_loss: [],
                        take_profit: [],
                        expiry_date: [],
                        expiry_time: [],
                    },
                    trade_type_tab: CONTRACT_TYPES.TURBOS.LONG,
                    trade_types: {
                        [CONTRACT_TYPES.TURBOS.LONG]: 'Turbos Long',
                    },
                },
            },
        });
        default_mock_props = { error_fields: ['take_profit', 'stop_loss'], should_show_snackbar: true };
        mockAddSnackbar = jest.fn();
        (useSnackbar as jest.Mock).mockReturnValue({ addSnackbar: mockAddSnackbar });
    });

    const mockTradeErrorSnackbar = () => {
        return (
            <TraderProviders store={default_mock_store}>
                <TradeErrorSnackbar {...default_mock_props} />
            </TraderProviders>
        );
    };

    it('calls useSnackbar if error field in proposal matches the passed error_fields', () => {
        render(mockTradeErrorSnackbar());

        expect(mockAddSnackbar).toHaveBeenCalled();
    });

    // Switching market tab wipes and refills proposal_info, so the gate flips true -> false -> true
    // for what is still the same error; re-announcing there is what made a dismissed toast come back
    // (issue #1319). The suppression itself lives in useErrorSnackbar — which also covers the copies
    // PurchaseButton and ServicesErrorSnackbar raise off the same response, something no guard local
    // to this component could see. The mock store is not observable, so each step supplies a NEW
    // store object; mutating in place would not make the component re-read.
    it('does not re-announce the same error when the proposal is wiped and refilled', () => {
        const storeWith = (proposal_info: Record<string, unknown>) => {
            const store = mockStore({ client: { is_logged_in: true } });
            store.modules.trade = { ...default_mock_store.modules.trade, proposal_info } as never;
            return store;
        };
        const renderWith = (store: ReturnType<typeof mockStore>) => (
            <TraderProviders store={store}>
                <TradeErrorSnackbar {...default_mock_props} />
            </TraderProviders>
        );
        const errored_info = () => ({
            TURBOSLONG: {
                has_error: true,
                has_error_details: false,
                error_code: 'ContractBuyValidationError',
                error_field: 'take_profit',
                message: 'Enter an amount equal to or lower than 1701.11.',
            },
        });

        const { rerender } = render(renderWith(storeWith(errored_info())));
        expect(mockAddSnackbar).toHaveBeenCalledTimes(1);

        rerender(renderWith(storeWith({}))); // the wipe a tab switch performs
        rerender(renderWith(storeWith(errored_info()))); // …and the same error refilled

        expect(mockAddSnackbar).toHaveBeenCalledTimes(1);
    });

    it('passes an auto-dismiss delay to addSnackbar so the error toast does not persist forever', () => {
        render(mockTradeErrorSnackbar());

        expect(mockAddSnackbar).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'fail',
                delay: ERROR_SNACKBAR_DURATION,
            })
        );
    });

    it('positions the toast clear of the Buy button', () => {
        render(mockTradeErrorSnackbar());

        expect(mockAddSnackbar).toHaveBeenCalledWith(
            expect.objectContaining({
                style: expect.objectContaining({
                    marginBottom: getErrorSnackbarBottomOffset({ pathname: routes.index, is_logged_in: true }),
                }),
            })
        );
    });

    it('does not render its own SnackbarController (the app-root controller renders the queue)', () => {
        const { container } = render(mockTradeErrorSnackbar());

        expect(container).toBeEmptyDOMElement();
    });

    it('calls useSnackbar if error field in proposal matches the passed error_fields even if user is log out', () => {
        default_mock_store.client.is_logged_in = false;
        render(mockTradeErrorSnackbar());

        expect(mockAddSnackbar).toHaveBeenCalled();
    });

    it('does not call useSnackbar if error field in proposal does not matches the passed error_fields', () => {
        default_mock_store.modules.trade.proposal_info = {
            TURBOSLONG: {
                has_error: true,
                has_error_details: false,
                error_code: 'ContractBuyValidationError',
                error_field: 'new_trade_param',
                message: 'Enter an amount equal to or lower than 1701.11.',
            },
        };
        render(mockTradeErrorSnackbar());

        expect(mockAddSnackbar).not.toHaveBeenCalled();
    });
});
