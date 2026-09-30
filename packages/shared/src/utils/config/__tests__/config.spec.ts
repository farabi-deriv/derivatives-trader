import Cookies from 'js-cookie';

import * as brandUtils from '../../brand';
import {
    clearAccountTypeParam,
    getAccountId,
    getAccountServer,
    getCompleteWebSocketURL,
    getSocketURL,
    isDemoAccountId,
    isRealAccountId,
} from '../config';

// Mock the brand utils module
jest.mock('../../brand', () => ({
    ...jest.requireActual('../../brand'),
    getWebSocketURL: jest.fn(),
}));

// Mock js-cookie so we can drive the shared `options_account_id` session cookie
jest.mock('js-cookie', () => ({
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
}));

const mockGetWebSocketURL = brandUtils.getWebSocketURL as jest.Mock;
const mockCookiesGet = Cookies.get as unknown as jest.Mock;

// Helper to set the `options_account_id` cookie (a plain account_id string), or clear it with null
const setOptionsAccountIdCookie = (account_id: string | null) => {
    mockCookiesGet.mockImplementation((name?: string) =>
        name === 'options_account_id' && account_id ? account_id : undefined
    );
};

// Helper function to create localStorage mock
const createLocalStorageMock = () => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
            store[key] = value;
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        },
    };
};

// Helper function to mock window.location
const mockLocation = (originalLocation: Location, overrides: Partial<Location>) => {
    Object.defineProperty(window, 'location', {
        value: { ...originalLocation, ...overrides },
        writable: true,
    });
};

describe('isDemoAccountId / isRealAccountId', () => {
    it('treats only a DOT-prefixed id as demo', () => {
        expect(isDemoAccountId('DOT90096855')).toBe(true);
        expect(isDemoAccountId('ROT90070611')).toBe(false);
        expect(isDemoAccountId('XYZ123')).toBe(false);
        expect(isDemoAccountId('')).toBe(false);
        expect(isDemoAccountId(null)).toBe(false);
        expect(isDemoAccountId(undefined)).toBe(false);
    });

    it('treats only a ROT-prefixed id as real', () => {
        expect(isRealAccountId('ROT90070611')).toBe(true);
        expect(isRealAccountId('DOT90096855')).toBe(false);
        expect(isRealAccountId('XYZ123')).toBe(false);
        expect(isRealAccountId(null)).toBe(false);
        expect(isRealAccountId(undefined)).toBe(false);
    });
});

describe('getAccountServer', () => {
    let originalLocation: Location, originalLocalStorage: Storage;

    beforeEach(() => {
        originalLocation = window.location;
        originalLocalStorage = window.localStorage;

        Object.defineProperty(window, 'localStorage', {
            value: createLocalStorageMock(),
            writable: true,
        });

        window.history.replaceState = jest.fn();
        // Default: no session cookie. clearAllMocks() keeps mock implementations, so reset explicitly.
        mockCookiesGet.mockReset();
    });

    afterEach(() => {
        Object.defineProperty(window, 'location', {
            value: originalLocation,
            writable: true,
        });
        Object.defineProperty(window, 'localStorage', {
            value: originalLocalStorage,
            writable: true,
        });
        jest.clearAllMocks();
    });

    it('returns "demo" for a DOT account_id argument', () => {
        expect(getAccountServer('DOT90096855')).toBe('demo');
    });

    it('returns "real" for a ROT account_id argument', () => {
        expect(getAccountServer('ROT90070611')).toBe('real');
    });

    it('returns "public" for an unrecognised account_id argument', () => {
        expect(getAccountServer('XYZ123')).toBe('public');
        expect(getAccountServer('')).toBe('public');
        expect(getAccountServer(null)).toBe('public');
    });

    it('derives "demo" from a DOT account_id resolved via getAccountId()', () => {
        window.localStorage.setItem('account_id', 'DOT90096855');
        mockLocation(originalLocation, { search: '', href: 'https://dtrader.deriv.com' });

        expect(getAccountServer()).toBe('demo');
    });

    it('derives "real" from a ROT account_id resolved via getAccountId()', () => {
        window.localStorage.setItem('account_id', 'ROT90070611');
        mockLocation(originalLocation, { search: '', href: 'https://dtrader.deriv.com' });

        expect(getAccountServer()).toBe('real');
    });

    it('returns "public" when no account_id is resolvable', () => {
        setOptionsAccountIdCookie(null);
        mockLocation(originalLocation, { search: '', href: 'https://dtrader.deriv.com' });

        expect(getAccountServer()).toBe('public');
    });
});

