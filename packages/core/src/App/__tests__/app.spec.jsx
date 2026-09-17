import React from 'react';

import { Analytics } from '@deriv-com/analytics';
import { render } from '@testing-library/react';

import App from '../app';

jest.mock('@deriv/api', () => ({
    APIProvider: ({ children }) => <>{children}</>,
    useMobileBridge: () => ({ isBridgeAvailable: false, sendBridgeEvent: jest.fn() }),
}));
jest.mock('@deriv/components', () => ({ Loading: () => <div>Loading</div> }));
jest.mock('@deriv/shared', () => ({
    initFormErrorMessages: jest.fn(),
    setUrlLanguage: jest.fn(),
    setWebsocket: jest.fn(),
}));
jest.mock('@deriv/stores', () => ({ StoreProvider: ({ children }) => <>{children}</> }));
jest.mock('@deriv-com/analytics', () => ({ Analytics: { reset: jest.fn() } }));
jest.mock('@deriv-com/quill-ui', () => ({ BreakpointProvider: ({ children }) => <>{children}</> }));
jest.mock('@deriv-com/translations', () => ({
    getInitialLanguage: () => 'EN',
    initializeI18n: () => ({}),
    TranslationProvider: ({ children }) => <>{children}</>,
}));
jest.mock('Services/ws-methods', () => ({}));
jest.mock('../AppContent', () => {
    const MockAppContent = () => <div>AppContent</div>;
    return MockAppContent;
});

describe('App mount analytics', () => {
    const root_store = {
        client: { preferred_language: 'EN' },
        ui: { setDarkMode: jest.fn() },
        common: { setPlatform: jest.fn() },
    };

    beforeEach(() => {
        Analytics.reset.mockClear();
    });

    // Characterization: the pre-change effect fired Analytics.reset() once on mount because
    // the gating `email` was always undefined; the unconditional effect preserves that behaviour.
    it('[ABF-012] calls Analytics.reset() exactly once on mount', () => {
        render(<App root_store={root_store} />);

        expect(Analytics.reset).toHaveBeenCalledTimes(1);
    });
});
