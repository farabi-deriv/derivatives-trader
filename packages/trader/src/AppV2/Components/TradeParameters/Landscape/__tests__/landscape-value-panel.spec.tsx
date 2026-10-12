import { renderToStaticMarkup } from 'react-dom/server';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';

import LandscapeValuePanel from '../landscape-value-panel';
import { TLandscapeParamAdapter } from '../types';
import useLandscapeParamEditor from '../use-landscape-param-editor';

const makeAdapter = (overrides: Partial<TLandscapeParamAdapter> = {}): TLandscapeParamAdapter => ({
    key: 'stake',
    label: 'Stake',
    display_value: '$5.00',
    is_disabled: false,
    last_index: 100,
    selected_index: 50,
    labelAt: (index: number) => `$${index}`,
    commit: jest.fn(),
    ...overrides,
});

describe('useLandscapeParamEditor', () => {
    it('[LTP-006] settle commits once on a new value', () => {
        const adapter = makeAdapter();
        const { result } = renderHook(() => useLandscapeParamEditor(adapter));

        act(() => result.current.open(adapter));
        act(() => result.current.stepBy(2));
        act(() => result.current.settle());

        expect(adapter.commit).toHaveBeenCalledTimes(1);
        expect(adapter.commit).toHaveBeenCalledWith(52);
    });

    it('[LTP-006] re-settling on the same value is a no-op', () => {
        const adapter = makeAdapter();
        const { result } = renderHook(() => useLandscapeParamEditor(adapter));

        act(() => result.current.open(adapter));
        act(() => result.current.stepBy(2));
        act(() => result.current.settle());
        act(() => result.current.settle());

        expect(adapter.commit).toHaveBeenCalledTimes(1);
    });

    it('[LTP-006] opening on a (fractional) stored value does not commit', () => {
        const adapter = makeAdapter();
        const { result } = renderHook(() => useLandscapeParamEditor(adapter));

        act(() => result.current.open(adapter));
        act(() => result.current.settle());

        expect(adapter.commit).not.toHaveBeenCalled();
    });
});

describe('LandscapeValuePanel', () => {
    it('[LTP-005] renders exactly three rows however large the range', () => {
        const adapter = makeAdapter({ last_index: 999999 });
        render(<LandscapeValuePanel adapter={adapter} index={500000} onStep={jest.fn()} onSettle={jest.fn()} />);

        expect(screen.getAllByTestId(/^dt_landscape_value_row_/)).toHaveLength(3);
    });
});

describe('LandscapeValuePanel — take profit', () => {
    const makeTakeProfit = (overrides: Partial<TLandscapeParamAdapter> = {}) =>
        makeAdapter({ key: 'take_profit', label: 'Take profit', is_on: true, toggle: jest.fn(), ...overrides });

    it('[LTP-007] has no switch for stake, which cannot be turned off', () => {
        render(<LandscapeValuePanel adapter={makeAdapter()} index={50} onStep={jest.fn()} onSettle={jest.fn()} />);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it.each([true, false])('[LTP-007] paints the switch as is_on=%s on open, rather than sliding there', is_on => {
        // Static markup runs no effects, so it is the first paint — where a slide-in from off shows.
        expect(
            renderToStaticMarkup(
                <LandscapeValuePanel
                    adapter={makeTakeProfit({ is_on })}
                    index={7}
                    onStep={jest.fn()}
                    onSettle={jest.fn()}
                />
            )
        ).toContain(`aria-pressed="${is_on}"`);
    });

    it('[LTP-007] switches take profit at the value on show', () => {
        const adapter = makeTakeProfit();
        render(<LandscapeValuePanel adapter={adapter} index={7} onStep={jest.fn()} onSettle={jest.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Take profit' }));

        expect(adapter.toggle).toHaveBeenCalledWith(7);
    });

    it('[LTP-007] tags the switch by its label, which toggles it — quill ToggleSwitch drops data-testid', () => {
        const adapter = makeTakeProfit();
        render(<LandscapeValuePanel adapter={adapter} index={7} onStep={jest.fn()} onSettle={jest.fn()} />);

        fireEvent.click(screen.getByTestId('dt_landscape_take_profit_toggle'));

        expect(adapter.toggle).toHaveBeenCalledWith(7);
    });

    it('[LTP-007] fades the ladder while off and ignores scrolling — only the switch turns it on', () => {
        const onStep = jest.fn();
        render(
            <LandscapeValuePanel
                adapter={makeTakeProfit({ is_on: false })}
                index={7}
                onStep={onStep}
                onSettle={jest.fn()}
            />
        );

        fireEvent.wheel(screen.getByTestId('dt_landscape_value_panel'), { deltaY: -300 });

        expect(screen.getByTestId('dt_landscape_value_rows')).toHaveClass('landscape-value-rows--off');
        expect(onStep).not.toHaveBeenCalled();
    });

    it('[LTP-007] scrolls as normal once on', () => {
        const onStep = jest.fn();
        render(<LandscapeValuePanel adapter={makeTakeProfit()} index={7} onStep={onStep} onSettle={jest.fn()} />);

        fireEvent.wheel(screen.getByTestId('dt_landscape_value_panel'), { deltaY: -300 });

        expect(screen.getByTestId('dt_landscape_value_rows')).not.toHaveClass('landscape-value-rows--off');
        expect(onStep).toHaveBeenCalled();
    });
});
