import React from 'react';

import { useSnackbar } from '@deriv-com/quill-ui';
import { renderHook } from '@testing-library/react-hooks';

import { ERROR_SNACKBAR_DURATION } from 'AppV2/Utils/layout-utils';

import useErrorSnackbar, { resetErrorSnackbarDedupe } from '../useErrorSnackbar';

jest.mock('@deriv-com/quill-ui', () => ({
    ...jest.requireActual('@deriv-com/quill-ui'),
    useSnackbar: jest.fn(),
}));

describe('useErrorSnackbar', () => {
    let mockAddSnackbar = jest.fn();

    beforeEach(() => {
        resetErrorSnackbarDedupe();
        mockAddSnackbar = jest.fn();
        (useSnackbar as jest.Mock).mockReturnValue({ addSnackbar: mockAddSnackbar });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('applies the standard error-toast shape so every producer looks the same', () => {
        const { result } = renderHook(() => useErrorSnackbar());
        result.current({ message: 'Enter an amount equal to or lower than 1701.11.' });

        expect(mockAddSnackbar).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Enter an amount equal to or lower than 1701.11.',
                status: 'fail',
                hasCloseButton: true,
                hasFixedHeight: false,
                delay: ERROR_SNACKBAR_DURATION,
            })
        );
    });

    it('lets the caller override the defaults', () => {
        const onSnackbarRemove = jest.fn();
        const { result } = renderHook(() => useErrorSnackbar());
        result.current({ message: 'Company wide limit exceeded', onSnackbarRemove, hasFixedHeight: true });

        expect(mockAddSnackbar).toHaveBeenCalledWith(
            expect.objectContaining({ hasFixedHeight: true, onSnackbarRemove })
        );
    });

    // The bug this hook exists for: quill appends every enqueue with a fresh id and renders
    // queue.slice(0, 1), so two enqueues of one sentence are two sequential toasts, not one.
    it('announces a repeated message only once, even from separate consumers', () => {
        const first = renderHook(() => useErrorSnackbar());
        const second = renderHook(() => useErrorSnackbar());

        expect(first.result.current({ message: 'Minimum stake of 0.35.' })).toBe(true);
        expect(second.result.current({ message: 'Minimum stake of 0.35.' })).toBe(false);

        expect(mockAddSnackbar).toHaveBeenCalledTimes(1);
    });

    it('announces a differently worded message', () => {
        const { result } = renderHook(() => useErrorSnackbar());
        result.current({ message: 'Minimum stake of 0.35.' });
        result.current({ message: 'Maximum payout of 50000.00.' });

        expect(mockAddSnackbar).toHaveBeenCalledTimes(2);
    });

    it('announces the same message again once its toast has come and gone', () => {
        const now = Date.now();
        const date_spy = jest.spyOn(Date, 'now').mockReturnValue(now);
        const { result } = renderHook(() => useErrorSnackbar());

        result.current({ message: 'Minimum stake of 0.35.' });
        date_spy.mockReturnValue(now + ERROR_SNACKBAR_DURATION + 1000);
        result.current({ message: 'Minimum stake of 0.35.' });

        expect(mockAddSnackbar).toHaveBeenCalledTimes(2);
    });

    // String(element) is '[object Object]' for every element, so keying on it would silence
    // unrelated errors rather than duplicate ones.
    it('never dedupes non-string messages', () => {
        const { result } = renderHook(() => useErrorSnackbar());
        const message = <span>Choose an end time at least 5 minutes from now.</span>;

        result.current({ message });
        result.current({ message });

        expect(mockAddSnackbar).toHaveBeenCalledTimes(2);
    });
});
