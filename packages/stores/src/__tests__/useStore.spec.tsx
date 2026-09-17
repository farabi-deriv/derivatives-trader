import * as React from 'react';
import { renderHook } from '@testing-library/react-hooks';
import StoreProvider from '../storeProvider';
import useStore from '../useStore';
import type { TStores } from '../../types';

describe('useStore', () => {
    test('should throw an error if StoreContext has not been provided', async () => {
        const { result } = renderHook(() => useStore());
        expect(result.error).toEqual(Error('useStore must be used within StoreProvider'));
    });

    test('should be able to access store data if StoreContext has been provided', async () => {
        const mockRootStore: DeepPartial<TStores> = {
            client: {
                loginid: 'CR1234',
            },
            ui: {
                is_dark_mode_on: true,
            },
        };

        const wrapper = ({ children }: { children: JSX.Element }) => (
            <StoreProvider store={mockRootStore as TStores}>{children}</StoreProvider>
        );
        const { result } = renderHook(() => useStore(), { wrapper });

        expect(result.current.client.loginid).toBe('CR1234');
        expect(result.current.ui.is_dark_mode_on).toBe(true);
    });

    test('[DCR-013] should not add a feature_flags store to the provided value', async () => {
        const mockRootStore: DeepPartial<TStores> = { client: { email: 'john@company.com' } };

        const wrapper = ({ children }: { children: JSX.Element }) => (
            <StoreProvider store={mockRootStore as TStores}>{children}</StoreProvider>
        );
        const { result } = renderHook(() => useStore(), { wrapper });

        expect(result.current).not.toHaveProperty('feature_flags');
        expect(Object.keys(result.current)).toEqual(Object.keys(mockRootStore));
    });
});
