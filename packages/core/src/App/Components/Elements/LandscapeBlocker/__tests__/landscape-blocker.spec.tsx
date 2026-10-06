import { MemoryRouter } from 'react-router-dom';

import { routes } from '@deriv/shared';
import { mockStore, StoreProvider } from '@deriv/stores';
import { render, screen } from '@testing-library/react';

import LandscapeBlocker from '../landscape-blocker';

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    // Simulate a real phone held in landscape: isMobile is false (width query), isMobileOs true.
    isMobileOs: jest.fn(() => true),
    isTabletOs: false,
    // jsdom's global matchMedia stub always reports no match, so the real predicate would be false for
    // every case. Default it to true (a phone in landscape) and let the device-shape case override.
    isPhoneLandscape: jest.fn(() => true),
}));

const { isPhoneLandscape } = jest.requireMock('@deriv/shared');

const renderBlocker = (pathname: string) => {
    const store = mockStore({});
    return render(
        <StoreProvider store={store}>
            <MemoryRouter initialEntries={[pathname]}>
                <LandscapeBlocker />
            </MemoryRouter>
        </StoreProvider>
    );
};

const ROTATE_MESSAGE = 'Please rotate your device to portrait view.';

describe('LandscapeBlocker', () => {
    it('[LTM-003] never blocks the trade page on a phone in landscape, whatever the trade type', () => {
        // The trade page owns its own landscape messaging: Accumulators has a landscape layout, and
        // every other trade type gets trader's PortraitPrompt, which can name the trade type. Blocking
        // here too would stack a second overlay on top of it.
        renderBlocker(routes.index);

        expect(screen.queryAllByText(ROTATE_MESSAGE)).toHaveLength(0);
    });

    it('[LTM-005] still blocks on / when the device is too tall for the phone-landscape query', () => {
        // A mobile-OS device over the 500px landscape height (foldable/phablet) renders `TradeDesktop`,
        // never the landscape surface, so it still needs the blocker.
        isPhoneLandscape.mockReturnValueOnce(false);

        renderBlocker(routes.index);

        expect(screen.queryAllByText(ROTATE_MESSAGE).length).toBeGreaterThan(0);
    });

    it('[LTM-003] never blocks reports on a phone in landscape, which has its own shell', () => {
        renderBlocker(routes.reports);

        expect(screen.queryAllByText(ROTATE_MESSAGE)).toHaveLength(0);
    });

    it('[LTM-003] covers the reports sub-pages too, since each renders in that shell', () => {
        renderBlocker(routes.statement);

        expect(screen.queryAllByText(ROTATE_MESSAGE)).toHaveLength(0);
    });

    it('[LTM-005] still blocks reports when the device is too tall for the phone-landscape query', () => {
        isPhoneLandscape.mockReturnValueOnce(false);

        renderBlocker(routes.reports);

        expect(screen.queryAllByText(ROTATE_MESSAGE).length).toBeGreaterThan(0);
    });

    it('[LTM-003] never blocks contract details on a phone in landscape, which has its own shell', () => {
        renderBlocker('/contract/123');

        expect(screen.queryAllByText(ROTATE_MESSAGE)).toHaveLength(0);
    });

    it('[LTM-005] still blocks contract details when the device is too tall for the query', () => {
        isPhoneLandscape.mockReturnValueOnce(false);

        renderBlocker('/contract/123');

        expect(screen.queryAllByText(ROTATE_MESSAGE).length).toBeGreaterThan(0);
    });
});
