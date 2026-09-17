import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { KNOWN_PARAM_KEYS } from '../../automation-config';
import StakeMultiplierMobile from '../stake-multiplier-mobile';

const defaultProps = {
    param_key: KNOWN_PARAM_KEYS.MULTIPLIER,
    selectedValue: 2,
    description: 'Factor applied to the stake after each loss.',
    onSelect: jest.fn(),
};

// The sheet's own input is the editable one; the trigger field is readOnly.
const getSheetInput = () => screen.getAllByRole('textbox').find(el => !el.hasAttribute('readonly')) as HTMLElement;

const openSheet = async () => {
    await userEvent.click(screen.getAllByRole('textbox')[0]);
};

describe('StakeMultiplierMobile header actions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('disables the header save action on open (nothing changed yet)', async () => {
        render(<StakeMultiplierMobile {...defaultProps} />);
        await openSheet();

        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('enables the header save action after changing the value', async () => {
        render(<StakeMultiplierMobile {...defaultProps} />);
        await openSheet();

        await userEvent.click(screen.getByRole('button', { name: /Select value 5/ }));
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('commits the value on tapping the header save action', async () => {
        const onSelect = jest.fn();
        render(<StakeMultiplierMobile {...defaultProps} onSelect={onSelect} />);
        await openSheet();

        await userEvent.click(screen.getByRole('button', { name: /Select value 5/ }));
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSelect).toHaveBeenCalledWith(5);
    });

    it('does not commit when the sheet is dismissed via the overlay after a change', async () => {
        const onSelect = jest.fn();
        render(<StakeMultiplierMobile {...defaultProps} onSelect={onSelect} />);
        await openSheet();

        await userEvent.click(screen.getByRole('button', { name: /Select value 5/ }));
        await userEvent.click(screen.getByTestId('dt-actionsheet-overlay'));

        expect(onSelect).not.toHaveBeenCalled();
    });

    it('validates inline: shows the error and disables the header Save on a bad keystroke', async () => {
        render(<StakeMultiplierMobile {...defaultProps} />);
        await openSheet();

        fireEvent.change(getSheetInput(), { target: { value: '11' } });

        expect(screen.getByText('The value must be greater than 1 and no more than 10.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('clears the inline error and re-enables the header Save once the value is corrected', async () => {
        render(<StakeMultiplierMobile {...defaultProps} />);
        await openSheet();

        fireEvent.change(getSheetInput(), { target: { value: '1' } });
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

        fireEvent.change(getSheetInput(), { target: { value: '5' } });
        // The sentence stays on screen as the neutral hint; the error styling is what lifts.
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('does not commit an inline-invalid value when the header Save is tapped', async () => {
        const onSelect = jest.fn();
        render(<StakeMultiplierMobile {...defaultProps} onSelect={onSelect} />);
        await openSheet();

        fireEvent.change(getSheetInput(), { target: { value: '11' } });
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSelect).not.toHaveBeenCalled();
    });

    it('shows the description in the header info tooltip', async () => {
        render(<StakeMultiplierMobile {...defaultProps} />);
        await openSheet();

        fireEvent.mouseEnter(screen.getByRole('button', { name: 'Stake multiplier' }));
        expect(screen.getByText('Factor applied to the stake after each loss.')).toBeInTheDocument();
    });

    it('[ASP-001][ASP-002] disables the trigger field on a closed market with no lock overlay', () => {
        const { container } = render(<StakeMultiplierMobile {...defaultProps} is_market_closed />);

        expect(screen.getByRole('textbox')).toBeDisabled();
        // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
        expect(container.querySelector('.trade-params__lock-overlay')).toBeNull();
    });
});