describe('clearAccountTypeParam', () => {
    let originalLocation: Location;

    beforeEach(() => {
        originalLocation = window.location;
        window.history.replaceState = jest.fn();
    });

    afterEach(() => {
        Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
        jest.clearAllMocks();
    });

    it('removes a lingering account_type param and preserves the rest of the URL', () => {
        mockLocation(originalLocation, {
            search: '?account_type=real&account_id=ROT90070611',
            href: 'https://dtrader.deriv.com/?account_type=real&account_id=ROT90070611',
            pathname: '/',
        });

        clearAccountTypeParam();

        expect(window.history.replaceState).toHaveBeenCalledWith({}, document.title, '/?account_id=ROT90070611');
    });

    it('does nothing when there is no account_type param', () => {
        mockLocation(originalLocation, {
            search: '?account_id=ROT90070611',
            href: 'https://dtrader.deriv.com/?account_id=ROT90070611',
            pathname: '/',
        });

        clearAccountTypeParam();

        expect(window.history.replaceState).not.toHaveBeenCalled();
    });
});

describe('getAccountId', () => {
    let originalLocation: Location, originalLocalStorage: Storage;

    beforeEach(() => {
        originalLocation = window.location;
        originalLocalStorage = window.localStorage;

        Object.defineProperty(window, 'localStorage', {
            value: createLocalStorageMock(),
            writable: true,
        });

        window.history.replaceState = jest.fn();
        mockCookiesGet.mockReset();
    });

    afterEach(() => {
        Object.defineProperty(window, 'location', {
            value: originalLocation,
            writable: true,
        });
        Object.defineProperty(window, 'localStorage', {
            value: originalLocalStorage,
            writable: true,
        });
        jest.clearAllMocks();
    });

    it('should return account_id from the URL param, persist it, and strip it from the URL', () => {
        mockLocation(originalLocation, {
            search: '?account_id=ROT90070611',
            href: 'https://dtrader.deriv.com?account_id=ROT90070611',
            pathname: '/',
        });

        const result = getAccountId();

        expect(result).toBe('ROT90070611');
        expect(window.localStorage.getItem('account_id')).toBe('ROT90070611');
        expect(window.history.replaceState).toHaveBeenCalledWith({}, document.title, '/');
    });

    it('should prefer the URL param over both localStorage and the session cookie', () => {
        window.localStorage.setItem('account_id', 'ROT90070622');
        setOptionsAccountIdCookie('ROT90070633');
        mockLocation(originalLocation, {
            search: '?account_id=ROT90070611',
            href: 'https://dtrader.deriv.com?account_id=ROT90070611',
            pathname: '/',
        });

        expect(getAccountId()).toBe('ROT90070611');
    });

    it('should prefer localStorage over the session cookie', () => {
        window.localStorage.setItem('account_id', 'ROT90070622');
        setOptionsAccountIdCookie('ROT90070633');
        mockLocation(originalLocation, {
            search: '',
            href: 'https://dtrader.deriv.com',
        });

        expect(getAccountId()).toBe('ROT90070622');
    });

    it('should fall back to the session cookie account_id and persist it to localStorage', () => {
        setOptionsAccountIdCookie('ROT90070633');
        mockLocation(originalLocation, {
            search: '',
            href: 'https://dtrader.deriv.com',
        });

        const result = getAccountId();

        expect(result).toBe('ROT90070633');
        expect(window.localStorage.getItem('account_id')).toBe('ROT90070633');
    });

    it('should return null when there is no URL param, localStorage value, or cookie', () => {
        setOptionsAccountIdCookie(null);
        mockLocation(originalLocation, {
            search: '',
            href: 'https://dtrader.deriv.com',
        });

        expect(getAccountId()).toBeNull();
    });
});

