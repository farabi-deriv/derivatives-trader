import React from 'react';

import { mockStore } from '@deriv/stores';
import { render } from '@testing-library/react';

import useDismissErrorsOnMarketChange from '../useDismissErrorsOnMarketChange';
import useErrorSnackbar, { resetErrorSnackbarDedupe } from '../useErrorSnackbar';

import TraderProviders from '../../../trader-providers';

const mockRemoveSnackbar = jest.fn();
let mock_queue: { id?: string; status?: string; message?: string }[] = [];

jest.mock('@deriv-com/quill-ui', () => ({
    ...jest.requireActual('@deriv-com/quill-ui'),
    useSnackbar: jest.fn(() => ({ queue: mock_queue, addSnackbar: jest.fn(), removeSnackbar: mockRemoveSnackbar })),
}));

describe('useDismissErrorsOnMarketChange', () => {
    let store: ReturnType<typeof mockStore>;

    const Harness = () => {
        useDismissErrorsOnMarketChange();
        return null;
    };

    const renderHook = () =>
        render(
            <TraderProviders store={store}>
                <Harness />
            </TraderProviders>
        );

    beforeEach(() => {
        mockRemoveSnackbar.mockClear();
        mock_queue = [
            { id: 'err-1', status: 'fail', message: 'Please specify either duration or end time.' },
            { id: 'ok-1', status: 'neutral', message: 'Market added' },
        ];
        store = mockStore({ modules: { trade: { ...mockStore({}).modules.trade, symbol: 'R_100' } } });
        store.modules.trade.contract_type = 'rise_fall';
    });

    it('does not dismiss anything on mount — arriving on a tab is not a market change', () => {
        renderHook();

        expect(mockRemoveSnackbar).not.toHaveBeenCalled();
    });

    it('dismisses a fail snackbar when the market changes, leaving other statuses alone', () => {
        const { rerender } = renderHook();

        store.modules.trade.symbol = 'frxXAUUSD';
        rerender(
            <TraderProviders store={store}>
                <Harness />
            </TraderProviders>
        );

        expect(mockRemoveSnackbar).toHaveBeenCalledTimes(1);
        expect(mockRemoveSnackbar).toHaveBeenCalledWith('err-1');
    });

    it('dismisses on a same-symbol trade-type switch too', () => {
        const { rerender } = renderHook();

        store.modules.trade.contract_type = 'high_low';
        rerender(
            <TraderProviders store={store}>
                <Harness />
            </TraderProviders>
        );

        expect(mockRemoveSnackbar).toHaveBeenCalledWith('err-1');
    });

    it('does not dismiss when a re-render carries the same market', () => {
        const { rerender } = renderHook();

        rerender(
            <TraderProviders store={store}>
                <Harness />
            </TraderProviders>
        );

        expect(mockRemoveSnackbar).not.toHaveBeenCalled();
    });

    // Neighbouring trade types reject the same persisted duration with the same sentence, so the
    // incoming tab's error very often reads exactly like the one just retracted. Left in the dedupe
    // record it would be swallowed, and the trader would switch to a tab that cannot trade and be
    // told nothing at all.
    it('forgets what was announced, so the incoming tab can repeat the same wording', () => {
        const SAME_TEXT = 'Enter a duration between 1 and 10 ticks.';
        const announce: { current: ReturnType<typeof useErrorSnackbar> | null } = { current: null };

        const AnnouncingHarness = () => {
            useDismissErrorsOnMarketChange();
            announce.current = useErrorSnackbar();
            return null;
        };
        const renderAnnouncing = () => (
            <TraderProviders store={store}>
                <AnnouncingHarness />
            </TraderProviders>
        );

        resetErrorSnackbarDedupe();
        const { rerender } = render(renderAnnouncing());

        // Tab A speaks, and the same text is refused while that toast is still on screen.
        expect(announce.current?.({ message: SAME_TEXT })).toBe(true);
        expect(announce.current?.({ message: SAME_TEXT })).toBe(false);

        store.modules.trade.contract_type = 'high_low';
        rerender(renderAnnouncing());

        // Tab B's identically-worded error is a new announcement, not a duplicate.
        expect(announce.current?.({ message: SAME_TEXT })).toBe(true);
    });
});
