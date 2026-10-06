import React from 'react';

import { mockStore, StoreProvider } from '@deriv/stores';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import useIsPhoneLandscape from 'AppV2/Hooks/useIsPhoneLandscape';

import AccountHeader from '../account-header';

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    getCurrencyDisplayCode: jest.fn((currency: string) => currency),
    redirectToLogin: jest.fn(),
    trackAnalyticsEvent: jest.fn(),
    getApiCoreBaseUrl: jest.fn(() => 'https://api.deriv.com'),
    addComma: jest.fn((num: number | string) => String(num)),
}));

jest.mock('@deriv/api', () => ({
    ...jest.requireActual('@deriv/api'),
    useDerivativesAccount: () => ({
        data: {
            data: [
                { account_id: 'ROT90070611', account_type: 'real', balance: '10000.00', currency: 'USD' },
                { account_id: 'DOT90096855', account_type: 'demo', balance: '5000.00', currency: 'USD' },
            ],
        },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
    }),
}));

jest.mock('@deriv-com/ui', () => ({ useDevice: jest.fn(() => ({ isMobile: false })) }));
jest.mock('AppV2/Hooks/useIsPhoneLandscape', () => jest.fn(() => false));
jest.mock('@deriv/quill-icons', () => ({ LegacyChevronDown1pxIcon: () => <div /> }));
jest.mock('@deriv-com/quill-ui', () => ({
    ActionSheet: {
        Root: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Portal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    },
}));

// Stands in for the real portal, so "was it portalled out of the clipping header?" is a plain query
// rather than a walk up the DOM.
jest.mock('AppV2/Components/InputPopover', () => ({
    InputPopover: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
        isOpen ? <div data-testid='switcher-popover'>{children}</div> : null,
}));

jest.mock('@deriv/core/src/App/Components/Layout/Header/account-switcher', () =>
    jest.fn(({ is_open }: { is_open: boolean }) =>
        is_open ? <div data-testid='account-switcher'>Account Switcher</div> : null
    )
);

const mockUseIsPhoneLandscape = useIsPhoneLandscape as jest.Mock;

const renderHeader = (props = {}) => {
    const store = mockStore({
        client: { balance: '10000.00', currency: 'USD', is_logged_in: true, is_virtual: false },
        ui: { is_switching_account: false, setIsSwitchingAccount: jest.fn() },
    });
    return render(
        <StoreProvider store={store}>
            <AccountHeader {...props} />
        </StoreProvider>
    );
};

describe('AccountHeader in landscape', () => {
    beforeEach(() => mockUseIsPhoneLandscape.mockReturnValue(true));

    it('[AHL-001] portals the switcher out of the header, which clips it', async () => {
        renderHeader();

        await userEvent.click(screen.getByText('Real account'));

        // The trade header sets `overflow: hidden` for its collapse animation and the dropdown opens
        // below it, so a switcher left inline renders but is never visible.
        const popover = screen.getByTestId('switcher-popover');
        expect(within(popover).getByTestId('account-switcher')).toBeInTheDocument();
    });

    it('[AHL-002] keeps the switcher inline outside landscape', async () => {
        mockUseIsPhoneLandscape.mockReturnValue(false);
        renderHeader();

        await userEvent.click(screen.getByText('Real account'));

        expect(screen.getByTestId('account-switcher')).toBeInTheDocument();
        expect(screen.queryByTestId('switcher-popover')).not.toBeInTheDocument();
    });

    it('[AHL-003] reports the dropdown open state so the chrome auto-hide can pause', async () => {
        const onDropdownOpenChange = jest.fn();
        renderHeader({ onDropdownOpenChange });

        onDropdownOpenChange.mockClear();
        await userEvent.click(screen.getByText('Real account'));
        expect(onDropdownOpenChange).toHaveBeenLastCalledWith(true);

        await userEvent.click(screen.getByText('Real account'));
        expect(onDropdownOpenChange).toHaveBeenLastCalledWith(false);
    });

    it('[AHL-003] releases the pause if it unmounts while open', async () => {
        const onDropdownOpenChange = jest.fn();
        const { unmount } = renderHeader({ onDropdownOpenChange });

        await userEvent.click(screen.getByText('Real account'));
        onDropdownOpenChange.mockClear();
        unmount();

        // A rotate or navigation away would otherwise leave the chrome pinned open for good.
        expect(onDropdownOpenChange).toHaveBeenCalledWith(false);
    });
});
