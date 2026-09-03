import React from 'react';
import { useLocation } from 'react-router';

import { mockStore } from '@deriv/stores';
import { SnackbarProvider } from '@deriv-com/quill-ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetErrorSnackbarDedupe } from 'AppV2/Hooks/useErrorSnackbar';
import { SERVICE_ERROR } from 'AppV2/Utils/layout-utils';

import TraderProviders from '../../../../trader-providers';
import ServicesErrorSnackbar from '../services-error-snackbar';

const tnc_url = 'https://docs.deriv.com/tnc/trading-terms.pdf';

jest.mock('react-router', () => ({
    useLocation: jest.fn(),
}));
jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    // The URL itself is covered by the @deriv/shared url tests.
    getStaticUrl: jest.fn(() => tnc_url),
}));

/**
 * These specs render the real quill-ui snackbar (no `useSnackbar` mock) so the whole
 * click path is exercised: queued snackbar -> rendered action button -> navigation.
 */
describe('ServicesErrorSnackbar action', () => {
    let default_mock_store: ReturnType<typeof mockStore>,
        original_open: typeof window.open,
        original_location: PropertyDescriptor | undefined;

    beforeEach(() => {
        // The dedupe record in useErrorSnackbar is module scope, so it outlives a single render.
        resetErrorSnackbarDedupe();
        (useLocation as jest.Mock).mockReturnValue({ pathname: '/' });
        default_mock_store = mockStore({
            client: { is_logged_in: true },
            common: {
                services_error: {
                    code: SERVICE_ERROR.COMPANY_WIDE_LIMIT_EXCEEDED,
                    message: 'No further trading is allowed on this contract type.',
                    type: 'buy',
                },
                resetServicesError: jest.fn(),
            },
        });

        original_open = window.open;
        original_location = Object.getOwnPropertyDescriptor(window, 'location');
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { href: '', hostname: 'localhost' },
            writable: true,
        });
    });

    afterEach(() => {
        window.open = original_open;
        if (original_location) Object.defineProperty(window, 'location', original_location);
    });

    const mockServicesErrorSnackbar = () =>
        render(
            <TraderProviders store={default_mock_store}>
                <SnackbarProvider>
                    <ServicesErrorSnackbar />
                </SnackbarProvider>
            </TraderProviders>
        );

    it('opens the terms and conditions document in a new tab when View is clicked', async () => {
        const document_window = { opener: window } as unknown as Window;
        window.open = jest.fn(() => document_window);
        mockServicesErrorSnackbar();

        await userEvent.click(await screen.findByRole('button', { name: 'View' }));

        expect(window.open).toHaveBeenCalledWith(tnc_url, '_blank');
        // The current tab must stay on the trading page when a new tab was opened.
        expect(window.location.href).toBe('');
        expect(document_window.opener).toBeNull();
    });

    it('falls back to same tab navigation when opening a new tab is refused', async () => {
        // Pop-up blockers and in-app webviews return null instead of a window.
        window.open = jest.fn(() => null);
        mockServicesErrorSnackbar();

        await userEvent.click(await screen.findByRole('button', { name: 'View' }));

        expect(window.location.href).toBe(tnc_url);
    });

    it('falls back to same tab navigation when opening a new tab throws', async () => {
        window.open = jest.fn(() => {
            throw new Error('blocked');
        });
        mockServicesErrorSnackbar();

        await userEvent.click(await screen.findByRole('button', { name: 'View' }));

        expect(window.location.href).toBe(tnc_url);
    });

    it('renders a single snackbar with one View action', async () => {
        window.open = jest.fn(() => ({ opener: window }) as unknown as Window);
        mockServicesErrorSnackbar();

        expect(await screen.findByRole('button', { name: 'View' })).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'View' })).toHaveLength(1);
    });

    it('does not render the View action for errors other than the company wide limit', async () => {
        default_mock_store.common.services_error = {
            code: 'SomeAwesomeError',
            message: 'Mock error message',
            type: 'buy',
        };
        mockServicesErrorSnackbar();

        expect(await screen.findByText('Mock error message')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();
    });
});
