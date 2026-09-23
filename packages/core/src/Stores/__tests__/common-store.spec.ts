import { configure } from 'mobx';

import { mockStore } from '@deriv/stores';

import CommonStore from '../common-store';

configure({ safeDescriptors: false });

describe('CommonStore.setInitialRouteHistoryItem', () => {
    afterEach(() => {
        window.history.pushState({}, '', '/');
    });

    it('[ABF-010] records the route without throwing when the URL carries ext_platform_url', () => {
        window.history.pushState({}, '', `/?ext_platform_url=${encodeURIComponent('https://example.com/return')}`);
        const store = new CommonStore(mockStore({}));
        const location = { pathname: '/contract/123', action: 'PUSH' };

        expect(() => store.setInitialRouteHistoryItem(location)).not.toThrow();
        expect(store.app_routing_history[0]).toEqual(
            expect.objectContaining({ pathname: '/contract/123', action: 'PUSH' })
        );
    });
});

describe('CommonStore.setServicesError', () => {
    // `isMobile()` from @deriv/shared is a viewport read, so the breakpoint is set directly.
    const MOBILE_WIDTH = 500;
    const DESKTOP_WIDTH = 1440;
    const original_width = window.innerWidth;

    const setViewportWidth = (width: number) =>
        Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });

    const mountStore = () => {
        const root_store = mockStore({});
        return {
            root_store,
            common: new CommonStore(root_store),
            toggleModal: root_store.ui.toggleServicesErrorModal as jest.Mock,
            addToast: root_store.ui.addToast as jest.Mock,
        };
    };

    afterEach(() => setViewportWidth(original_width));

    it('[DCR-053] opens the services-error modal for CompanyWideLimitExceeded on mobile', () => {
        setViewportWidth(MOBILE_WIDTH);
        const { common, toggleModal, addToast } = mountStore();

        common.setServicesError({ code: 'CompanyWideLimitExceeded', message: 'Limit reached.', type: 'buy' });

        expect(toggleModal).toHaveBeenCalledWith(true);
        expect(addToast).not.toHaveBeenCalled();
        expect(common.services_error).toEqual({
            code: 'CompanyWideLimitExceeded',
            message: 'Limit reached.',
            type: 'buy',
        });
    });

    it('[DCR-053] raises a toast rather than the modal for every other code on mobile', () => {
        setViewportWidth(MOBILE_WIDTH);

        ['AuthorizationRequired', 'InsufficientBalance', 'SomeCodeTheApiAddedLater'].forEach(code => {
            const { common, toggleModal, addToast } = mountStore();

            common.setServicesError({ code, message: 'Something went wrong.', type: 'buy' });

            expect(addToast).toHaveBeenCalledWith({ content: 'Something went wrong.', type: 'error' });
            expect(toggleModal).not.toHaveBeenCalled();
        });
    });

    it('[DCR-053] suppresses the mobile toast when the caller asks for it', () => {
        setViewportWidth(MOBILE_WIDTH);
        const { common, toggleModal, addToast } = mountStore();

        common.setServicesError({ code: 'InsufficientBalance', message: 'Not enough funds.' }, true);

        expect(addToast).not.toHaveBeenCalled();
        expect(toggleModal).not.toHaveBeenCalled();
        // The error is still recorded — only the toast is withheld.
        expect(common.services_error).toEqual({ code: 'InsufficientBalance', message: 'Not enough funds.' });
    });

    it('[DCR-053] opens the modal for every code on desktop, toast or not', () => {
        setViewportWidth(DESKTOP_WIDTH);

        ['CompanyWideLimitExceeded', 'AuthorizationRequired', 'SomeCodeTheApiAddedLater'].forEach(code => {
            const { common, toggleModal, addToast } = mountStore();

            common.setServicesError({ code, message: 'Something went wrong.' });

            expect(toggleModal).toHaveBeenCalledWith(true);
            expect(addToast).not.toHaveBeenCalled();
        });
    });

    it('[DCR-053] resetServicesError clears the stored error', () => {
        const { common } = mountStore();
        common.setServicesError({ code: 'InsufficientBalance', message: 'Not enough funds.' });

        common.resetServicesError();

        expect(common.services_error).toEqual({});
    });
});

describe('CommonStore.showError', () => {
    it('[TSH-001] the kept CommonStore.showError still routes through setError for its live caller', () => {
        const common = new CommonStore(mockStore());

        common.showError({ message: 'Trading is unavailable at this time.' });

        expect(common.has_error).toBe(true);
        expect(common.error.type).toBe('error');
        expect(common.error.message).toBe('Trading is unavailable at this time.');
    });
});
