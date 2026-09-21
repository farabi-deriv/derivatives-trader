import React from 'react';
import clsx from 'clsx';

import { observer } from '@deriv/stores';
import { WheelPickerContainer } from '@deriv-com/quill-ui';

import { useBlockSheetSwipe } from 'AppV2/Hooks/useBlockSheetSwipe';
import {
    clampTimeWheelSelection,
    getTicksWheelOptions,
    getTimeWheelColumnOptions,
    getTimeWheelColumnRange,
    getTimeWheelVisibleUnits,
    TIME_WHEEL_UNITS,
    WHEEL_PICKER_HEIGHT,
} from 'AppV2/Utils/trade-params-utils';
import { useTraderStore } from 'Stores/useTraderStores';

const WheelContainer = ({ is_single_unit, children }: { is_single_unit: boolean; children: React.ReactNode }) => {
    const block_sheet_swipe = useBlockSheetSwipe();

    return (
        <div
            className={clsx('duration-container__wheel-picker-container', {
                'duration-container__wheel-picker-container__single': is_single_unit,
            })}
            {...block_sheet_swipe}
        >
            {children}
        </div>
    );
};

export const DurationTicksWheel = observer(
    ({ selected_ticks, setSelectedTicks }: { selected_ticks: number; setSelectedTicks: (arg: number) => void }) => {
        const { duration_min_max, duration_units_list } = useTraderStore();
        const options = React.useMemo(() => getTicksWheelOptions(duration_min_max), [duration_min_max]);
        const is_single_unit = duration_units_list.length === 1;

        // Tapping an item only updates the draft (quill scrolls it into place and fires setInputValues);
        // committing happens solely through the header save action.
        return (
            <WheelContainer is_single_unit={is_single_unit}>
                <WheelPickerContainer
                    data={[options]}
                    containerHeight={WHEEL_PICKER_HEIGHT}
                    inputValues={[selected_ticks]}
                    setInputValues={(_, value) => setSelectedTicks(Number(value))}
                />
            </WheelContainer>
        );
    }
);

// How long after the last wheel movement an invalid combination snaps back into range
const SNAP_BACK_DELAY_MS = 300;

