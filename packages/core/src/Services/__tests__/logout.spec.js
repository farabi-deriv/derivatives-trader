import { requestLogout } from '../logout';

jest.mock('../ws-methods', () => ({
    __esModule: true,
    default: { logout: jest.fn(() => Promise.resolve({ logout: 1 })) },
}));

jest.mock('_common/base/socket_cache', () => ({
    __esModule: true,
    default: { clear: jest.fn() },
}));

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    removeCookies: jest.fn(),
}));

jest.mock('@deriv/utils', () => ({
    ...jest.requireActual('@deriv/utils'),
    Chat: { clear: jest.fn() },
}));

describe('logout sessionStorage handling', () => {
    beforeEach(() => {
        sessionStorage.clear();
        localStorage.clear();
    });

    it('spares the trading state keys from the sessionStorage wipe and removes everything else', async () => {
        // Trading state is market configuration, not account state — a re-logging-in user must
        // find their tabs and each tab's saved parameters exactly as they left them.
        const kept = {
            trade_store: JSON.stringify({ symbol: 'R_100', contract_type: 'rise_fall' }),
            open_markets_v2: JSON.stringify([{ symbol: 'R_100', contract_type: 'rise_fall' }]),
            open_markets_automation_v2: JSON.stringify([{ symbol: 'R_100', contract_type: 'multiplier' }]),
            tab_trade_params_v2: JSON.stringify({ 'R_100|rise_fall': { amount: 500 } }),
            tab_trade_params_automation_v2: JSON.stringify({ 'R_100|multiplier': { amount: 25 } }),
        };
        Object.entries(kept).forEach(([key, value]) => sessionStorage.setItem(key, value));
        sessionStorage.setItem('unrelated_session_key', 'wiped');
        sessionStorage.setItem('another_transient', 'wiped');

        await requestLogout();

        Object.entries(kept).forEach(([key, value]) => expect(sessionStorage.getItem(key)).toBe(value));
        expect(sessionStorage.getItem('unrelated_session_key')).toBeNull();
        expect(sessionStorage.getItem('another_transient')).toBeNull();
    });

    it('does not spare keys that merely resemble the trading state prefixes', async () => {
        // The filter matches the exact key or `<kept>_...` — a lookalike without the separator
        // boundary (e.g. `trade_storefoo`) must still be wiped.
        sessionStorage.setItem('trade_storefoo', 'wiped');
        sessionStorage.setItem('open_marketsish', 'wiped');

        await requestLogout();

        expect(sessionStorage.getItem('trade_storefoo')).toBeNull();
        expect(sessionStorage.getItem('open_marketsish')).toBeNull();
    });
});
