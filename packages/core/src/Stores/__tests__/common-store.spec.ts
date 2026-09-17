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
