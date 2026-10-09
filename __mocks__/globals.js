// Mock copy-anything module which is causing issues with jest in coveralls
jest.mock('copy-anything', () => ({
    copy: jest.fn(),
}));

jest.mock('@deriv-com/analytics', () => ({
    Analytics: {
        initialise: jest.fn(),
        trackEvent: jest.fn(),
        pageView: jest.fn(),
        reset: jest.fn(),
        setAttributes: jest.fn(),
        getFeatureValue: jest.fn(),
    },
}));

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(), // Deprecated
        removeListener: jest.fn(), // Deprecated
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});

// Mock fetch for tests
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
    })
);

// Mock TextEncoder for tests
global.TextEncoder = jest.fn().mockImplementation(() => ({
    encode: jest.fn(),
}));

// Mock TextDecoder for tests
global.TextDecoder = jest.fn().mockImplementation(() => ({
    decode: jest.fn(),
}));

// Mock IntersectionObserver for tests
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
    root: null,
    rootMargin: '',
    thresholds: [],
}));

// Mock ResizeObserver for tests. `observe` fires an initial observation, as the real API does — a
// component that measures its element on observation sees nothing otherwise — and `resizeAll` lets a
// test stand in for a later resize.
class ResizeObserverStub {
    constructor(callback) {
        this.callback = callback;
        ResizeObserverStub.observers.add(this);
    }
    observe() {
        this.callback([], this);
    }
    unobserve() {}
    disconnect() {
        ResizeObserverStub.observers.delete(this);
    }
}
ResizeObserverStub.observers = new Set();
ResizeObserverStub.resizeAll = () => ResizeObserverStub.observers.forEach(observer => observer.callback([], observer));
global.ResizeObserver = ResizeObserverStub;
