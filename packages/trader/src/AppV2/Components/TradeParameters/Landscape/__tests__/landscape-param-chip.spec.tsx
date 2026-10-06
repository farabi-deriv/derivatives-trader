import { fireEvent, render, screen } from '@testing-library/react';

import LandscapeParamChip from '../landscape-param-chip';
import { TLandscapeParamAdapter } from '../types';

const makeAdapter = (overrides: Partial<TLandscapeParamAdapter> = {}): TLandscapeParamAdapter => ({
    key: 'stake',
    label: 'Stake',
    display_value: '$5.00',
    is_disabled: false,
    last_index: 100,
    selected_index: 50,
    labelAt: (index: number) => `$${index}`,
    commit: jest.fn(),
    getHint: () => null,
    shouldBlockCommit: () => false,
    ...overrides,
});

const renderChip = (props: Partial<React.ComponentProps<typeof LandscapeParamChip>> = {}) =>
    render(
        <LandscapeParamChip
            adapter={makeAdapter()}
            index={50}
            is_active={false}
            onOpen={jest.fn()}
            onStep={jest.fn()}
            onSettle={jest.fn()}
            {...props}
        />
    );

describe('LandscapeParamChip', () => {
    afterEach(() => jest.clearAllMocks());

    it('[LTP-012] exposes spinbutton semantics with the current value', () => {
        renderChip();
        const chip = screen.getByRole('spinbutton');

        expect(chip).toHaveAttribute('aria-valuenow', '50');
        expect(chip).toHaveAttribute('aria-valuemin', '0');
        expect(chip).toHaveAttribute('aria-valuemax', '100');
        expect(chip).toHaveAttribute('aria-valuetext', '$50');
        expect(chip).toHaveAttribute('aria-label', 'Stake');
    });

    it('[LTP-012] arrow keys step the ladder', () => {
        const onStep = jest.fn();
        renderChip({ is_active: true, onStep });
        const chip = screen.getByRole('spinbutton');

        fireEvent.keyDown(chip, { key: 'ArrowUp' });
        expect(onStep).toHaveBeenCalledWith(1);

        fireEvent.keyDown(chip, { key: 'ArrowDown' });
        expect(onStep).toHaveBeenCalledWith(-1);
    });

    it('[LTP-008] the chip takes no error/status prop, so it can never carry an error class', () => {
        // A structural guard: the chip has no way to render red — its type has no error/status prop.
        renderChip();

        expect(screen.getByRole('spinbutton')).not.toHaveClass('landscape-params__chip--error');
    });

    it.each([true, false])('[LTP-013] tapping take profit opens its panel like stake when is_on=%s', is_on => {
        // The switch lives in the panel now, so the chip itself never toggles.
        const toggle = jest.fn();
        const onOpen = jest.fn();
        renderChip({ adapter: makeAdapter({ key: 'take_profit', is_on, toggle }), onOpen });

        fireEvent.click(screen.getByRole('spinbutton'));

        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(toggle).not.toHaveBeenCalled();
    });

    it('[LTP-013] a non-switchable chip opens its panel on tap', () => {
        // The tap IS the open now — the panel hosts the scrolling, so it has to be on screen first.
        const onOpen = jest.fn();
        renderChip({ onOpen });

        fireEvent.click(screen.getByRole('spinbutton'));

        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it('[LTP-013] the chip never steps its own value on drag', () => {
        // The gesture moved to the panel; a drag across the chip must do nothing at all.
        const onStep = jest.fn();
        renderChip({ is_active: true, onStep });
        const chip = screen.getByRole('spinbutton');

        fireEvent.pointerDown(chip, { clientY: 200 });
        fireEvent.pointerMove(chip, { clientY: 100 });
        fireEvent.pointerUp(chip, { clientY: 100 });
        fireEvent.wheel(chip, { deltaY: -300 });

        expect(onStep).not.toHaveBeenCalled();
    });

    it('[LTP-019] a disabled chip ignores input and is marked disabled', () => {
        const onOpen = jest.fn();
        renderChip({ adapter: makeAdapter({ is_disabled: true }), onOpen });
        const chip = screen.getByRole('spinbutton');

        fireEvent.click(chip);
        fireEvent.keyDown(chip, { key: 'ArrowUp' });

        expect(onOpen).not.toHaveBeenCalled();
        expect(chip).toHaveClass('landscape-params__chip--disabled');
        expect(chip).toHaveAttribute('aria-disabled', 'true');
        expect(chip).toHaveAttribute('tabindex', '-1');
    });

    it('[LTP-007] take profit never steps while off — only its switch turns it on', () => {
        const onStep = jest.fn();
        renderChip({ adapter: makeAdapter({ key: 'take_profit', is_on: false, toggle: jest.fn() }), onStep });

        fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'ArrowUp' });

        expect(onStep).not.toHaveBeenCalled();
    });
});
