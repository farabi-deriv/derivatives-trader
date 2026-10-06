import { mockStore } from '@deriv/stores';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ModulesProvider from 'Stores/Providers/modules-providers';

import TraderProviders from '../../../../trader-providers';
import LandscapePrompt from '../landscape-prompt';

const IPHONE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const stubUserAgent = (userAgent: string) =>
    Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });

const buildStore = ({ has_seen_landscape_prompt = false, is_accumulator = true } = {}) =>
    mockStore({
        ui: { has_seen_landscape_prompt },
        modules: { trade: { ...mockStore({}).modules.trade, is_accumulator } },
    });

const renderHint = (store: ReturnType<typeof mockStore>) =>
    render(
        <TraderProviders store={store}>
            <ModulesProvider store={store}>
                <LandscapePrompt />
            </ModulesProvider>
        </TraderProviders>
    );

const MESSAGE = 'Rotate your phone to landscape mode for a better experience.';

describe('LandscapePrompt', () => {
    const original_user_agent = window.navigator.userAgent;

    afterEach(() => {
        stubUserAgent(original_user_agent);
        jest.clearAllMocks();
    });

    it('[LPR-001] nudges a phone user the first time Accumulators is selected', () => {
        stubUserAgent(IPHONE_UA);

        renderHint(buildStore());

        expect(screen.getByText(MESSAGE)).toBeInTheDocument();
    });

    it('[LPR-002] stays away once it has been seen, so onboarding does not repeat', () => {
        stubUserAgent(IPHONE_UA);

        renderHint(buildStore({ has_seen_landscape_prompt: true }));

        expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
    });

    it('[LPR-003] never shows on a non-accumulator trade type', () => {
        stubUserAgent(IPHONE_UA);

        renderHint(buildStore({ is_accumulator: false }));

        expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
    });

    it('[LPR-004] never asks a desktop user to rotate their phone, however narrow the window', () => {
        // The gate must be the OS, not the viewport: a narrow desktop window reads as a phone by width.
        stubUserAgent(DESKTOP_UA);

        renderHint(buildStore());

        expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
    });

    it('[LPR-005] records the dismissal so it is a one-time nudge', async () => {
        stubUserAgent(IPHONE_UA);
        const store = buildStore();

        renderHint(store);
        await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

        expect(store.ui.setHasSeenLandscapePrompt).toHaveBeenCalledWith(true);
    });
});
