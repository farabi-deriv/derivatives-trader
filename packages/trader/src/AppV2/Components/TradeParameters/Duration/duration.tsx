import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';

import { getUnitMap, isMobile, mapErrorMessage, routes, trackAnalyticsEvent } from '@deriv/shared';
import { useStore } from '@deriv/stores';
import { ActionSheet, TextField } from '@deriv-com/quill-ui';
import { Localize, useTranslations } from '@deriv-com/translations';

import useErrorSnackbar from 'AppV2/Hooks/useErrorSnackbar';
import { getErrorSnackbarBottomOffset } from 'AppV2/Utils/layout-utils';
import {
    clampTimeWheelSelection,
    DURATION_TAB,
    DURATION_UNIT,
    getDatePickerStartDate,
    getDurationFromTimeWheelSelection,
    getDurationTab,
    getTickWheelRange,
    getTimeWheelSelectionFromDuration,
    getTimeWheelVisibleUnits,
    isValidPersistedDuration,
    toExpiryDateString,
} from 'AppV2/Utils/trade-params-utils';
import { getDisplayedContractTypes } from 'AppV2/Utils/trade-types-utils';
import { useTraderStore } from 'Stores/useTraderStores';

import { AutomationLockOverlay } from '../Shared';
import { TTradeParametersProps } from '../trade-parameters';

import DurationActionSheetContainer from './container';
import DurationDesktop from './duration-desktop';

