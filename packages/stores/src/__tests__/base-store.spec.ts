import type { TStores } from '../../types';
import BaseStore from '../base-store';
import * as StoresIndex from '../index';

const getRootStore = () => ({ client: {}, common: {} }) as unknown as TStores;

class TestStore extends BaseStore {
    kept = 'default-kept';
    stale = 'default-stale';
}

describe('BaseStore (@deriv/stores)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        localStorage.clear();
        sessionStorage.clear();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('[BSC-001] exports one shared BaseStore from the package index (characterization)', () => {
        expect(typeof BaseStore).toBe('function');
        expect(StoresIndex.BaseStore).toBe(BaseStore);
        expect(BaseStore.STORAGES.LOCAL_STORAGE).toBeDefined();
        expect(BaseStore.STORAGES.SESSION_STORAGE).toBeDefined();
        expect(new TestStore({ root_store: getRootStore() })).toBeInstanceOf(BaseStore);
    });

    it('[BSC-002] drops the dead theme-listener machinery but keeps the live lifecycle listeners (characterization)', () => {
        const store = new TestStore({ root_store: getRootStore() });

        expect('onThemeChange' in store).toBe(false);
        expect('disposeThemeChange' in store).toBe(false);
        expect('themeChangeDisposer' in store).toBe(false);
        expect('theme_change_listener' in store).toBe(false);

        expect(typeof store.onLogout).toBe('function');
        expect(typeof store.onClientInit).toBe('function');
        expect(typeof store.onNetworkStatusChange).toBe('function');
        expect(typeof store.onUnmount).toBe('function');
    });

    it('[BSC-003] retrieveFromStorage never reads an undefined key when no store_name is set', () => {
        const getItemSpy = jest.spyOn(Storage.prototype, 'getItem');
        const store = new TestStore({ root_store: getRootStore() });

        store.retrieveFromStorage();

        expect(getItemSpy).toHaveBeenCalled();
        getItemSpy.mock.calls.forEach(([key]) => {
            expect(key).not.toBeUndefined();
            expect(key).not.toBe('undefined');
        });
        expect(getItemSpy).toHaveBeenCalledWith('');
        getItemSpy.mockRestore();
    });

    it('[BSC-003] retrieveFromStorage restores only keys declared in the *_storage_properties list', () => {
        localStorage.setItem('test_store', JSON.stringify({ kept: 'restored', stale: 'should-not-apply' }));
        const store = new TestStore({
            root_store: getRootStore(),
            local_storage_properties: ['kept'],
            store_name: 'test_store',
        });

        store.retrieveFromStorage();

        expect(store.kept).toBe('restored');
        expect(store.stale).toBe('default-stale');
    });
});
