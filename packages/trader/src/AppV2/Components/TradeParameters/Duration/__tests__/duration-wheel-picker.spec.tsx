import React from 'react';

import { act, render, screen } from '@testing-library/react';

import { DURATION_UNIT } from 'AppV2/Utils/trade-params-utils';
import { useTraderStore } from 'Stores/useTraderStores';

import { DurationTimeWheel } from '../duration-wheel-picker';

type TWheelOption = { value: number; label: string };
type TWheelPickerProps = {
    data: TWheelOption[][];
    setInputValues: (column_index: number, value: string | number) => void;
};

const mockWheelPickerDataCalls: TWheelOption[][][] = [];
let latest_wheel_picker_props: TWheelPickerProps;

jest.mock('@deriv-com/quill-ui', () => ({
    ...jest.requireActual('@deriv-com/quill-ui'),
    WheelPickerContainer: (props: TWheelPickerProps) => {
        mockWheelPickerDataCalls.push(props.data);
        latest_wheel_picker_props = props;
        return <div data-testid='wheel-picker' data-props={JSON.stringify(props.data)} />;
    },
}));

jest.mock('Stores/useTraderStores', () => ({
    useTraderStore: jest.fn(),
}));

const mockUseTraderStore = useTraderStore as jest.Mock;

const duration_units_list = [
    { value: DURATION_UNIT.HOURS, text: 'hours' },
    { value: DURATION_UNIT.MINUTES, text: 'minutes' },
    { value: DURATION_UNIT.SECONDS, text: 'seconds' },
];

const getSecondsColumnValues = () => {
    const data = JSON.parse(screen.getByTestId('wheel-picker').getAttribute('data-props') ?? '[]');
    return data[2].map((option: { value: number }) => option.value);
};

describe('DurationTimeWheel', () => {
    beforeEach(() => {
        mockWheelPickerDataCalls.length = 0;
        mockUseTraderStore.mockReturnValue({
            duration_min_max: { intraday: { min: 15, max: 3600 } },
            duration_units_list,
        });
    });

    it('[DTW-001] renders the seconds column starting at the intraday minimum when hours and minutes are both 0', () => {
        render(<DurationTimeWheel selected_time={[0, 0, 15]} setSelectedTime={jest.fn()} />);
        expect(Math.min(...getSecondsColumnValues())).toBe(15);
    });

    it('[DTW-002] renders the seconds column from 0 once minutes alone already covers the intraday minimum', () => {
        render(<DurationTimeWheel selected_time={[0, 1, 0]} setSelectedTime={jest.fn()} />);
        expect(Math.min(...getSecondsColumnValues())).toBe(0);
    });

    it('[DTW-002] keeps a column data reference stable when only that column is scrolled', () => {
        const { rerender } = render(<DurationTimeWheel selected_time={[0, 1, 5]} setSelectedTime={jest.fn()} />);
        const first_seconds_data = mockWheelPickerDataCalls[mockWheelPickerDataCalls.length - 1][2];

        rerender(<DurationTimeWheel selected_time={[0, 1, 6]} setSelectedTime={jest.fn()} />);
        const second_seconds_data = mockWheelPickerDataCalls[mockWheelPickerDataCalls.length - 1][2];

        expect(second_seconds_data).toBe(first_seconds_data);
    });

    it('[DTW-002] rebuilds only the finer column data when a coarser column selection changes its floor', () => {
        const { rerender } = render(<DurationTimeWheel selected_time={[0, 1, 0]} setSelectedTime={jest.fn()} />);
        const [first_hours_data, , first_seconds_data] = mockWheelPickerDataCalls[mockWheelPickerDataCalls.length - 1];

        rerender(<DurationTimeWheel selected_time={[0, 0, 0]} setSelectedTime={jest.fn()} />);
        const [second_hours_data, , second_seconds_data] =
            mockWheelPickerDataCalls[mockWheelPickerDataCalls.length - 1];

        expect(second_hours_data).toBe(first_hours_data);
        expect(second_seconds_data).not.toBe(first_seconds_data);
    });

    it('[DTW-002] clamps a finer column immediately when a coarser scroll tightens its floor above the current value', () => {
        const setSelectedTime = jest.fn();
        render(<DurationTimeWheel selected_time={[1, 0, 0]} setSelectedTime={setSelectedTime} />);

        // Scrolling hours from 1 to 0 raises the seconds floor from 0 to the 15s intraday
        // minimum, stranding the current 0s selection outside the seconds column's own data.
        act(() => {
            latest_wheel_picker_props.setInputValues(0, 0);
        });

        expect(setSelectedTime).toHaveBeenCalledWith([0, 0, 15]);
    });

    it('[DTW-003] snaps a stored out-of-range combination back to the closest valid one 300ms after it stops moving', () => {
        jest.useFakeTimers();
        const setSelectedTime = jest.fn();

        // 0h 0m 0s is below the 15s intraday minimum from the shared beforeEach mock — a
        // combination that could be carried over from a previous contract's selection.
        render(<DurationTimeWheel selected_time={[0, 0, 0]} setSelectedTime={setSelectedTime} />);

        expect(setSelectedTime).not.toHaveBeenCalled();

        act(() => {
            jest.advanceTimersByTime(299);
        });
        expect(setSelectedTime).not.toHaveBeenCalled();

        act(() => {
            jest.advanceTimersByTime(1);
        });
        expect(setSelectedTime).toHaveBeenCalledWith([0, 0, 15]);

        jest.useRealTimers();
    });

    it('[DTW-003] does not snap back a combination that is already within range', () => {
        jest.useFakeTimers();
        const setSelectedTime = jest.fn();

        render(<DurationTimeWheel selected_time={[0, 1, 30]} setSelectedTime={setSelectedTime} />);

        act(() => {
            jest.advanceTimersByTime(300);
        });
        expect(setSelectedTime).not.toHaveBeenCalled();

        jest.useRealTimers();
    });
});