describe('getCompleteWebSocketURL', () => {
    let originalLocation: Location, originalLocalStorage: Storage;

    beforeEach(() => {
        originalLocation = window.location;
        originalLocalStorage = window.localStorage;

        Object.defineProperty(window, 'localStorage', {
            value: createLocalStorageMock(),
            writable: true,
        });

        window.history.replaceState = jest.fn();
        mockCookiesGet.mockReset();
        mockGetWebSocketURL.mockReturnValue('core.api.deriv.com/options/v1/ws');
    });

    afterEach(() => {
        Object.defineProperty(window, 'location', {
            value: originalLocation,
            writable: true,
        });
        Object.defineProperty(window, 'localStorage', {
            value: originalLocalStorage,
            writable: true,
        });
        jest.clearAllMocks();
    });

    it('should return /public URL when localStorage is cleared and no cookie exists (post-logout state)', () => {
        // Simulate the state after cleanUp() has run: localStorage cleared, cookie also cleared
        setOptionsAccountIdCookie(null);
        mockLocation(originalLocation, {
            search: '',
            href: 'https://dtrader.deriv.com',
            pathname: '/',
        });

        const result = getCompleteWebSocketURL();

        expect(result).toBe('wss://core.api.deriv.com/options/v1/ws/public');
    });

    it('should return /real URL with account_id param when a ROT (real) account is active', () => {
        window.localStorage.setItem('account_id', 'ROT90070611');
        setOptionsAccountIdCookie(null);
        mockLocation(originalLocation, {
            search: '',
            href: 'https://dtrader.deriv.com',
            pathname: '/',
        });

        const result = getCompleteWebSocketURL();

        expect(result).toBe('wss://core.api.deriv.com/options/v1/ws/real?account_id=ROT90070611');
    });

    it('should return /demo URL with account_id param when a DOT (demo) account is active', () => {
        window.localStorage.setItem('account_id', 'DOT90096855');
        setOptionsAccountIdCookie(null);
        mockLocation(originalLocation, {
            search: '',
            href: 'https://dtrader.deriv.com',
            pathname: '/',
        });

        const result = getCompleteWebSocketURL();

        expect(result).toBe('wss://core.api.deriv.com/options/v1/ws/demo?account_id=DOT90096855');
    });

    it('should return /public with NO account_id query for an unrecognised account_id (never guessed as real)', () => {
        window.localStorage.setItem('account_id', 'XYZ123456');
        setOptionsAccountIdCookie(null);
        mockLocation(originalLocation, {
            search: '',
            href: 'https://dtrader.deriv.com',
            pathname: '/',
        });

        const result = getCompleteWebSocketURL();

        expect(result).toBe('wss://core.api.deriv.com/options/v1/ws/public');
    });
});

