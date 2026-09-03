import React from 'react';
import { observable, runInAction } from 'mobx';

import { mockStore } from '@deriv/stores';
import { act, render } from '@testing-library/react';

import TraderProviders from '../../../../trader-providers';
import Trade from '../trade';

const mockRemoveSnackbar = jest.fn();
let mock_queue: { id?: string; status?: string; message?: string }[] = [];

jest.mock('@deriv-com/quill-ui', () => ({
    ...jest.requireActual('@deriv-com/quill-ui'),
    useSnackbar: jest.fn(() => ({ queue: mock_queue, addSnackbar: jest.fn(), removeSnackbar: mockRemoveSnackbar })),
}));

// The container's children pull in the whole trade page; none of it is what this spec is about.
const TradeMobileStub = () => <div>trade mobile</div>;
const TradeDesktopStub = () => <div>trade desktop</div>;
jest.mock('../trade-mobile', () => ({ __esModule: true, default: () => <TradeMobileStub /> }));
jest.mock('../trade-desktop', () => ({ __esModule: true, default: () => <TradeDesktopStub /> }));
jest.mock('AppV2/Components/ServiceErrorSheet', () => () => null);
jest.mock('AppV2/Hooks/useProposalReconnectReset', () => ({ __esModule: true, default: jest.fn() }));

/**
 * `useDismissErrorsOnMarketChange` reads `symbol`/`contract_type` through `useTraderStore`, which is
 * a bare `useContext` carrying no reactivity of its own. It therefore only sees a market change if
 * the component calling it re-renders when the store does — i.e. only if `Trade` is an `observer`.
 *
 * The hook's own spec drives re-renders by hand, so it passes either way; this one mutates a real
 * MobX observable and lets React decide, which is the thing that actually broke in production
 * (the toast kept covering Buy after a tab switch, issue #1246).
 */
describe('Trade reacts to a market change', () => {
    let store: ReturnType<typeof mockStore>;

    beforeEach(() => {
        mockRemoveSnackbar.mockClear();
        mock_queue = [
            { id: 'err-1', status: 'fail', message: 'Please specify either duration or end time.' },
            { id: 'ok-1', status: 'neutral', message: 'Market added' },
        ];
        store = mockStore({});
        // A genuinely observable slice, so tracking is what makes the re-render happen — not a
        // manual rerender() call.
        store.modules.trade = observable({
            ...store.modules.trade,
            symbol: 'R_100',
            contract_type: 'rise_fall',
        }) as never;
    });

    const renderTrade = () =>
        render(
            <TraderProviders store={store}>
                <Trade />
            </TraderProviders>
        );

    it('retracts the error toast when the symbol changes', () => {
        renderTrade();
        expect(mockRemoveSnackbar).not.toHaveBeenCalled();

        act(() => {
            runInAction(() => {
                store.modules.trade.symbol = 'R_25';
            });
        });

        expect(mockRemoveSnackbar).toHaveBeenCalledWith('err-1');
        // Success/info toasts are somebody else's business.
        expect(mockRemoveSnackbar).not.toHaveBeenCalledWith('ok-1');
    });

    it('retracts the error toast when the trade type changes', () => {
        renderTrade();

        act(() => {
            runInAction(() => {
                store.modules.trade.contract_type = 'high_low';
            });
        });

        expect(mockRemoveSnackbar).toHaveBeenCalledWith('err-1');
    });

    it('leaves the toast alone while the market stays put', () => {
        renderTrade();

        act(() => {
            runInAction(() => {
                store.modules.trade.symbol = 'R_100';
            });
        });

        expect(mockRemoveSnackbar).not.toHaveBeenCalled();
    });
});
