import React from 'react';

import { InputField, useOnClickOutside } from '@deriv/components';
import { type ConfigType, type Dayjs, daysFromTodayTo, isPhoneLandscape, toMoment } from '@deriv/shared';
import { observer, useStore } from '@deriv/stores';
import { useTranslations } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';

import ArchivedStatementFilter from '../../archived-statement-filter';

import CalendarIcon from './calendar-icon';
import CompositeCalendarMobile from './composite-calendar-mobile';
import SideList from './side-list';

type TCompositeCalendar = {
    onChange: (values: { to?: Dayjs; from?: Dayjs; is_batch?: boolean }) => void;
    to: number;
    from: number;
};

const TwoMonthPickerLazy = React.lazy(() => import(/* webpackChunkName: "two-month-picker" */ './two-month-picker'));

const TwoMonthPickerLoadable = (props: {
    onChange: (date: Dayjs) => void;
    isPeriodDisabled: (date: Dayjs) => boolean;
    value: number;
}) => (
    <React.Suspense fallback={null}>
        <TwoMonthPickerLazy
            onChange={(date: ConfigType) => props.onChange(toMoment(date))}
            isPeriodDisabled={props.isPeriodDisabled}
            value={toMoment(props.value)}
        />
    </React.Suspense>
);

const CompositeCalendar = observer((props: TCompositeCalendar) => {
    const { localize } = useTranslations();
    const { ui } = useStore();
    const { current_focus, setCurrentFocus } = ui;
    const { onChange, to, from } = props;
    const { isMobile } = useDevice();
    const [show_to, setShowTo] = React.useState(false);
    const [show_from, setShowFrom] = React.useState(false);
    const [list] = React.useState([
        {
            value: 'all_time',
            label: localize('All time'),
            onClick: () => selectDateRange(),
            duration: 0,
        },
        {
            value: 'last_7_days',
            label: localize('Last 7 days'),
            onClick: () => selectDateRange(7),
            duration: 7,
        },
        {
            value: 'last_30_days',
            label: localize('Last 30 days'),
            onClick: () => selectDateRange(30),
            duration: 30,
        },
        {
            value: 'last_60_days',
            label: localize('Last 60 days'),
            onClick: () => selectDateRange(60),
            duration: 60,
        },
        {
            value: 'last_quarter',
            label: localize('Last quarter'),
            onClick: () => selectDateRange(90),
            duration: 90,
        },
    ]);

    const wrapper_ref = React.useRef<HTMLInputElement>(null);

    const validateClickOutside = (event: MouseEvent) => !wrapper_ref.current?.contains(event.target as Node);

    const selectDateRange = (new_from?: number) => {
        hideCalendar();
        onChange({
            from: new_from ? toMoment().startOf('day').subtract(new_from, 'day').add(1, 's') : undefined,
            to: toMoment().endOf('day'),
            is_batch: true,
        });
    };

    const getToDateLabel = () => {
        const date = toMoment(to);
        return daysFromTodayTo(date) === 0 ? localize('Today') : date.format('MMM, DD YYYY');
    };

    const getFromDateLabel = () => {
        const date = toMoment(from);
        return from ? date.format('MMM, DD YYYY') : '';
    };

    const hideCalendar = () => {
        setShowFrom(false);
        setShowTo(false);
    };

    const showCalendar = (e: string) => {
        if (e === 'from') {
            setShowFrom(true);
        }
        if (e === 'to') {
            setShowTo(true);
        }
    };

    useOnClickOutside(
        wrapper_ref,
        event => {
            event?.stopPropagation();
            event?.preventDefault();
            hideCalendar();
        },
        validateClickOutside
    );

    const setToDate = (date: Dayjs) => {
        onChange({ to: toMoment(date).endOf('day') });
    };

    const setFromDate = (date: Dayjs) => {
        onChange({ from: toMoment(date) });
        hideCalendar();
    };

    const isPeriodDisabledTo = (date: Dayjs) => {
        return date.unix() < from || date.unix() > toMoment().endOf('day').unix();
    };

    const isPeriodDisabledFrom = (date: Dayjs) => date.unix() > to;

    // Landscape reuses the archived statement's one-chip date filter.
    if (isPhoneLandscape()) {
        return <ArchivedStatementFilter handleDateChange={onChange} />;
    }

    if (!isMobile) {
        return (
            <React.Fragment>
                <div id='dt_composite_calendar_inputs' className='composite-calendar__input-fields'>
                    <InputField
                        id='dt_calendar_input_from'
                        current_focus={current_focus}
                        is_read_only
                        placeholder={localize('Date from')}
                        icon={CalendarIcon}
                        onClick={() => showCalendar('from')}
                        setCurrentFocus={setCurrentFocus}
                        value={getFromDateLabel()}
                    />
                    <InputField
                        id='dt_calendar_input_to'
                        current_focus={current_focus}
                        is_read_only
                        placeholder={localize('Date to')}
                        icon={CalendarIcon}
                        onClick={() => showCalendar('to')}
                        setCurrentFocus={setCurrentFocus}
                        value={getToDateLabel()}
                    />
                </div>
                {show_to && (
                    <div className='composite-calendar' ref={wrapper_ref}>
                        <SideList from={from} to={to} items={list} />
                        <TwoMonthPickerLoadable value={to} onChange={setToDate} isPeriodDisabled={isPeriodDisabledTo} />
                    </div>
                )}
                {show_from && (
                    <div className='composite-calendar' ref={wrapper_ref}>
                        <SideList from={from} to={to} items={list} />
                        <TwoMonthPickerLoadable
                            value={from}
                            onChange={setFromDate}
                            isPeriodDisabled={isPeriodDisabledFrom}
                        />
                    </div>
                )}
            </React.Fragment>
        );
    }

    return (
        <CompositeCalendarMobile
            duration_list={list}
            setCurrentFocus={setCurrentFocus}
            current_focus={current_focus}
            {...props}
        />
    );
});

CompositeCalendar.displayName = 'CompositeCalendar';

export default React.memo(CompositeCalendar);
