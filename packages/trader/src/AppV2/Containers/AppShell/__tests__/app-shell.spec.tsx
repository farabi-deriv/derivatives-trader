import { MemoryRouter } from 'react-router-dom';

import { mockStore } from '@deriv/stores';
import { render, screen } from '@testing-library/react';

import ModulesProvider from 'Stores/Providers/modules-providers';

import TraderProviders from '../../../../trader-providers';
import AppShell from '../app-shell';

jest.mock('AppV2/Components/Layout/Sidebar/sidebar', () => {
    const SidebarStub = () => <div data-testid='sidebar' />;
    return { __esModule: true, default: SidebarStub };
});
jest.mock('../../../Routes/router', () => {
    const RouterStub = () => <div />;
    return { __esModule: true, default: RouterStub };
});
// The rail is a desktop-width surface, and a phone in landscape reports 844px — i.e. not mobile.
jest.mock('@deriv-com/ui', () => ({
    ...jest.requireActual('@deriv-com/ui'),
    useDevice: jest.fn(() => ({ isMobile: false })),
}));
jest.mock('AppV2/Hooks/useIsPhoneLandscape', () => jest.fn(() => true));

const renderShell = (trade: Record<string, unknown> = {}) => {
    const store = mockStore({ modules: { trade: { ...mockStore({}).modules.trade, ...trade } } });
    render(
        <TraderProviders store={store}>
            <ModulesProvider store={store}>
                <MemoryRouter>
                    <AppShell />
                </MemoryRouter>
            </ModulesProvider>
        </TraderProviders>
    );
};

describe('AppShell', () => {
    it('[LTM-012] renders the nav rail beside the routed content', () => {
        renderShell({ is_accumulator: true });

        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });

    it('[LTM-012] drops the rail while PortraitPrompt blocks the page', () => {
        // The prompt covers the routed content only, so a rail left mounted sat beside a blank page.
        renderShell({ contract_type: 'rise_fall', is_accumulator: false });

        expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    });

    it('[LTM-012] drops it for a held selection too, which also raises the prompt', () => {
        renderShell({ is_accumulator: true, pending_landscape_selection: { contract_type: 'CALL' } });

        expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    });
});