export const DurationTimeWheel = observer(
    ({ selected_time, setSelectedTime }: { selected_time: number[]; setSelectedTime: (arg: number[]) => void }) => {
        const { duration_min_max, duration_units_list } = useTraderStore();
        const intraday = duration_min_max?.intraday;
        const visible_units = React.useMemo(() => getTimeWheelVisibleUnits(duration_units_list), [duration_units_list]);
        const is_single_unit = duration_units_list.length === 1;

        const wheel_ref = React.useRef<HTMLDivElement>(null);

        // The quill wheel attaches its scroll listener once per data identity and keeps calling
        // the setInputValues callback captured back then. With static columns that callback would
        // read a stale selection (e.g. scrolling seconds would wipe a minutes change), so wheel
        // events always read and write the latest selection through this ref.
        const selected_time_ref = React.useRef(selected_time);
        React.useEffect(() => {
            selected_time_ref.current = selected_time;
        }, [selected_time]);
        const updateSelectedTime = (next: number[]) => {
            selected_time_ref.current = next;
            setSelectedTime(next);
        };

        // quill's wheel re-centers and rebinds its scroll listener whenever a column's data array
        // gets a new reference, so a column's array is cached and only rebuilt when its own
        // {min, max} changes (never on that column's own scroll, since it can't move its own bound)
        const column_data_cache = React.useRef(
            new Map<string, { min: number; max: number; options: ReturnType<typeof getTimeWheelColumnOptions> }>()
        );
        const data = React.useMemo(
            () =>
                intraday
                    ? visible_units.map(unit => {
                          const { min, max } = getTimeWheelColumnRange(unit, visible_units, intraday, selected_time);
                          const cached = column_data_cache.current.get(unit);
                          if (cached && cached.min === min && cached.max === max) return cached.options;

                          const options = getTimeWheelColumnOptions(unit, visible_units, intraday, selected_time);
                          column_data_cache.current.set(unit, { min, max, options });
                          return options;
                      })
                    : [],
            [visible_units, intraday, selected_time]
        );

        // The quill wheel does not re-center on its selected value, so drive its list to the
        // target item with the same smooth motion it uses when an item is tapped
        const scrollColumnToValue = React.useCallback(
            (column_index: number, value: number) => {
                const list = wheel_ref.current?.querySelectorAll('.quill-wheel-picker__data-items')[column_index];
                const item_index = data[column_index]?.findIndex(option => option.value === value);
                if (!list || item_index === undefined || item_index < 0) return;
                list.querySelectorAll('.quill-wheel-picker__data-item')[item_index]?.scrollIntoView({
                    block: 'center',
                    behavior: 'smooth',
                    inline: 'nearest',
                });
            },
            [data]
        );

        // Let the user scroll through invalid combinations (e.g. 13 sec on a 15s-minimum
        // contract), then scroll back to the closest valid one once the wheel settles
        React.useEffect(() => {
            if (!intraday) return;
            const timer = setTimeout(() => {
                const clamped = clampTimeWheelSelection(visible_units, intraday, selected_time);
                if (clamped.every((value, index) => value === selected_time[index])) return;

                updateSelectedTime(clamped);
                visible_units.forEach((unit, column_index) => {
                    const unit_index = TIME_WHEEL_UNITS.indexOf(unit);
                    if (clamped[unit_index] !== selected_time[unit_index]) {
                        scrollColumnToValue(column_index, clamped[unit_index]);
                    }
                });
            }, SNAP_BACK_DELAY_MS);
            return () => clearTimeout(timer);
        }, [visible_units, intraday, selected_time, setSelectedTime, scrollColumnToValue]);

        if (!intraday) return null;

        const onWheelChange = (column_index: number, value: string | number) => {
            const unit = visible_units[column_index];
            const prev = selected_time_ref.current;
            const next = [...prev];
            next[TIME_WHEEL_UNITS.indexOf(unit)] = Number(value);

            // A finer column sitting at its forced minimum follows that minimum when a coarser
            // change relaxes it (0 min 15 sec → scrolling minutes to 1 gives 1 min 0 sec).
            // A coarser change can also tighten a finer column's range past its current value
            // (1 hr 0 sec → scrolling hours to 0 raises the seconds floor to 15), which is
            // clamped immediately rather than left dangling until the snap-back timer fires.
            visible_units.slice(column_index + 1).forEach((finer_unit, offset) => {
                const finer_index = TIME_WHEEL_UNITS.indexOf(finer_unit);
                const old_min = getTimeWheelColumnRange(finer_unit, visible_units, intraday, prev).min;
                const { min: new_min, max: new_max } = getTimeWheelColumnRange(
                    finer_unit,
                    visible_units,
                    intraday,
                    next
                );
                if (prev[finer_index] === old_min && new_min < old_min) {
                    next[finer_index] = new_min;
                    scrollColumnToValue(column_index + 1 + offset, new_min);
                } else if (next[finer_index] < new_min || next[finer_index] > new_max) {
                    const clamped_value = Math.min(new_max, Math.max(new_min, next[finer_index]));
                    next[finer_index] = clamped_value;
                    scrollColumnToValue(column_index + 1 + offset, clamped_value);
                }
            });

            updateSelectedTime(next);
        };

        // Tapping an item only updates the draft: quill scrolls it into place and fires setInputValues
        // (onWheelChange), so finer units still follow. Committing happens solely through the header save.
        return (
            <WheelContainer is_single_unit={is_single_unit}>
                <div ref={wheel_ref}>
                    <WheelPickerContainer
                        data={data}
                        containerHeight={WHEEL_PICKER_HEIGHT}
                        inputValues={visible_units.map(unit => selected_time[TIME_WHEEL_UNITS.indexOf(unit)])}
                        setInputValues={onWheelChange}
                    />
                </div>
            </WheelContainer>
        );
    }
);
