import React from 'react';

import { CONTRACT_TYPES, TRADE_TYPES } from '@deriv/shared';
import { mockStore } from '@deriv/stores';
import { render } from '@testing-library/react';

import { resetErrorSnackbarDedupe } from 'AppV2/Hooks/useErrorSnackbar';
import ModulesProvider from 'Stores/Providers/modules-providers';

import TraderProviders from '../../../../trader-providers';
import PurchaseButton from '../../PurchaseButton/purchase-button';
import TradeErrorSnackbar from '../trade-error-snackbar';

const mockAddSnackbar = jest.fn();
jest.mock('@deriv-com/quill-ui', () => ({
    ...jest.requireActual('@deriv-com/quill-ui'),
    useSnackbar: jest.fn(() => ({ addSnackbar: mockAddSnackbar })),
}));
jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    WS: { authorized: { send: jest.fn(() => Promise.resolve({})) }, send: jest.fn(() => Promise.resolve({})) },
}));
jest.mock('AppV2/Hooks/useContractsFor', () => ({
    __esModule: true,
    default: jest.fn(() => [{ text: 'Turbos', value: 'turboslong' }]),
}));

const ERROR_TEXT = 'Enter an amount equal to or lower than 1701.11.';
const ERROR_FIELDS = ['stop_loss', 'take_profit', 'date_start', 'stake', 'amount'] as const;

/**
 * Issue #1319. Several components watch `proposal_info` and each reports the error it finds, all
 * deriving the SAME sentence: `PurchaseButton` for any error, `TradeErrorSnackbar` for a
 * field-tagged one, `ServicesErrorSnackbar` for a field-less one, plus `Duration` and `Barrier`.
 * `PurchaseButton` pairs with every one of them — it filters only `MarketIsClosed`.
 *
 * quill does not dedupe: `addSnackbar` appends with a fresh id and `SnackbarController` renders
 * `queue.slice(0, 1)`, so two enqueues are not one toast — they are two full-length toasts played
 * back to back. That is what reads as the error showing, being dismissed, then coming right back.
 *
 * A guard local to a single component cannot see the others, which is why two earlier attempts at
 * this bug did not fix it. What matters here is the number of ENQUEUES, which is invisible in the
 * painted DOM (only the head of the queue renders), so these specs count `addSnackbar` calls.
 */
describe('one error, one enqueue (across producers)', () => {
    let default_mock_store: ReturnType<typeof mockStore>;

    beforeEach(() => {
        resetErrorSnackbarDedupe();
        mockAddSnackbar.mockClear();
        default_mock_store = mockStore({
            client: { is_logged_in: true },
            modules: {
                trade: {
                    contract_type: TRADE_TYPES.TURBOS.LONG,
                    proposal_info: {
                        [CONTRACT_TYPES.TURBOS.LONG]: {
                            has_error: true,
                            has_error_details: false,
                            error_code: 'ContractBuyValidationError',
                            error_field: 'take_profit',
                            message: ERROR_TEXT,
                        },
                    },
                    validation_errors: {
                        amount: [],
                        barrier_1: [],
                        barrier_2: [],
                        duration: [],
                        expiry_date: [],
                        expiry_time: [],
                        start_date: [],
                        start_time: [],
                        stop_loss: [],
                        take_profit: [],
                    },
                    trade_type_tab: CONTRACT_TYPES.TURBOS.LONG,
                    trade_types: { [CONTRACT_TYPES.TURBOS.LONG]: 'Turbos Long' },
                },
            },
        });
    });

    const renderTradePageProducers = () =>
        render(
            <TraderProviders store={default_mock_store}>
                <ModulesProvider store={default_mock_store}>
                    {/* Both are mounted together on the real trade page. */}
                    <PurchaseButton />
                    <TradeErrorSnackbar error_fields={[...ERROR_FIELDS]} should_show_snackbar />
                </ModulesProvider>
            </TraderProviders>
        );

    it('enqueues one toast when the Buy button and the trade-error snackbar both report it', () => {
        renderTradePageProducers();

        expect(mockAddSnackbar).toHaveBeenCalledTimes(1);
        expect(mockAddSnackbar).toHaveBeenCalledWith(expect.objectContaining({ message: ERROR_TEXT }));
    });

    it('still enqueues nothing more when only one producer is mounted', () => {
        render(
            <TraderProviders store={default_mock_store}>
                <TradeErrorSnackbar error_fields={[...ERROR_FIELDS]} should_show_snackbar />
            </TraderProviders>
        );

        expect(mockAddSnackbar).toHaveBeenCalledTimes(1);
    });
});
