import { isPhoneLandscape } from '@deriv/shared';
import { mockStore } from '@deriv/stores';

import { TRootStore } from 'Types';

import TradeStore from '../trade-store';

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    isPhoneLandscape: jest.fn(() => false),
    pickDefaultSymbol: jest.fn(() => Promise.resolve('1HZ100V')),
    isMarketClosed: jest.fn(() => false),
    WS: { forgetAll: jest.fn(() => Promise.resolve()), subscribeProposal: jest.fn(), forget: jest.fn() },
}));

const mockIsPhoneLandscape = isPhoneLandscape as jest.Mock;

/**
 * `clearTradeErrorState` is the first statement past the guard in `selectMarketAndTradeType`, so
 * stubbing it to throw does double duty: it proves the call got past the guard, and it stops the
 * commit cascade — which needs far more of the app stubbed than this behaviour warrants.
 *
 * It is spied through a cast because it is private. The neighbouring `saveTabTradeParams` would read
 * better, but MobX's `action.bound` leaves it a read-only property that `jest.spyOn` cannot replace.
 */
const CASCADE_REACHED = 'cascade-reached';

const buildStore = ({ contract_type = 'accumulator' } = {}) => {
    const root_store = mockStore({}) as unknown as TRootStore;
    const store = new TradeStore({ root_store });
    store.symbol = '1HZ100V';
    store.contract_type = contract_type;
    const cascade_started = jest
        .spyOn(store as unknown as { clearTradeErrorState: () => void }, 'clearTradeErrorState')
        .mockImplementation(() => {
            throw new Error(CASCADE_REACHED);
        });
    return { store, cascade_started };
};

/** 'held' when the guard stopped the call, 'committed' when it let it through. */
const select = (store: TradeStore, symbol: string, contract_type: string) =>
    store.selectMarketAndTradeType(symbol, contract_type).then(
        () => 'held',
        error => (error.message === CASCADE_REACHED ? 'committed' : Promise.reject(error))
    );

describe('TradeStore market selection — landscape', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockIsPhoneLandscape.mockReturnValue(false);
    });

    it('[LSD-001] holds a portrait-only trade type instead of committing it', async () => {
        // Committing would tear down the landscape surface and render the portrait-only layout behind
        // PortraitPrompt — which is exactly what the prompt exists to avoid showing.
        mockIsPhoneLandscape.mockReturnValue(true);
        const { store } = buildStore();

        await expect(select(store, 'R_50', 'high_low')).resolves.toBe('held');

        expect(store.pending_landscape_selection).toEqual({ symbol: 'R_50', contract_type: 'high_low' });
        expect(store.contract_type).toBe('accumulator');
    });

    it('[LSD-002] commits normally in portrait', async () => {
        const { store } = buildStore();

        await expect(select(store, 'R_50', 'high_low')).resolves.toBe('committed');

        expect(store.pending_landscape_selection).toBeNull();
    });

    it('[LSD-002] commits Accumulators in landscape, the one trade type it can render', async () => {
        mockIsPhoneLandscape.mockReturnValue(true);
        const { store } = buildStore({ contract_type: 'high_low' });

        await expect(select(store, 'R_50', 'accumulator')).resolves.toBe('committed');
    });

    it('[LSD-002] commits in landscape when the surface was already unsupported', async () => {
        // Arrived here by rotating, or by a reload. There is no landscape surface to protect, so
        // holding the selection would strand the store with no committed trade type at all.
        mockIsPhoneLandscape.mockReturnValue(true);
        const { store } = buildStore({ contract_type: 'high_low' });

        await expect(select(store, 'R_50', 'multiplier')).resolves.toBe('committed');
    });

    it('[LSD-003] a later real commit supersedes the held selection', async () => {
        mockIsPhoneLandscape.mockReturnValue(true);
        const { store } = buildStore();
        await select(store, 'R_50', 'high_low');

        // Back to Accumulators: this one commits, so the prompt must stop naming the dropped pick.
        await select(store, 'R_100', 'accumulator');

        expect(store.pending_landscape_selection).toBeNull();
    });

    it('[LSD-004] lands the held selection once portrait can render it', async () => {
        mockIsPhoneLandscape.mockReturnValue(true);
        const { store, cascade_started } = buildStore();
        await select(store, 'R_50', 'high_low');

        mockIsPhoneLandscape.mockReturnValue(false);
        store.commitPendingLandscapeSelection();

        expect(cascade_started).toHaveBeenCalled();
        expect(store.pending_landscape_selection).toBeNull();
    });

    it('[LSD-004] committing nothing is a no-op', () => {
        const { store, cascade_started } = buildStore();

        store.commitPendingLandscapeSelection();

        expect(cascade_started).not.toHaveBeenCalled();
    });
});
