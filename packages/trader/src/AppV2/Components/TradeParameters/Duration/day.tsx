import React, { useEffect, useRef, useState } from 'react';

import { useInvalidateQuery } from '@deriv/api';
import { LabelPairedCalendarSmRegularIcon, LabelPairedClockThreeSmRegularIcon } from '@deriv/quill-icons';
import { hasIntradayDurationUnit, mapErrorMessage, routes, setTime, toMoment } from '@deriv/shared';
import { useStore } from '@deriv/stores';
import { ActionSheet, Text, TextField, useSnackbar } from '@deriv-com/quill-ui';
import { Localize, useTranslations } from '@deriv-com/translations';

import { useBlockSheetSwipe } from 'AppV2/Hooks/useBlockSheetSwipe';
import { useProposal } from 'AppV2/Hooks/useProposal';
import { ERROR_SNACKBAR_DURATION, getErrorSnackbarBottomOffset } from 'AppV2/Utils/layout-utils';
import { getDatePickerStartDate, getEarliestEndTime, toExpiryDateString } from 'AppV2/Utils/trade-params-utils';
import { ContractType } from 'Stores/Modules/Trading/Helpers/contract-type';
import { getBoundaries } from 'Stores/Modules/Trading/Helpers/end-time';
import { useTraderStore } from 'Stores/useTraderStores';

import DaysDatepicker from './datepicker';
import EndTimePicker from './timepicker';