describe('getSocketURL', () => {
    let originalLocation: Location, originalLocalStorage: Storage;

    beforeEach(() => {
        originalLocation = window.location;
        originalLocalStorage = window.localStorage;

        Object.defineProperty(window, 'localStorage', {
            value: createLocalStorageMock(),
            writable: true,
        });

        window.history.replaceState = jest.fn();
    });

    afterEach(() => {
        Object.defineProperty(window, 'location', {
            value: originalLocation,
            writable: true,
        });
        Object.defineProperty(window, 'localStorage', {
            value: originalLocalStorage,
            writable: true,
        });
        jest.clearAllMocks();
    });

    it('should return the brand WebSocket URL for the current environment', () => {
        mockGetWebSocketURL.mockReturnValue('staging-core.api.deriv.com/options/v1/ws');
        mockLocation(originalLocation, {
            hostname: 'staging-dtrader.deriv.com',
            search: '',
            href: 'https://staging-dtrader.deriv.com',
        });

        const result = getSocketURL();

        expect(result).toBe('staging-core.api.deriv.com/options/v1/ws');
        expect(mockGetWebSocketURL).toHaveBeenCalled();
    });

    it('should return localStorage value when config.server_url is set', () => {
        window.localStorage.setItem('config.server_url', 'custom.server.com');
        mockLocation(originalLocation, {
            hostname: 'staging-dtrader.deriv.com',
            search: '',
            href: 'https://staging-dtrader.deriv.com',
        });

        const result = getSocketURL();

        expect(result).toBe('custom.server.com');
    });

    it('should ignore and remove invalid localStorage server URL', () => {
        mockGetWebSocketURL.mockReturnValue('staging-core.api.deriv.com/options/v1/ws');
        window.localStorage.setItem('config.server_url', 'https://malicious.com');
        mockLocation(originalLocation, {
            hostname: 'staging-dtrader.deriv.com',
            search: '',
            href: 'https://staging-dtrader.deriv.com',
        });

        const result = getSocketURL();

        expect(result).toBe('staging-core.api.deriv.com/options/v1/ws');
        expect(window.localStorage.getItem('config.server_url')).toBeNull();
        expect(mockGetWebSocketURL).toHaveBeenCalled();
    });

    it('should ignore and remove invalid localStorage server URL without TLD', () => {
        mockGetWebSocketURL.mockReturnValue('staging-core.api.deriv.com/options/v1/ws');
        window.localStorage.setItem('config.server_url', 'localhost');
        mockLocation(originalLocation, {
            hostname: 'staging-dtrader.deriv.com',
            search: '',
            href: 'https://staging-dtrader.deriv.com',
        });

        const result = getSocketURL();

        expect(result).toBe('staging-core.api.deriv.com/options/v1/ws');
        expect(window.localStorage.getItem('config.server_url')).toBeNull();
        expect(mockGetWebSocketURL).toHaveBeenCalled();
    });

    it('should return server URL on dtrader.deriv.be', () => {
        mockGetWebSocketURL.mockReturnValue('api-core.deriv.be/options/v1/ws');
        mockLocation(originalLocation, {
            hostname: 'dtrader.deriv.be',
            search: '',
            href: 'https://dtrader.deriv.be',
        });

        const result = getSocketURL();

        expect(result).toBe('api-core.deriv.be/options/v1/ws');
        expect(mockGetWebSocketURL).toHaveBeenCalled();
    });

    it('should return server URL on dtrader.deriv.me', () => {
        mockGetWebSocketURL.mockReturnValue('api-core.deriv.me/options/v1/ws');
        mockLocation(originalLocation, {
            hostname: 'dtrader.deriv.me',
            search: '',
            href: 'https://dtrader.deriv.me',
        });

        const result = getSocketURL();

        expect(result).toBe('api-core.deriv.me/options/v1/ws');
        expect(mockGetWebSocketURL).toHaveBeenCalled();
    });

    it('should return server URL on staging-dtrader.deriv.be', () => {
        mockGetWebSocketURL.mockReturnValue('staging-api-core.deriv.be/options/v1/ws');
        mockLocation(originalLocation, {
            hostname: 'staging-dtrader.deriv.be',
            search: '',
            href: 'https://staging-dtrader.deriv.be',
        });

        const result = getSocketURL();

        expect(result).toBe('staging-api-core.deriv.be/options/v1/ws');
        expect(mockGetWebSocketURL).toHaveBeenCalled();
    });
});
