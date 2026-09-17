import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import StrategySelectorMobile from '../strategy-selector-mobile';

const options = [
    { value: 'martingale', label: 'Martingale', description: 'Doubles the stake after each loss.' },
    { value: 'dalembert', label: "D'Alembert", description: 'Increases the stake by one unit after each loss.' },
];

const defaultProps = {
    options,
    selectedValue: 'martingale',
    onSelect: jest.fn(),
};

const openSheet = async () => {
    await userEvent.click(screen.getAllByRole('textbox')[0]);
};

describe('StrategySelectorMobile', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('disables the header save action on open (nothing changed yet)', async () => {
        render(<StrategySelectorMobile {...defaultProps} />);
        await openSheet();

        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('enables the header save action after previewing a different strategy', async () => {
        render(<StrategySelectorMobile {...defaultProps} />);
        await openSheet();

        await userEvent.click(screen.getByRole('button', { name: "D'Alembert" }));
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('commits the previewed strategy on tapping the header save action', async () => {
        const onSelect = jest.fn();
        render(<StrategySelectorMobile {...defaultProps} onSelect={onSelect} />);
        await openSheet();

        await userEvent.click(screen.getByRole('button', { name: "D'Alembert" }));
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSelect).toHaveBeenCalledWith('dalembert');
    });

    it('does not commit when the sheet is dismissed via the overlay after previewing', async () => {
        const onSelect = jest.fn();
        render(<StrategySelectorMobile {...defaultProps} onSelect={onSelect} />);
        await openSheet();

        await userEvent.click(screen.getByRole('button', { name: "D'Alembert" }));
        await userEvent.click(screen.getByTestId('dt-actionsheet-overlay'));

        expect(onSelect).not.toHaveBeenCalled();
    });

    it('shows the strategy description in the header info tooltip', async () => {
        render(<StrategySelectorMobile {...defaultProps} />);
        await openSheet();

        fireEvent.mouseEnter(screen.getByRole('button', { name: 'Strategy' }));
        expect(screen.getByText('Doubles the stake after each loss.')).toBeInTheDocument();
    });

    it('[ASP-001][ASP-002] disables the trigger field on a closed market with no lock overlay', () => {
        const { container } = render(<StrategySelectorMobile {...defaultProps} is_market_closed />);

        expect(screen.getByRole('textbox')).toBeDisabled();
        // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
        expect(container.querySelector('.trade-params__lock-overlay')).toBeNull();
    });
});
