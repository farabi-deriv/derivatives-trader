import { isPhoneLandscape } from '@deriv/shared';
import { mockStore } from '@deriv/stores';

import { TRootStore } from 'Types';

import { processPurchase } from '../Actions/purchase';
import TradeStore from '../trade-store';

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    isPhoneLandscape: jest.fn(() => false),
    pickDefaultSymbol: jest.fn(() => Promise.resolve('1HZ100V')),
    isMarketClosed: jest.fn(() => false),
    WS: { forgetAll: jest.fn(() => Promise.resolve()), subscribeProposal: jest.fn(), forget: jest.fn() },
}));

jest.mock('../Actions/purchase', () => ({ processPurchase: jest.fn() }));

const mockIsPhoneLandscape = isPhoneLandscape as jest.Mock;
const mockProcessPurchase = processPurchase as jest.Mock;

// The narrowest successful `buy` the post-purchase branch can run on: a contract_id it can add, and a
// shortcode it can parse.
const buildBuyResponse = () => ({
    buy: {
        buy_price: 10,
        contract_id: 123,
        longcode: 'long',
        shortcode: 'CALL_1HZ100V_19.54_1700000000_1700000060_S0P_0',
        start_time: 1700000000,
        transaction_id: 1,
    },
    echo_req: {},
});

const buildStore = () => {
    const root_store = mockStore({}) as unknown as TRootStore;
    const store = new TradeStore({ root_store });
    store.is_trade_component_mounted = true;
    store.is_purchase_enabled = true;
    // The buy path asserts the proposal it is completing is still the current one.
    store.proposal_info = { CALL: { id: 'proposal-id' } as never };
    store.proposal_requests = { CALL: {} };
    return { store, root_store };
};

describe('TradeStore purchase — landscape', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockIsPhoneLandscape.mockReturnValue(false);
        mockProcessPurchase.mockResolvedValue(buildBuyResponse());
    });

    it('[LPB-001] does not open the positions drawer in phone landscape', async () => {
        // `isMobile` is width-only, so 844px reads as desktop — without the orientation check the
        // drawer is thrown over the chart on every buy.
        mockIsPhoneLandscape.mockReturnValue(true);
        const { store, root_store } = buildStore();

        store.processPurchase('proposal-id', 10, 'CALL', false);
        await Promise.resolve();

        expect(root_store.ui.openPositionsDrawer).not.toHaveBeenCalled();
    });

    it('[LPB-001] still opens it on a real desktop', async () => {
        const { store, root_store } = buildStore();

        store.processPurchase('proposal-id', 10, 'CALL', false);
        await Promise.resolve();

        expect(root_store.ui.openPositionsDrawer).toHaveBeenCalled();
    });

    it('[LPB-001] still skips it on portrait mobile', async () => {
        const { store, root_store } = buildStore();

        store.processPurchase('proposal-id', 10, 'CALL', true);
        await Promise.resolve();

        expect(root_store.ui.openPositionsDrawer).not.toHaveBeenCalled();
    });

    it('[LPB-002] raises the trade notification in phone landscape', async () => {
        // The branch is gated on `ui.is_mobile`, which is width-only — landscape reports false at
        // 844px and the notification never fired.
        mockIsPhoneLandscape.mockReturnValue(true);
        const { store, root_store } = buildStore();

        store.processPurchase('proposal-id', 10, 'CALL', false);
        await Promise.resolve();

        expect(root_store.notifications.addTradeNotification).toHaveBeenCalled();
    });

    it('[LPB-002] still raises it on portrait mobile', async () => {
        const { store, root_store } = buildStore();
        root_store.ui.is_mobile = true;

        store.processPurchase('proposal-id', 10, 'CALL', true);
        await Promise.resolve();

        expect(root_store.notifications.addTradeNotification).toHaveBeenCalled();
    });

    it('[LPB-002] does not raise it on a real desktop', async () => {
        const { store, root_store } = buildStore();

        store.processPurchase('proposal-id', 10, 'CALL', false);
        await Promise.resolve();

        expect(root_store.notifications.addTradeNotification).not.toHaveBeenCalled();
    });
});
