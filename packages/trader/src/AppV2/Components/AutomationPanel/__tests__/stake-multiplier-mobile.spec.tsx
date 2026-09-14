import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { KNOWN_PARAM_KEYS } from '../automation-config';
import StakeMultiplierMobile from '../StakeMultiplier/stake-multiplier-mobile';

const defaultProps = {
    param_key: KNOWN_PARAM_KEYS.MULTIPLIER,
    selectedValue: 2,
    onSelect: jest.fn(),
};

// The sheet's own input is the editable one; the trigger field is readOnly.
const getSheetInput = () => screen.getAllByRole('textbox').find(el => !el.hasAttribute('readonly')) as HTMLElement;

const openSheet = async () => {
    await userEvent.click(screen.getAllByRole('textbox')[0]);
};

describe('StakeMultiplierMobile', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('opens a single view with no Quick picks / Custom tabs', async () => {
        render(<StakeMultiplierMobile {...defaultProps} />);
        await openSheet();

        expect(screen.queryByText('Quick picks')).not.toBeInTheDocument();
        expect(screen.queryByText('Custom')).not.toBeInTheDocument();
        // Input and presets are visible together.
        expect(getSheetInput()).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Select value 5/ })).toBeInTheDocument();
    });

    it('shows the exclusive range for the multiplier and a minimum for the increment', async () => {
        const { unmount } = render(<StakeMultiplierMobile {...defaultProps} />);
        await openSheet();
        expect(screen.getByText('The value must be greater than 1 and no more than 10.')).toBeInTheDocument();
        unmount();

        render(<StakeMultiplierMobile {...defaultProps} param_key={KNOWN_PARAM_KEYS.UNIT} />);
        await openSheet();
        expect(screen.getByText('Minimum 1')).toBeInTheDocument();
    });

    it('fills the input on a preset tap without committing or closing', async () => {
        const onSelect = jest.fn();
        render(<StakeMultiplierMobile {...defaultProps} onSelect={onSelect} />);
        await openSheet();

        await userEvent.click(screen.getByRole('button', { name: /Select value 5/ }));

        expect(getSheetInput()).toHaveValue('5');
        expect(onSelect).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('commits the value on Save', async () => {
        const onSelect = jest.fn();
        render(<StakeMultiplierMobile {...defaultProps} onSelect={onSelect} />);
        await openSheet();

        await userEvent.click(screen.getByRole('button', { name: /Select value 5/ }));
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSelect).toHaveBeenCalledWith(5);
    });

    it('rejects a multiplier of 1 but allows 1 as an increment', async () => {
        const onSelect = jest.fn();
        const { unmount } = render(<StakeMultiplierMobile {...defaultProps} onSelect={onSelect} />);
        await openSheet();

        await userEvent.clear(getSheetInput());
        await userEvent.type(getSheetInput(), '1');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSelect).not.toHaveBeenCalled();
        expect(screen.getByText('The value must be greater than 1 and no more than 10.')).toBeInTheDocument();
        unmount();

        render(<StakeMultiplierMobile {...defaultProps} param_key={KNOWN_PARAM_KEYS.UNIT} onSelect={onSelect} />);
        await openSheet();
        await userEvent.clear(getSheetInput());
        await userEvent.type(getSheetInput(), '1');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSelect).toHaveBeenCalledWith(1);
    });

    it('rejects a multiplier above the inclusive upper bound', async () => {
        const onSelect = jest.fn();
        render(<StakeMultiplierMobile {...defaultProps} onSelect={onSelect} />);
        await openSheet();

        await userEvent.clear(getSheetInput());
        await userEvent.type(getSheetInput(), '11');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSelect).not.toHaveBeenCalled();
        expect(screen.getByText('The value must be greater than 1 and no more than 10.')).toBeInTheDocument();
    });
});
