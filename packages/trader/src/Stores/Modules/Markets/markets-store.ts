import { action, makeObservable, observable } from 'mobx';

import { BaseStore } from '@deriv/stores';

import { TRootStore } from 'Types';

/** A market-selection favourite: a {symbol, trade-type-tab} combo (e.g. frxEURUSD under Rise/Fall). */
export type TFavouriteMarket = {
    symbol: string;
    trade_type: string;
};

// Separate from `cq-favorites` (the chart's symbol favourites) so the two don't interfere.
const FAVOURITE_MARKETS_KEY = 'favourite_markets_v2';

export default class MarketsStore extends BaseStore<TRootStore> {
    // AppV2 market-selection favourites, stored per {symbol, trade-type tab} combo.
    favouriteMarkets: TFavouriteMarket[] = [];

    constructor({ root_store }: { root_store: TRootStore }) {
        super({ root_store });

        makeObservable(this, {
            favouriteMarkets: observable,
            setFavouriteMarkets: action.bound,
        });

        // `cq-favorites` is owned by the SmartCharts chart and read by @deriv/shared's
        // active-symbols helper; seed the empty shape so a first read never sees a missing key.
        if (!localStorage.getItem('cq-favorites')) {
            localStorage.setItem('cq-favorites', JSON.stringify({ indicators: [], 'chartTitle&Comparison': [] }));
        }

        try {
            const stored_markets = JSON.parse(localStorage.getItem(FAVOURITE_MARKETS_KEY) ?? '[]');
            if (Array.isArray(stored_markets)) {
                this.favouriteMarkets = stored_markets.filter(item => item?.symbol && item?.trade_type);
            }
        } catch {
            this.favouriteMarkets = [];
        }
    }

    setFavouriteMarkets(markets: TFavouriteMarket[]) {
        this.favouriteMarkets = markets;
        localStorage.setItem(FAVOURITE_MARKETS_KEY, JSON.stringify(markets));
    }
}
