import { configure } from 'mobx';

import { mockStore } from '@deriv/stores';

import { TRootStore } from 'Types';

import MarketsStore from './markets-store';

configure({ safeDescriptors: false });

let mockedMarketsStore: MarketsStore;

describe('MarketsStore', () => {
    beforeEach(() => {
        localStorage.clear();
        mockedMarketsStore = new MarketsStore({
            root_store: mockStore({}) as unknown as TRootStore,
        });
    });

    it('should seed the cq-favorites key when it does not exist', () => {
        const storedFavorites = JSON.parse(localStorage.getItem('cq-favorites') || '{}');

        expect(storedFavorites).toEqual({
            indicators: [],
            'chartTitle&Comparison': [],
        });
    });

    it('[SMC-013] removes the dead favorites cluster and keeps favouriteMarkets', () => {
        expect('favoriteIndicators' in mockedMarketsStore).toBe(false);
        expect('favoriteSymbols' in mockedMarketsStore).toBe(false);
        expect('setFavoriteIndicators' in mockedMarketsStore).toBe(false);
        expect('setFavoriteSymbols' in mockedMarketsStore).toBe(false);
        expect('removeFavoriteIndicator' in mockedMarketsStore).toBe(false);
        expect('removeFavoriteSymbol' in mockedMarketsStore).toBe(false);
        expect('syncLocalStorage' in mockedMarketsStore).toBe(false);
        expect(typeof mockedMarketsStore.setFavouriteMarkets).toBe('function');
    });

    it('persists favouriteMarkets to localStorage', () => {
        const markets = [{ symbol: 'frxEURUSD', trade_type: 'rise_fall' }];
        mockedMarketsStore.setFavouriteMarkets(markets);

        expect(mockedMarketsStore.favouriteMarkets).toEqual(markets);
        expect(JSON.parse(localStorage.getItem('favourite_markets_v2') || '[]')).toEqual(markets);
    });
});