const DayInput = ({
    selected_expiry_time,
    selected_expiry_date,
    setSelectedExpiryTime,
    setSelectedExpiryDate,
}: {
    selected_expiry_time: string;
    selected_expiry_date: string;
    setSelectedExpiryTime: (arg: string) => void;
    setSelectedExpiryDate: (arg: string) => void;
}) => {
    const [current_gmt_time, setCurrentGmtTime] = React.useState<string>('');
    const [open, setOpen] = React.useState(false);
    const [open_timepicker, setOpenTimePicker] = React.useState(false);
    const [trigger_date, setTriggerDate] = useState(false);
    const [is_disabled, setIsDisabled] = useState(false);
    // Local browsing state for date - this is the "unsaved" state while user browses date picker
    const [browsing_expiry_date, setBrowsingExpiryDate] = useState(new Date(selected_expiry_date));
    // Local browsing state for time - this is the "unsaved" state while user browses time picker
    const [browsing_expiry_time, setBrowsingExpiryTime] = useState<string>('');
    const [payout_per_point, setPayoutPerPoint] = useState<number | undefined>();
    const lastSelectedDateRef = useRef<string>('');
    const [barrier_value, setBarrierValue] = useState<string | undefined>();
    const { common, ui } = useStore();
    const [day, setDay] = useState<number | null>(null);
    const { server_time } = common;
    const { is_chart_maximized } = ui;
    const {
        amount,
        barrier_1,
        contract_type,
        duration_min_max,
        duration_unit,
        duration_units_list,
        duration,
        expiry_type,
        is_turbos,
        market_close_times,
        market_open_times,
        start_date,
        start_time,
        symbol,
        tick_data,
        trade_types,
    } = useTraderStore();
    const trade_store = useTraderStore();
    const { addSnackbar } = useSnackbar();
    const { localize } = useTranslations();
    const block_sheet_swipe = useBlockSheetSwipe();

    // Snapshot the committed end date/time when the sub-sheet opens so a dismiss can restore it.
    // `is_saving_ref` marks a save (keep the browsed value); `was_open_ref` gates the restore so it
    // never fires on the mount-time onClose that the ActionSheet.Root runs while the sheet is closed.
    const is_saving_ref = useRef(false);
    const was_open_ref = useRef(false);
    const snapshot_ref = useRef<{ date: string; time: string }>({ date: '', time: '' });
    const takeSnapshot = () => {
        snapshot_ref.current = { date: selected_expiry_date, time: browsing_expiry_time };
        is_saving_ref.current = false;
        was_open_ref.current = true;
    };
    const is_dirty =
        selected_expiry_date !== snapshot_ref.current.date || browsing_expiry_time !== snapshot_ref.current.time;

    // Calculate date_expiry epoch when expiry_type is endtime
    const getDateExpiryEpoch = () => {
        const date_string = `${selected_expiry_date}T${selected_expiry_time}Z`; // Z for GMT/UTC
        return Math.floor(new Date(date_string).getTime() / 1000);
    };

    const new_values = {
        ...(expiry_type !== 'endtime' && {
            duration_unit,
            duration: day || duration,
        }),
        ...(expiry_type === 'endtime' && {
            date_expiry: getDateExpiryEpoch(),
        }),
        expiry_type,
        contract_type,
        basis: 'stake',
        amount,
        symbol,
        ...(payout_per_point && { payout_per_point }),
        ...(barrier_value && { barrier: barrier_value }),
        ...(barrier_1 && !is_turbos && !barrier_value ? { barrier_1: Math.round(tick_data?.quote as number) } : {}),
    };

    const { data: response, error: queryError } = useProposal({
        trade_store,
        proposal_request_values: new_values,
        contract_type: Object.keys(trade_types)[0],
        is_enabled: trigger_date,
    });

    const invalidate = useInvalidateQuery();

    useEffect(() => {
        if (queryError) {
            if (queryError?.code === 'ContractBuyValidationError') {
                const details = queryError.details;

                if (details?.field === 'payout_per_point' && Array.isArray(details?.payout_per_point_choices)) {
                    const suggested_payout = details.payout_per_point_choices[0];
                    setPayoutPerPoint(suggested_payout as number);
                    setTriggerDate(true);
                    return;
                }

                if (details?.field === 'barrier' && Array.isArray(details?.barrier_choices)) {
                    const suggested_barrier = details.barrier_choices[0];
                    setBarrierValue(suggested_barrier as string);
                    setTriggerDate(true);
                    return;
                }
            }

            if (queryError?.message && queryError?.details?.field === 'duration') {
                const mappedMessage = mapErrorMessage(queryError);
                addSnackbar({
                    message: <Localize i18n_default_text={mappedMessage} />,
                    status: 'fail',
                    hasCloseButton: true,
                    delay: ERROR_SNACKBAR_DURATION,
                    style: {
                        marginBottom: getErrorSnackbarBottomOffset({
                            pathname: routes.index,
                            is_chart_maximized,
                        }),
                    },
                });
                setIsDisabled(true);
            }
        }

        if (response) {
            setIsDisabled(false);
            invalidate('proposal');
            setTriggerDate(false);
        }
    }, [response, setSelectedExpiryDate, invalidate]);

    // Always calculate adjusted_start_time based on TODAY, not the selected expiry_date.
    // The contract's intraday minimum raises the floor above the legacy +5-minute boundary start.
    const today_moment = toMoment(server_time);
    const market_open_datetimes = market_open_times.map(open_time => setTime(today_moment.clone(), open_time));
    const market_close_datetimes = market_close_times.map(close_time => setTime(today_moment.clone(), close_time));
    const boundaries = getBoundaries(today_moment.clone(), market_open_datetimes, market_close_datetimes);
    const adjusted_start_time = getEarliestEndTime(today_moment, duration_min_max, boundaries.start[0]);

    const formatted_date = new Date(selected_expiry_date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'GMT',
    });
    const today_local = new Date();
    const today_date_string = toExpiryDateString(today_local);
    const is_selected_date_today = selected_expiry_date === today_date_string;

    React.useEffect(() => {
        const updateCurrentGmtTime = () => {
            const now = new Date();
            const gmt_time = now.toLocaleTimeString('en-GB', { timeZone: 'GMT', hour12: false });
            setCurrentGmtTime(gmt_time);
        };
        updateCurrentGmtTime();
        const interval = setInterval(updateCurrentGmtTime, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        // Set time based on whether date is today or future
        const is_today = is_selected_date_today;
        // For future dates, use stored expiry_time if available (e.g. market close time)
        const time_to_set = is_today ? adjusted_start_time : selected_expiry_time || '23:59:59';

        setBrowsingExpiryTime(time_to_set);
        setSelectedExpiryTime(time_to_set);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected_expiry_date]);

    // Mirrors desktop: a same-day selection the advancing clock has dropped below the floor is
    // bumped back onto it, so the held time never leaves the offered range.
    useEffect(() => {
        if (!is_selected_date_today || !browsing_expiry_time) return;
        if (browsing_expiry_time.substring(0, 5) >= adjusted_start_time) return;
        setBrowsingExpiryTime(adjusted_start_time);
        setSelectedExpiryTime(adjusted_start_time);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adjusted_start_time, is_selected_date_today, browsing_expiry_time]);

    let is_24_hours_contract = false;

    const has_intraday_duration_unit = hasIntradayDurationUnit(duration_units_list);
    const parsedFormattedDate = new Date(Date.parse(`${formatted_date} 00:00:00`));

    const isSameDate =
        parsedFormattedDate.getFullYear() === server_time.year() &&
        parsedFormattedDate.getMonth() === server_time.month() &&
        parsedFormattedDate.getDate() === server_time.date();

    is_24_hours_contract = (!!start_date || isSameDate) && has_intraday_duration_unit;

    const handleDate = async (date: Date) => {
        const difference_in_time = date.getTime() - new Date().getTime();
        const difference_in_days = Math.ceil(difference_in_time / (1000 * 3600 * 24));
        const duration_days = difference_in_days <= 0 ? 1 : difference_in_days;
        setDay(Number(duration_days));

        // Keep browsing_expiry_date and selected_expiry_date in sync
        setBrowsingExpiryDate(date);
        const selected_date_string = toExpiryDateString(date);
        lastSelectedDateRef.current = selected_date_string;
        setSelectedExpiryDate(selected_date_string);

        // Set browsing time based on whether it's today or future
        if (difference_in_days <= 0) {
            // Today: set to adjusted_start_time
            setBrowsingExpiryTime(adjusted_start_time);
            setSelectedExpiryTime(adjusted_start_time);
        } else {
            // Fetch trading times for the selected date to get actual market close time
            const trading_times = await ContractType.getTradingTimes(selected_date_string, symbol);

            if (lastSelectedDateRef.current !== selected_date_string) return;

            if (
                trading_times &&
                'close' in trading_times &&
                Array.isArray(trading_times.close) &&
                trading_times.close.length &&
                trading_times.close[0] !== '--'
            ) {
                const market_close_time = trading_times.close.slice(-1)[0];
                setBrowsingExpiryTime(market_close_time);
                setSelectedExpiryTime(market_close_time);
            } else {
                const futureTime = selected_expiry_time || '23:59:59';
                setBrowsingExpiryTime(futureTime);
                setSelectedExpiryTime(futureTime);
            }
        }
    };

    return (
        <div className='duration-container__days-input'>
            <TextField
                variant='fill'
                readOnly
                name='date'
                data-testid='dt_date_input'
                textAlignment='left'
                value={formatted_date}
                disabled={duration_units_list.filter(item => item.value === 'd').length === 0}
                onClick={() => {
                    takeSnapshot();
                    setOpen(true);
                }}
                leftIcon={<LabelPairedCalendarSmRegularIcon width={24} height={24} fill='var(--color-text-primary)' />}
            />

            <TextField
                variant='fill'
                readOnly
                textAlignment='left'
                name='time'
                value={`${browsing_expiry_time || '23:59:59'} GMT`}
                disabled={!is_24_hours_contract}
                onClick={() => {
                    takeSnapshot();
                    setOpenTimePicker(true);
                }}
                leftIcon={
                    <LabelPairedClockThreeSmRegularIcon width={24} height={24} fill='var(--color-text-primary)' />
                }
            />

            <div className='duration-container__days-input__expiry'>
                <Text size='sm' color='quill-typography__color--subtle'>
                    <Localize i18n_default_text='Expiry' />
                </Text>
                <Text size='sm'>{`
                ${formatted_date}, ${browsing_expiry_time || '23:59:59'} GMT`}</Text>
            </div>
            <ActionSheet.Root
                isOpen={open || open_timepicker}
                onClose={() => {
                    setOpen(false);
                    setOpenTimePicker(false);
                    setIsDisabled(false);
                    if (was_open_ref.current) {
                        // Dismiss (X / overlay / drag) discards the browsed value and restores the
                        // snapshot; save leaves is_saving_ref set so the browsed value is kept.
                        if (!is_saving_ref.current) {
                            setBrowsingExpiryTime(snapshot_ref.current.time);
                            setSelectedExpiryDate(snapshot_ref.current.date);
                            setSelectedExpiryTime(snapshot_ref.current.time);
                        }
                        was_open_ref.current = false;
                    }
                }}
                position='left'
                expandable={false}
            >
                <ActionSheet.Portal
                    {...block_sheet_swipe}
                    showHandlebar={false}
                    shouldDetectSwipingOnContainer
                    shouldCloseOnDrag
                >
                    <ActionSheet.Header
                        title={
                            open ? (
                                <Localize i18n_default_text='Pick an end date' />
                            ) : (
                                <Localize i18n_default_text='Pick an end time' />
                            )
                        }
                        closeAction={{ ariaLabel: localize('Close') }}
                        saveAction={{
                            onAction: () => {
                                if (is_disabled) return;
                                is_saving_ref.current = true;
                                setOpen(false);
                                setOpenTimePicker(false);
                                setSelectedExpiryTime(browsing_expiry_time);
                            },
                            ariaLabel: localize('Save'),
                        }}
                        isSaveActionDisabled={is_disabled || !is_dirty}
                        shouldCloseOnSaveActionClick={false}
                    />
                    {open && (
                        <DaysDatepicker
                            start_date={getDatePickerStartDate(
                                duration_units_list,
                                server_time,
                                start_time,
                                duration_min_max
                            )}
                            end_date={browsing_expiry_date}
                            setEndDate={handleDate}
                        />
                    )}
                    {open_timepicker && (
                        <EndTimePicker
                            setEndTime={setBrowsingExpiryTime}
                            end_time={browsing_expiry_time}
                            current_gmt_time={current_gmt_time}
                            adjusted_start_time={adjusted_start_time}
                        />
                    )}
                </ActionSheet.Portal>
            </ActionSheet.Root>
        </div>
    );
};

export default DayInput;
