import { PHONE_LANDSCAPE_MEDIA_QUERY } from '@deriv/shared';
import { mockStore } from '@deriv/stores';
import { useDevice } from '@deriv-com/ui';
import { render, screen } from '@testing-library/react';

import useActiveSymbols from 'AppV2/Hooks/useActiveSymbols';
import useContractsFor from 'AppV2/Hooks/useContractsFor';
import ModulesProvider from 'Stores/Providers/modules-providers';

import TraderProviders from '../../../../trader-providers';
import { createMatchMediaMock, TQueryMatchMediaMock } from '../../../test-utils/match-media';
import Trade from '../trade';

jest.mock('@deriv-com/ui', () => ({
    ...jest.requireActual('@deriv-com/ui'),
    useDevice: jest.fn(() => ({ isMobile: true })),
}));
jest.mock('AppV2/Hooks/useProposalReconnectReset', () => jest.fn());
jest.mock('AppV2/Hooks/useActiveSymbols', () => jest.fn());
jest.mock('AppV2/Hooks/useContractsFor', () => jest.fn());
jest.mock('@deriv/components', () => {
    const actual = jest.requireActual('@deriv/components');
    return { ...actual, Loading: { ...actual.Loading, DTraderV2: () => <div>trade-loader</div> } };
});
jest.mock('AppV2/Hooks/useDismissErrorsOnMarketChange', () => jest.fn());
jest.mock('AppV2/Components/ServiceErrorSheet', () => ({ __esModule: true, default: () => null }));
jest.mock('AppV2/Components/PortraitPrompt', () => ({
    __esModule: true,
    default: () => <div>portrait-prompt</div>,
}));
jest.mock('../trade-mobile', () => {
    const TradeMobileStub = () => <div>trade-mobile-surface</div>;
    return { __esModule: true, default: () => <TradeMobileStub /> };
});
jest.mock('../trade-desktop', () => {
    const TradeDesktopStub = () => <div>trade-desktop-surface</div>;
    return { __esModule: true, default: () => <TradeDesktopStub /> };
});
jest.mock('../trade-landscape', () => {
    const TradeLandscapeStub = () => <div>trade-landscape-surface</div>;
    return { __esModule: true, default: () => <TradeLandscapeStub /> };
});

const IPHONE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const mockUseDevice = useDevice as jest.Mock;

const buildStore = ({
    contract_type = '',
    is_accumulator = false,
    pending_landscape_selection = null,
}: { contract_type?: string; is_accumulator?: boolean; pending_landscape_selection?: unknown } = {}) => {
    const on_mount = jest.fn();
    const on_unmount = jest.fn();
    const commit_pending = jest.fn();
    const store = mockStore({
        modules: {
            trade: {
                ...mockStore({}).modules.trade,
                contract_type,
                is_accumulator,
                pending_landscape_selection,
                commitPendingLandscapeSelection: commit_pending,
                onMount: on_mount,
                onUnmount: on_unmount,
            },
        },
    });
    return { store, on_mount, on_unmount, commit_pending };
};

const renderTrade = (store: ReturnType<typeof mockStore>) =>
    render(
        <TraderProviders store={store}>
            <ModulesProvider store={store}>
                <Trade />
            </ModulesProvider>
        </TraderProviders>
    );

