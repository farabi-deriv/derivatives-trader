import { mockStore } from '@deriv/stores';
import { fireEvent, render, screen } from '@testing-library/react';

import ModulesProvider from 'Stores/Providers/modules-providers';

import TraderProviders from '../../../../trader-providers';
import PortraitPrompt from '../portrait-prompt';

const mockUseIsPhoneLandscape = jest.fn(() => true);
jest.mock('AppV2/Hooks/useIsPhoneLandscape', () => ({
    __esModule: true,
    default: () => mockUseIsPhoneLandscape(),
}));

const buildStore = ({
    contract_type = 'rise_fall',
    is_accumulator = false,
    pending = null,
}: {
    contract_type?: string;
    is_accumulator?: boolean;
    pending?: { symbol: string; contract_type: string } | null;
} = {}) =>
    mockStore({
        modules: {
            trade: {
                ...mockStore({}).modules.trade,
                contract_type,
                is_accumulator,
                pending_landscape_selection: pending,
            },
        },
    });

const renderPrompt = (store = buildStore()) =>
    render(
        <TraderProviders store={store}>
            <ModulesProvider store={store}>
                <PortraitPrompt />
            </ModulesProvider>
        </TraderProviders>
    );

// The trade type is interpolated into its own text node, so read the whole overlay.
const prompt = () => screen.queryByRole('dialog');

describe('PortraitPrompt', () => {
    afterEach(() => {
        mockUseIsPhoneLandscape.mockReturnValue(true);
        jest.clearAllMocks();
    });

    it('[PPR-001] names the trade type that has no landscape layout', () => {
        renderPrompt();

        expect(prompt()).toHaveTextContent('Rise/Fall is only available in portrait. Rotate your phone to continue.');
        expect(prompt()).not.toHaveTextContent('Switch to portrait mode');
    });

    it('[PPR-001] uses the tab name, not the raw contract type', () => {
        // `match_diff` is the store value; 'Matches/Differs' is what the trade-type tab is called.
        renderPrompt(buildStore({ contract_type: 'match_diff' }));

        expect(prompt()).toHaveTextContent('Matches/Differs is only available in portrait.');
    });

    it('[PPR-002] stays away on Accumulators, which has a landscape layout', () => {
        renderPrompt(buildStore({ contract_type: 'accumulator', is_accumulator: true }));

        expect(prompt()).not.toBeInTheDocument();
    });

    it('[PPR-007] names the held pick, not the trade type still committed behind it', () => {
        // Picking a portrait-only type in landscape does not commit, precisely so the Accumulators
        // surface stays up. Reading `contract_type` here would name Accumulators — which is not what
        // the user just tapped, and is not what the prompt is blocking.
        renderPrompt(
            buildStore({
                contract_type: 'accumulator',
                is_accumulator: true,
                pending: { symbol: 'R_50', contract_type: 'high_low' },
            })
        );

        expect(prompt()).toHaveTextContent('Higher/Lower is only available in portrait.');
    });

    it('[PPR-002] stays away while startup has not resolved the trade type yet', () => {
        // A cold open in landscape starts with a blank type; reading that as portrait-only flashed
        // "This trade type is only available in portrait" over an Accumulators deep link.
        renderPrompt(buildStore({ contract_type: '' }));

        expect(prompt()).not.toBeInTheDocument();
    });

    it('[PPR-002] stays away in portrait, where every trade type works', () => {
        mockUseIsPhoneLandscape.mockReturnValue(false);

        renderPrompt();

        expect(prompt()).not.toBeInTheDocument();
    });

    it('[PPR-003] offers no way out when arriving on the type, since nothing usable is behind it', () => {
        renderPrompt();

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('[PPR-009] a held pick can be cancelled, leaving Accumulators as it was', () => {
        const store = buildStore({
            contract_type: 'accumulator',
            is_accumulator: true,
            pending: { symbol: 'R_50', contract_type: 'rise_fall' },
        });
        store.modules.trade.setPendingLandscapeSelection = jest.fn();
        renderPrompt(store);

        expect(screen.getByTestId('dt_rotate_prompt')).toContainElement(screen.getByTestId('dt_rotate_prompt_dismiss'));
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

        expect(store.modules.trade.setPendingLandscapeSelection).toHaveBeenCalledWith(null);
    });

    it('[PPR-004] falls back to a generic subject rather than an empty sentence', () => {
        // An unrecognised contract type would otherwise render " is only available…".
        renderPrompt(buildStore({ contract_type: 'not_a_trade_type' }));

        expect(prompt()).toHaveTextContent('This trade type is only available in portrait.');
    });
});
