import { TRootStore } from 'Types';

import MarketsStore from './Markets/markets-store';
import PositionsStore from './Positions/positions-store';
import TradeStore from './Trading/trade-store';
import AutomationStore from './Trading/automation-store';

export default class ModulesStore {
    positions: PositionsStore;
    markets: MarketsStore;
    trade: TradeStore;
    automation: AutomationStore;

    constructor(root_store: TRootStore) {
        this.trade = new TradeStore({ root_store });
        this.automation = new AutomationStore({ root_store });
        this.positions = new PositionsStore({ root_store });
        this.markets = new MarketsStore({ root_store });
    }
}