describe('Trade', () => {
    const original_match_media = window.matchMedia;
    let media: TQueryMatchMediaMock;

    beforeEach(() => {
        Object.defineProperty(window.navigator, 'userAgent', { value: IPHONE_UA, configurable: true });
        media = createMatchMediaMock();
        mockUseDevice.mockReturnValue({ isMobile: true });
    });

    afterEach(() => {
        window.matchMedia = original_match_media;
        jest.clearAllMocks();
    });

    describe('three-way branch', () => {
        it('[LTM-004] renders TradeLandscape when phone-landscape and accumulator', () => {
            media.setMatches(PHONE_LANDSCAPE_MEDIA_QUERY, true);
            const { store } = buildStore({ is_accumulator: true });

            renderTrade(store);

            expect(screen.getByText('trade-landscape-surface')).toBeInTheDocument();
            expect(screen.queryByText('trade-mobile-surface')).not.toBeInTheDocument();
            expect(screen.queryByText('trade-desktop-surface')).not.toBeInTheDocument();
        });

        it('[LTM-004] phone-landscape but non-accumulator renders no surface at all', () => {
            // Rotated in while already on a portrait-only trade type, so there is no held selection
            // keeping the Accumulators surface up. Rendering a surface here put the portrait-only
            // layout behind PortraitPrompt's dim, visible through it.
            media.setMatches(PHONE_LANDSCAPE_MEDIA_QUERY, true);
            mockUseDevice.mockReturnValue({ isMobile: true });
            const { store } = buildStore({ contract_type: 'rise_fall', is_accumulator: false });

            renderTrade(store);

            expect(screen.queryByText('trade-mobile-surface')).not.toBeInTheDocument();
            expect(screen.queryByText('trade-desktop-surface')).not.toBeInTheDocument();
            expect(screen.queryByText('trade-landscape-surface')).not.toBeInTheDocument();
            expect(screen.queryByText('trade-loader')).not.toBeInTheDocument();
        });

        it('[LTM-013] a cold open in landscape still fetches what startup needs to resolve the type', () => {
            // Nothing restored, so the type starts blank and no surface mounts. Startup resolves it
            // from active_symbols and contracts_for, which only the surfaces fetched — so it waited
            // forever and PortraitPrompt stayed up over an Accumulators deep link.
            media.setMatches(PHONE_LANDSCAPE_MEDIA_QUERY, true);
            const { store } = buildStore({ contract_type: '' });

            renderTrade(store);

            expect(useActiveSymbols).toHaveBeenCalled();
            expect(useContractsFor).toHaveBeenCalled();
            expect(screen.getByText('trade-loader')).toBeInTheDocument();
            expect(screen.queryByText('trade-landscape-surface')).not.toBeInTheDocument();
        });

        it('[LTM-013] leaves portrait to its own surface, which already fetches both', () => {
            const { store } = buildStore({ contract_type: '' });

            renderTrade(store);

            expect(screen.getByText('trade-mobile-surface')).toBeInTheDocument();
            expect(useContractsFor).not.toHaveBeenCalled();
            expect(screen.queryByText('trade-loader')).not.toBeInTheDocument();
        });

        it('[LTM-004] keeps the Accumulators surface up while a selection is held', () => {
            media.setMatches(PHONE_LANDSCAPE_MEDIA_QUERY, true);
            mockUseDevice.mockReturnValue({ isMobile: true });
            const { store } = buildStore({
                is_accumulator: true,
                pending_landscape_selection: { symbol: 'R_50', contract_type: 'high_low' },
            });

            renderTrade(store);

            expect(screen.getByText('trade-landscape-surface')).toBeInTheDocument();
        });

        it('[LTM-004] portrait renders the mobile surface when isMobile', () => {
            media.setMatches(PHONE_LANDSCAPE_MEDIA_QUERY, false);
            mockUseDevice.mockReturnValue({ isMobile: true });
            const { store } = buildStore({ is_accumulator: true });

            renderTrade(store);

            expect(screen.getByText('trade-mobile-surface')).toBeInTheDocument();
            expect(screen.queryByText('trade-landscape-surface')).not.toBeInTheDocument();
        });

        it('[LTM-004] portrait renders the desktop surface when not isMobile', () => {
            media.setMatches(PHONE_LANDSCAPE_MEDIA_QUERY, false);
            mockUseDevice.mockReturnValue({ isMobile: false });
            const { store } = buildStore({ is_accumulator: true });

            renderTrade(store);

            expect(screen.getByText('trade-desktop-surface')).toBeInTheDocument();
        });
    });

    describe('portrait prompt', () => {
        // The prompt self-gates; the trade page only has to mount it. Core's LandscapeBlocker steps
        // aside on this route, so nothing else covers a landscape phone on a portrait-only trade type.
        it('[PPR-005] mounts the portrait prompt alongside the trade surface', () => {
            media.setMatches(PHONE_LANDSCAPE_MEDIA_QUERY, true);
            mockUseDevice.mockReturnValue({ isMobile: true });
            const { store } = buildStore({ is_accumulator: false });

            renderTrade(store);

            expect(screen.getByText('portrait-prompt')).toBeInTheDocument();
        });

        it('[PPR-008] lands the held selection once the phone reaches portrait', () => {
            media.setMatches(PHONE_LANDSCAPE_MEDIA_QUERY, false);
            mockUseDevice.mockReturnValue({ isMobile: true });
            const { store, commit_pending } = buildStore({
                pending_landscape_selection: { symbol: 'R_50', contract_type: 'high_low' },
            });

            renderTrade(store);

            expect(commit_pending).toHaveBeenCalled();
        });

        it('[PPR-008] holds the selection back while still in landscape', () => {
            media.setMatches(PHONE_LANDSCAPE_MEDIA_QUERY, true);
            mockUseDevice.mockReturnValue({ isMobile: true });
            const { store, commit_pending } = buildStore({
                is_accumulator: true,
                pending_landscape_selection: { symbol: 'R_50', contract_type: 'high_low' },
            });

            renderTrade(store);

            expect(commit_pending).not.toHaveBeenCalled();
        });
    });

    describe('lifecycle survives rotation', () => {
        it('[LTM-005] onMount/onUnmount fire only on trade mount/unmount, not on the child swap', () => {
            media.setMatches(PHONE_LANDSCAPE_MEDIA_QUERY, false);
            const { store, on_mount, on_unmount } = buildStore({ is_accumulator: true });

            const { unmount } = renderTrade(store);

            expect(on_mount).toHaveBeenCalledTimes(1);
            expect(screen.getByText('trade-mobile-surface')).toBeInTheDocument();

            // Simulate a rotate: the media query flips, the branch swaps mobile → landscape via the
            // hook's own re-render, but the trade.tsx host stays mounted.
            media.setMatches(PHONE_LANDSCAPE_MEDIA_QUERY, true);
            media.fire(PHONE_LANDSCAPE_MEDIA_QUERY);

            expect(screen.getByText('trade-landscape-surface')).toBeInTheDocument();
            expect(on_mount).toHaveBeenCalledTimes(1);
            expect(on_unmount).not.toHaveBeenCalled();

            unmount();
            expect(on_unmount).toHaveBeenCalledTimes(1);
        });
    });
});
