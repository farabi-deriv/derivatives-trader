import { MemoryRouter } from 'react-router-dom';

import { SessionStore } from '@deriv/shared';
import { mockStore, StoreProvider } from '@deriv/stores';
import { render, screen } from '@testing-library/react';

import AppModals from '../app-modals';

jest.mock('../RedirectToLoginModal', () => {
    const RedirectToLoginModal = () => <div>RedirectToLoginModal</div>;
    RedirectToLoginModal.displayName = 'RedirectToLoginModal';
    return { __esModule: true, default: RedirectToLoginModal };
});
jest.mock('../UrlUnavailableModal', () => {
    const UrlUnavailableModal = () => <div>UrlUnavailableModal</div>;
    UrlUnavailableModal.displayName = 'UrlUnavailableModal';
    return { __esModule: true, default: UrlUnavailableModal };
});
jest.mock('../TryRealModal', () => {
    const TryRealModal = () => <div>TryRealModal</div>;
    TryRealModal.displayName = 'TryRealModal';
    return { __esModule: true, default: TryRealModal };
});

const renderAt = (search: string) =>
    render(
        <MemoryRouter initialEntries={[`/${search}`]}>
            <StoreProvider store={mockStore({})}>
                <AppModals />
            </StoreProvider>
        </MemoryRouter>
    );

describe('AppModals', () => {
    it('[DCR-018] renders the login redirect modal from the URL action parameter', async () => {
        renderAt('?action=redirect_to_login');
        expect(await screen.findByText('RedirectToLoginModal')).toBeInTheDocument();
    });

    it('[DCR-018] no longer falls back to the session signup_query_param', async () => {
        const session_get = jest.spyOn(SessionStore, 'get');
        renderAt('');

        expect(session_get).not.toHaveBeenCalled();
        expect(screen.queryByText('RedirectToLoginModal')).not.toBeInTheDocument();
        session_get.mockRestore();
    });
});
