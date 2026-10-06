import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import useIsPhoneViewport from 'AppV2/Hooks/useIsPhoneViewport';

import MarketChangesDropdown from '../market-changes-dropdown';

jest.mock('@deriv-com/ui', () => ({
    ...jest.requireActual('@deriv-com/ui'),
    useDevice: jest.fn(() => ({ isMobile: false })),
}));
jest.mock('AppV2/Hooks/useIsPhoneViewport', () => jest.fn(() => false));

const mockUseIsPhoneViewport = useIsPhoneViewport as jest.Mock;

const openMenu = () => userEvent.click(screen.getByRole('button', { name: /changes/i }));
// The anchored popover is the only listbox; the sheet renders bare options instead.
const getPopover = () => screen.queryByRole('listbox');

describe('MarketChangesDropdown', () => {
    afterEach(() => mockUseIsPhoneViewport.mockReturnValue(false));

    it('[MCD-001] gives a phone in landscape the same sheet as portrait, not the popover', async () => {
        // `useDevice().isMobile` is width-only, so an 844px landscape phone read as desktop and took
        // the anchored popover — which a 390px-tall viewport cut off at the top.
        mockUseIsPhoneViewport.mockReturnValue(true);
        render(<MarketChangesDropdown selected_window='1m' onSelect={jest.fn()} />);

        await openMenu();

        expect(screen.getByText('Change period')).toBeInTheDocument();
        expect(getPopover()).not.toBeInTheDocument();
    });

    it('[MCD-001] keeps the anchored popover on a real desktop', async () => {
        render(<MarketChangesDropdown selected_window='1m' onSelect={jest.fn()} />);

        await openMenu();

        expect(getPopover()).toBeInTheDocument();
    });

    it('[MCD-002] selecting a window reports it and closes', async () => {
        const onSelect = jest.fn();
        mockUseIsPhoneViewport.mockReturnValue(true);
        render(<MarketChangesDropdown selected_window='1m' onSelect={onSelect} />);

        await openMenu();
        await userEvent.click(screen.getByRole('option', { name: '1 hour' }));

        expect(onSelect).toHaveBeenCalledWith('1h');
    });
});
