import { mockStore, StoreProvider } from '@deriv/stores';
import { act, fireEvent, render, screen } from '@testing-library/react';

import LandscapeOnboarding, { ONBOARDING_DELAY_MS } from '../landscape-onboarding';

const mountCard = (has_seen = false) => {
    const store = mockStore({ ui: { has_seen_landscape_onboarding: has_seen } });
    render(
        <StoreProvider store={store}>
            <LandscapeOnboarding />
        </StoreProvider>
    );
    return store;
};

const waitForDelay = () => act(() => jest.advanceTimersByTime(ONBOARDING_DELAY_MS));

describe('LandscapeOnboarding', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('[LON-001] appears once the page has settled, not on the first paint', () => {
        mountCard();
        expect(screen.queryByTestId('dt_landscape_onboarding')).not.toBeInTheDocument();

        waitForDelay();

        expect(screen.getByRole('dialog', { name: 'Tap to show or hide controls' })).toBeInTheDocument();
        expect(screen.getByText('Tap on the chart to hide or reveal the controls.')).toBeInTheDocument();
    });

    it('[LON-002] never appears once seen', () => {
        mountCard(true);
        waitForDelay();

        expect(screen.queryByTestId('dt_landscape_onboarding')).not.toBeInTheDocument();
    });

    it.each([
        ['Close', 'dt_landscape_onboarding_close'],
        ['Done', 'dt_landscape_onboarding_done'],
    ])('[LON-003] %s marks it seen', (_name, test_id) => {
        const store = mountCard();
        waitForDelay();

        fireEvent.click(screen.getByTestId(test_id));

        expect(store.ui.setHasSeenLandscapeOnboarding).toHaveBeenCalledWith(true);
        expect(screen.queryByTestId('dt_landscape_onboarding')).not.toBeInTheDocument();
    });
});
