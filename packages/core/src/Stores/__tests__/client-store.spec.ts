import { configure } from 'mobx';

import { mockStore } from '@deriv/stores';

import ClientStore from '../client-store';

configure({ safeDescriptors: false });

describe('ClientStore dead cookie cluster removal', () => {
    it('[ABF-012] no longer exposes setEmail, setCookieAccount, has_cookie_account or email', () => {
        const store = new ClientStore(mockStore({}));

        expect(store.setEmail).toBeUndefined();
        expect(store.setCookieAccount).toBeUndefined();
        expect(store.has_cookie_account).toBeUndefined();
        expect(store.email).toBeUndefined();
    });
});
