import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { KNOWN_PARAM_KEYS } from '../../automation-config';
import StakeMultiplierDesktop from '../stake-multiplier-desktop';

const defaultProps = {
    param_key: KNOWN_PARAM_KEYS.MULTIPLIER,
    selectedValue: 2,
    onSelect: jest.fn(),
};

// The editor's own input is the editable one; the trigger field is readOnly.
const getEditorInput = () => screen.getAllByRole('textbox').find(el => !el.hasAttribute('readonly')) as HTMLElement;

// Open the popover, then switch to the Custom tab where the input lives.
const openEditor = async () => {
    await userEvent.click(screen.getAllByRole('textbox')[0]);
    await userEvent.click(screen.getByText('Custom'));
};

describe('StakeMultiplierDesktop', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('[ASMR-001] shows the exclusive-range hint for the Martingale multiplier', async () => {
        render(<StakeMultiplierDesktop {...defaultProps} />);
        await openEditor();

        expect(screen.getByText('The value must be greater than 1 and no more than 10.')).toBeInTheDocument();
    });

    it('[ASMR-001] shows the "Minimum 1" hint for the D\'Alembert increment', async () => {
        render(<StakeMultiplierDesktop {...defaultProps} param_key={KNOWN_PARAM_KEYS.UNIT} />);
        await openEditor();

        expect(screen.getByText('Minimum 1')).toBeInTheDocument();
    });

    it('[ASMR-001] surfaces the bound as an error, not a hint, when validation fails', async () => {
        render(<StakeMultiplierDesktop {...defaultProps} />);
        await openEditor();

        // The hint and the error carry the same sentence now that both bounds are
        // exclusive, so presence alone proves nothing — assert the error styling.
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();

        fireEvent.change(getEditorInput(), { target: { value: '1' } });
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(screen.getByText('The value must be greater than 1 and no more than 10.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('[ASMR-001] validates inline: shows the error and disables Save on a bad keystroke, before Save is pressed', async () => {
        render(<StakeMultiplierDesktop {...defaultProps} />);
        await openEditor();

        fireEvent.change(getEditorInput(), { target: { value: '11' } });

        expect(screen.getByText('The value must be greater than 1 and no more than 10.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('[ASMR-001] clears the inline error and re-enables Save once the value is corrected', async () => {
        render(<StakeMultiplierDesktop {...defaultProps} />);
        await openEditor();

        fireEvent.change(getEditorInput(), { target: { value: '1' } });
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

        fireEvent.change(getEditorInput(), { target: { value: '5' } });
        // The sentence stays on screen as the neutral hint; the error styling is what lifts.
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('[ASMR-002] rejects a Martingale value at the exclusive lower bound and does not commit', async () => {
        const onSelect = jest.fn();
        render(<StakeMultiplierDesktop {...defaultProps} onSelect={onSelect} />);
        await openEditor();

        fireEvent.change(getEditorInput(), { target: { value: '1' } });
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSelect).not.toHaveBeenCalled();
        expect(screen.getByText('The value must be greater than 1 and no more than 10.')).toBeInTheDocument();
    });

    it('[ASMR-002] commits an in-range Martingale value and closes the editor', async () => {
        const onSelect = jest.fn();
        render(<StakeMultiplierDesktop {...defaultProps} onSelect={onSelect} />);
        await openEditor();

        fireEvent.change(getEditorInput(), { target: { value: '5' } });
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSelect).toHaveBeenCalledWith(5);
        expect(screen.queryByText('Custom')).not.toBeInTheDocument();
    });

    it('[ASMR-002] commits the inclusive upper-bound value (10) and closes the editor', async () => {
        const onSelect = jest.fn();
        render(<StakeMultiplierDesktop {...defaultProps} onSelect={onSelect} />);
        await openEditor();

        fireEvent.change(getEditorInput(), { target: { value: '10' } });
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSelect).toHaveBeenCalledWith(10);
        expect(screen.queryByText('Custom')).not.toBeInTheDocument();
    });

    it('[ASMR-002] rejects a Martingale value above the inclusive upper bound', async () => {
        const onSelect = jest.fn();
        render(<StakeMultiplierDesktop {...defaultProps} onSelect={onSelect} />);
        await openEditor();

        fireEvent.change(getEditorInput(), { target: { value: '11' } });
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSelect).not.toHaveBeenCalled();
        expect(screen.getByText('The value must be greater than 1 and no more than 10.')).toBeInTheDocument();
    });

    it("[ASMR-002] keeps the D'Alembert floor at 1, which the multiplier range rejects", async () => {
        const onSelect = jest.fn();
        render(<StakeMultiplierDesktop {...defaultProps} param_key={KNOWN_PARAM_KEYS.UNIT} onSelect={onSelect} />);
        await openEditor();

        fireEvent.change(getEditorInput(), { target: { value: '1' } });
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSelect).toHaveBeenCalledWith(1);
    });

    it('[ASMR-002] lets the user recover from an out-of-range error by correcting the value', async () => {
        const onSelect = jest.fn();
        render(<StakeMultiplierDesktop {...defaultProps} onSelect={onSelect} />);
        await openEditor();

        fireEvent.change(getEditorInput(), { target: { value: '1' } });
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

        fireEvent.change(getEditorInput(), { target: { value: '5' } });
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSelect).toHaveBeenCalledWith(5);
    });

    // Regression for the cold-load collision: before `auto_list_strategies` resolves,
    // `schema_keys` falls back to every KNOWN_PARAM_KEY and `config.strategy` defaults
    // to 'martingale', so the increment editor renders while the strategy is still
    // 'martingale'. The bounds must follow the parameter being edited, not that strategy.
    describe('increment field rendered while the strategy is still Martingale', () => {
        const increment_props = { ...defaultProps, param_key: KNOWN_PARAM_KEYS.UNIT };

        it('shows the increment hint, not the multiplier range', async () => {
            render(<StakeMultiplierDesktop {...increment_props} />);
            await openEditor();

            expect(screen.getByText('Minimum 1')).toBeInTheDocument();
            expect(screen.queryByText('The value must be greater than 1 and no more than 10.')).not.toBeInTheDocument();
        });

        it('commits an increment of 1 instead of rejecting it', async () => {
            const onSelect = jest.fn();
            render(<StakeMultiplierDesktop {...increment_props} onSelect={onSelect} />);
            await openEditor();

            fireEvent.change(getEditorInput(), { target: { value: '1' } });
            await userEvent.click(screen.getByRole('button', { name: 'Save' }));

            expect(onSelect).toHaveBeenCalledWith(1);
            expect(screen.queryByText('The value must be greater than 1 and no more than 10.')).not.toBeInTheDocument();
        });
    });
});
