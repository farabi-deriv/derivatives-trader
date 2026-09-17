import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ThresholdInputMobile from '../threshold-input-mobile';

const defaultProps = {
    threshold_type: 'take_profit' as const,
    description: 'Stop when total payout minus total stake reaches this value.',
    currency: 'USD',
    initialValue: 10,
    onSave: jest.fn(),
};

// The sheet's own input is the editable one; the trigger field is readOnly.
const getSheetInput = () => screen.getAllByRole('textbox').find(el => !el.hasAttribute('readonly')) as HTMLElement;

const openSheet = async () => {
    await userEvent.click(screen.getAllByRole('textbox')[0]);
};

describe('ThresholdInputMobile', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('disables the header save action on open (nothing changed yet)', async () => {
        render(<ThresholdInputMobile {...defaultProps} />);
        await openSheet();

        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('enables the header save action after changing the value', async () => {
        render(<ThresholdInputMobile {...defaultProps} />);
        await openSheet();

        await userEvent.clear(getSheetInput());
        await userEvent.type(getSheetInput(), '20');
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('commits the value on tapping the header save action', async () => {
        const onSave = jest.fn();
        render(<ThresholdInputMobile {...defaultProps} onSave={onSave} />);
        await openSheet();

        await userEvent.clear(getSheetInput());
        await userEvent.type(getSheetInput(), '20');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSave).toHaveBeenCalledWith(20);
    });

    it('does not commit when the sheet is dismissed via the overlay after a change', async () => {
        const onSave = jest.fn();
        render(<ThresholdInputMobile {...defaultProps} onSave={onSave} />);
        await openSheet();

        await userEvent.clear(getSheetInput());
        await userEvent.type(getSheetInput(), '20');
        await userEvent.click(screen.getByTestId('dt-actionsheet-overlay'));

        expect(onSave).not.toHaveBeenCalled();
    });

    it('shows the description in the header info tooltip', async () => {
        render(<ThresholdInputMobile {...defaultProps} />);
        await openSheet();

        fireEvent.mouseEnter(screen.getByRole('button', { name: 'Profit threshold' }));
        expect(screen.getByText('Stop when total payout minus total stake reaches this value.')).toBeInTheDocument();
    });

    it('[ASP-001][ASP-002] disables the trigger field on a closed market with no lock overlay', () => {
        const { container } = render(<ThresholdInputMobile {...defaultProps} is_market_closed />);

        expect(screen.getByRole('textbox')).toBeDisabled();
        // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
        expect(container.querySelector('.trade-params__lock-overlay')).toBeNull();
    });
});