const Duration = observer(({ is_minimized }: TTradeParametersProps) => {
    const is_mobile = isMobile();
    const {
        applyDefaultDuration,
        contract_type,
        duration_min_max,
        duration_unit,
        duration_units_list,
        duration,
        endtime_minimum_error,
        expiry_date,
        expiry_epoch,
        expiry_time,
        expiry_type,
        is_automation_params_locked,
        is_market_closed,
        onChangeMultiple,
        proposal_info,
        saved_expiry_date_v2: saved_expiry_date,
        setSavedExpiryDateV2: setSavedExpiryDate,
        setUnsavedExpiryDateV2: setSelectedExpiryDate,
        start_time,
        symbol,
        trade_type_tab,
        trade_types,
        unsaved_expiry_date_v2: selected_expiry_date,
        validation_errors,
    } = useTraderStore();
    const announceError = useErrorSnackbar();
    const { name_plural, name, name_singular } = getUnitMap()[duration_unit] ?? {};
    const duration_unit_text = (duration === 1 ? name_singular : name_plural) ?? name;
    const [is_open, setOpen] = useState(false);
    const [saved_expiry_time, setSavedExpiryTime] = useState<string>('');
    const [selected_expiry_time, setSelectedExpiryTime] = useState<string>('');
    const [tab, setTab] = useState<string>(getDurationTab(duration_unit, expiry_type === 'endtime'));
    const [selected_ticks, setSelectedTicks] = useState<number>(duration_unit === DURATION_UNIT.TICKS ? duration : 1);
    const [selected_time, setSelectedTime] = useState<number[]>(
        getTimeWheelSelectionFromDuration(duration, duration_unit)
    );
    const contract_type_object = getDisplayedContractTypes(trade_types, contract_type, trade_type_tab);
    const has_error =
        (proposal_info[contract_type_object[0]]?.has_error &&
            proposal_info[contract_type_object[0]]?.error_field === 'duration') ||
        (validation_errors.duration?.length ?? 0) > 0 ||
        !!endtime_minimum_error;
    const isInitialMount = useRef(true);
    const prevExpiryEpoch = useRef<string | number | null>(null);
    const { common, ui } = useStore();
    const { server_time } = common;
    const { is_chart_maximized } = ui;
    const { localize } = useTranslations();

    // Initialize saved date/time from expiry_epoch or set defaults
    useEffect(() => {
        if (!expiry_epoch) return;

        // Only sync from expiry_epoch if it actually changed (not from our own update)
        if (prevExpiryEpoch.current === expiry_epoch) return;

        prevExpiryEpoch.current = expiry_epoch;

        const epoch_date = new Date((expiry_epoch as number) * 1000);
        const date_string = epoch_date.toISOString().split('T')[0];
        const time_string = epoch_date.toISOString().split('T')[1].substring(0, 8);

        // `expiry_epoch` is never cleared, so across a tab switch it still holds the previous tab's
        // proposal. The store's own expiry_date wins whenever it has one.
        if (expiry_date && expiry_date !== date_string) return;

        // Only update if the date actually changed
        if (saved_expiry_date !== date_string) {
            setSavedExpiryDate(date_string);
            setSavedExpiryTime(time_string || '23:59:59');
        }
    }, [expiry_epoch]);

    // Reads the daily expiry seeded by TradeStore; never writes it.
    // The store commits `expiry_date` first and the close time a `trading_times` round trip later, so
    // the second branch replaces the provisional '23:59:59' once the real one lands — markets closing
    // earlier (forex on a Friday, ~20:55 GMT) would otherwise keep the fallback for the whole mount.
    // A user edit is safe: `handleSave` writes draft and store together, so they agree and it no-ops.
    useEffect(() => {
        if (duration_unit !== 'd' || !expiry_date) return;
        if (saved_expiry_date !== expiry_date) {
            setSavedExpiryDate(expiry_date);
            setSavedExpiryTime(expiry_time || '23:59:59');
        } else if (expiry_time && saved_expiry_time !== expiry_time) {
            setSavedExpiryTime(expiry_time);
        }
    }, [duration_unit, saved_expiry_date, saved_expiry_time, expiry_date, expiry_time]);

    useEffect(() => {
        if (isInitialMount.current) {
            const timer = setTimeout(() => {
                isInitialMount.current = false;
            }, 500);
            return () => clearTimeout(timer);
        }

        // Safety net: reset to the configured default when the persisted duration is invalid for the
        // current constraints. Trade-type switches themselves are handled in the store (onChange), so
        // this survives even if the component remounts on a switch. An End Time tab is exempt,
        // exactly as in the store's own checks (`applyRestoredTabParams`, `should_apply_default`):
        // its duration/duration_unit are dormant leftovers (the proposal prices via date_expiry),
        // and `applyDefaultDuration` force-writes `expiry_type: 'duration'` — firing here wiped a
        // just-restored End Time selection ~10ms after the store had deliberately kept it.
        const isPersistedDurationValid =
            expiry_type === 'endtime' ||
            isValidPersistedDuration(duration, duration_unit, duration_min_max, duration_units_list);

        if (!isPersistedDurationValid) {
            const start_duration = setTimeout(() => applyDefaultDuration(), 10);
            return () => clearTimeout(start_duration);
        }
    }, [symbol, contract_type, duration_min_max, duration_units_list, duration, duration_unit, expiry_type]);

    // The sheet can close inside the wheel's snap-back window, so clamp the time selection here too
    const clamped_time = duration_min_max?.intraday
        ? clampTimeWheelSelection(
              getTimeWheelVisibleUnits(duration_units_list),
              duration_min_max.intraday,
              selected_time
          )
        : selected_time;
    const next_wheel_change =
        tab === DURATION_TAB.TICKS
            ? { duration: selected_ticks, duration_unit: DURATION_UNIT.TICKS }
            : getDurationFromTimeWheelSelection(clamped_time, duration_units_list);

    // Header save is disabled while the active tab's selection still equals its committed value
    // (and, for the wheel tabs, while the converted duration is not positive). Compares normalized
    // selections, not raw unit/value: the wheel commits hours as minutes, so a stored 2h counts as
    // unchanged against a 120min selection.
    const is_save_disabled =
        tab === DURATION_TAB.END_TIME
            ? expiry_type === 'endtime' &&
              selected_expiry_date === saved_expiry_date &&
              selected_expiry_time === saved_expiry_time
            : next_wheel_change.duration <= 0 ||
              (expiry_type === 'duration' &&
                  (tab === DURATION_TAB.TICKS
                      ? duration_unit === DURATION_UNIT.TICKS && duration === next_wheel_change.duration
                      : getTimeWheelSelectionFromDuration(duration, duration_unit).every(
                            (value, index) => value === clamped_time[index]
                        )));

    // Dismissing the sheet (X, overlay, drag) never commits — the `is_open` effect below re-initializes
    // the drafts from committed values on every open, so dismiss = discard.
    const onClose = React.useCallback(() => setOpen(false), []);

    // The single header check commits the active tab: Ticks/Time apply the wheel selection as a
    // `duration` change, End time applies the selected date/time as an `endtime` change.
    const handleSave = React.useCallback(() => {
        if (tab === DURATION_TAB.END_TIME) {
            setSavedExpiryDate(selected_expiry_date);
            setSavedExpiryTime(selected_expiry_time);

            onChangeMultiple({
                expiry_date: `${selected_expiry_date}T${selected_expiry_time}Z`,
                expiry_time: selected_expiry_time,
                expiry_type: 'endtime',
            });

            trackAnalyticsEvent('ce_trade_types_form_v2', {
                action: 'customizing_trades',
                input_method: 'custom',
                parameter_type: 'duration',
            });
            return;
        }

        if (next_wheel_change.duration > 0) {
            setSavedExpiryDate(selected_expiry_date);
            setSavedExpiryTime(selected_expiry_time);
            setSelectedExpiryTime('');

            onChangeMultiple({ ...next_wheel_change, expiry_type: 'duration' });

            trackAnalyticsEvent('ce_trade_types_form_v2', {
                action: 'customizing_trades',
                input_method: 'custom',
                parameter_type: 'duration',
            });
        }
    }, [tab, next_wheel_change, selected_expiry_date, selected_expiry_time, onChangeMultiple, setSavedExpiryDate]);

    const getInputValues = () => {
        const formatted_date = saved_expiry_date
            ? new Date(saved_expiry_date).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
              })
            : '';

        // Check if selected date is today
        const formatted_current_date = new Date().toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
        const is_today = formatted_date === formatted_current_date;

        if (expiry_type == 'duration') {
            const is_time_unit = [DURATION_UNIT.SECONDS, DURATION_UNIT.MINUTES, DURATION_UNIT.HOURS].includes(
                duration_unit
            );
            if (is_time_unit) {
                const [hours, minutes, seconds] = getTimeWheelSelectionFromDuration(duration, duration_unit);
                // With an hour component the value reads as a clock (01:01:01); below an hour it
                // stays verbose (1 minute 1 second); single-unit values fall through ('30 sec')
                if (hours > 0) {
                    const pad = (value: number) => String(value).padStart(2, '0');
                    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
                }
                if (duration > 59) {
                    return [
                        minutes ? `${minutes} ${minutes > 1 ? localize('minutes') : localize('minute')}` : '',
                        seconds ? `${seconds} ${seconds > 1 ? localize('seconds') : localize('second')}` : '',
                    ]
                        .filter(Boolean)
                        .join(' ');
                }
            }
            if (duration_unit === 'd') {
                if (!formatted_date) {
                    return '';
                }
                // For today: show HH:mm, for future: show HH:mm:ss
                const time_display = is_today
                    ? saved_expiry_time.substring(0, 5) // HH:mm
                    : saved_expiry_time; // HH:mm:ss
                return `${formatted_date}, ${time_display} GMT`;
            }
            return `${duration} ${duration_unit_text}`;
        }
        if (expiry_time) {
            // For today: show HH:mm, for future: show HH:mm:ss
            const time_display = is_today
                ? expiry_time.substring(0, 5) // HH:mm
                : `${expiry_time}`; // HH:mm:ss
            return `${formatted_date}, ${time_display} GMT`;
        }
    };

    // Fires on every viewport. This was previously gated on `!is_minimized`, i.e. it only showed
    // while the mobile params sheet was expanded — a state that no longer exists, so the gate would
    // now make the toast unreachable on mobile. The collapsed chip only turns red and truncates, so
    // without this a blocked trade gives no reason. No sibling param gates its snackbar this way.
    useEffect(() => {
        const error_obj = proposal_info[contract_type_object[0]] || validation_errors?.duration?.[0];
        // The store-derived message is a plain string, so it needs its own branch: reading
        // `error_field` off it yields undefined and the toast never played.
        const message = error_obj?.error_field === 'duration' ? mapErrorMessage(error_obj) : endtime_minimum_error;
        if (!message) return;

        // Deduped app-wide: `PurchaseButton` reports this same sentence off the same
        // proposal response, and quill plays two enqueues as two toasts (issue #1319).
        announceError({
            message,
            style: {
                marginBottom: getErrorSnackbarBottomOffset({
                    pathname: routes.index,
                    is_chart_maximized,
                }),
                width: 'calc(100% - var(--core-spacing-800)',
            },
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [has_error, contract_type_object[0], endtime_minimum_error]);

    useEffect(() => {
        if (is_open) {
            // Initialize selected values from saved values when opening.
            setSelectedExpiryDate(
                saved_expiry_date ||
                    toExpiryDateString(
                        getDatePickerStartDate(duration_units_list, server_time, start_time, duration_min_max)
                    )
            );
            setSelectedExpiryTime(saved_expiry_time);

            setTab(getDurationTab(duration_unit, !!expiry_time));

            // Clamp into the current contract's range up-front: the wheels reset out-of-range
            // values to their first option, which would lose the stored selection
            const { min: tick_min, max: tick_max } = getTickWheelRange(duration_min_max);
            setSelectedTicks(
                duration_unit === DURATION_UNIT.TICKS ? Math.min(tick_max, Math.max(tick_min, duration)) : tick_min
            );
            const time_selection = getTimeWheelSelectionFromDuration(duration, duration_unit);
            setSelectedTime(
                duration_min_max?.intraday
                    ? clampTimeWheelSelection(
                          getTimeWheelVisibleUnits(duration_units_list),
                          duration_min_max.intraday,
                          time_selection
                      )
                    : time_selection
            );
        }
    }, [is_open, saved_expiry_date, saved_expiry_time]);

    // Render desktop version for desktop devices
    if (!is_mobile) {
        return <DurationDesktop is_minimized={is_minimized} />;
    }

    // Render mobile version (ActionSheet) for mobile devices
    return (
        <>
            <div className='trade-params__field-locked'>
                <TextField
                    variant='fill'
                    readOnly
                    label={
                        <Localize i18n_default_text='Duration' key={`duration${is_minimized ? '-minimized' : ''}`} />
                    }
                    value={getInputValues()}
                    noStatusIcon
                    disabled={is_market_closed || is_automation_params_locked}
                    className={clsx('trade-params__option', is_minimized && 'trade-params__option--minimized')}
                    onClick={() => setOpen(true)}
                    status={has_error ? 'error' : 'neutral'}
                />
                {is_automation_params_locked && <AutomationLockOverlay />}
            </div>
            <ActionSheet.Root
                isOpen={is_open}
                onClose={onClose}
                position='left'
                expandable={false}
                shouldBlurOnClose={is_open}
            >
                <ActionSheet.Portal showHandlebar={false} shouldDetectSwipingOnContainer shouldCloseOnDrag>
                    <DurationActionSheetContainer
                        tab={tab}
                        setTab={setTab}
                        selected_ticks={selected_ticks}
                        setSelectedTicks={setSelectedTicks}
                        selected_time={selected_time}
                        setSelectedTime={setSelectedTime}
                        onSave={handleSave}
                        is_save_disabled={is_save_disabled}
                        selected_expiry_time={selected_expiry_time}
                        selected_expiry_date={selected_expiry_date}
                        setSelectedExpiryTime={setSelectedExpiryTime}
                        setSelectedExpiryDate={setSelectedExpiryDate}
                    />
                </ActionSheet.Portal>
            </ActionSheet.Root>
        </>
    );
});

export default Duration;
