import React from 'react';
import classNames from 'classnames';

import { Dropdown, useOnClickOutside } from '@deriv/components';
import {
    CurrencyAudIcon,
    CurrencyBtcIcon,
    CurrencyEthIcon,
    CurrencyEurIcon,
    CurrencyGbpIcon,
    CurrencyLtcIcon,
    CurrencyNoneIcon,
    CurrencyUsdcIcon,
    CurrencyUsdIcon,
    CurrencyUsdtIcon,
    LegacyCalendar1pxIcon,
    LegacyChevronRight1pxIcon,
} from '@deriv/quill-icons';
import { type Dayjs, dayjs, isPhoneLandscape, toMoment } from '@deriv/shared';
import { ActionSheet, Button, Chip, DatePicker, RadioButton, RadioGroup, Text } from '@deriv-com/quill-ui';
import { Localize, useTranslations } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';

type TDateChangeValues = {
    to?: Dayjs;
    from?: Dayjs;
    is_batch?: boolean;
};

type TAccountOption = {
    text: string;
    value: string;
    currency?: string;
};

type TArchivedStatementFilter = {
    /** Omitted where only the time filter is wanted — the account chip is skipped when empty. */
    accounts?: TAccountOption[];
    handleDateChange: (values: TDateChangeValues) => void;
    handleLoginidChange?: (loginid: string) => void;
    selectedLoginid?: string;
};

const currencyIconMap = {
    usd: CurrencyUsdIcon,
    eur: CurrencyEurIcon,
    gbp: CurrencyGbpIcon,
    aud: CurrencyAudIcon,
    btc: CurrencyBtcIcon,
    eth: CurrencyEthIcon,
    ltc: CurrencyLtcIcon,
    usdt: CurrencyUsdtIcon,
    tusdt: CurrencyUsdtIcon,
    eusdt: CurrencyUsdtIcon,
    usdc: CurrencyUsdcIcon,
} as Record<string, React.ComponentType<{ iconSize: string; className?: string }>>;

const RadioOption = ({ label, selected, value }: { label: string; selected: boolean; value: string }) => (
    <span className='archived-statement__radio-option'>
        <LegacyCalendar1pxIcon
            iconSize='xs'
            className='archived-statement__option-prefix-icon'
            fill='var(--color-text-primary)'
        />
        <span className='archived-statement__radio-button-wrapper'>
            <RadioButton
                defaultChecked={selected}
                value={value}
                name='archived-statement-time-filter'
                onChange={() => {}}
                radioButtonPosition='left'
                size='sm'
                tabIndex={-1}
            >
                {label}
            </RadioButton>
        </span>
        <span className='archived-statement__radio-label-fallback'>{label}</span>
    </span>
);

const computeDatesForFilter = (value: string): { from?: Dayjs; to?: Dayjs; is_batch: boolean } | null => {
    if (value === '0') return { to: toMoment().endOf('day'), is_batch: true };

    const date_map: Record<string, { from: Dayjs; to: Dayjs }> = {
        Today: { from: toMoment().startOf('day'), to: toMoment().endOf('day') },
        Yesterday: {
            from: toMoment().subtract(1, 'days').startOf('day'),
            to: toMoment().subtract(1, 'days').endOf('day'),
        },
    };

    const dates = date_map[value] || {
        from: toMoment().startOf('day').subtract(Number(value), 'day').add(1, 's'),
        to: toMoment().endOf('day'),
    };

    return { ...dates, is_batch: true };
};

const ArchivedStatementFilter = ({
    accounts = [],
    handleDateChange,
    handleLoginidChange,
    selectedLoginid,
}: TArchivedStatementFilter) => {
    const { localize } = useTranslations();
    const { isMobile } = useDevice();

    const [selected_time, setSelectedTime] = React.useState('0');
    const [show_calendar, setShowCalendar] = React.useState(false);
    const [custom_date_label, setCustomDateLabel] = React.useState<string>('');
    const [is_time_sheet_open, setIsTimeSheetOpen] = React.useState(false);
    const [is_account_sheet_open, setIsAccountSheetOpen] = React.useState(false);
    const [chosen_range, setChosenRange] = React.useState<(string | null | Date)[] | null | Date>([]);
    const calendar_popover_ref = React.useRef<HTMLDivElement>(null);

    // Close the desktop calendar popover when the user clicks anywhere outside.
    useOnClickOutside(
        calendar_popover_ref,
        () => setShowCalendar(false),
        event => {
            const target = event.target as HTMLElement;
            if (target.closest('.archived-statement__time-dropdown')) return false;
            if (target.closest('.dc-dropdown__list')) return false;
            return true;
        }
    );

    const DATE_FORMATTING_CONFIG: Record<string, string> = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    };

    const time_filter_options = [
        { value: '0', label: localize('All time') },
        { value: 'Today', label: localize('Today') },
        { value: 'Yesterday', label: localize('Yesterday') },
        { value: '7', label: localize('Last 7 days') },
        { value: '30', label: localize('Last 30 days') },
        { value: '60', label: localize('Last 60 days') },
        { value: '90', label: localize('Last 90 days') },
    ];

    const applyTimeFilter = (value: string) => {
        if (value === 'custom') {
            setChosenRange([]);
            setShowCalendar(true);
            return;
        }
        setSelectedTime(value);
        setCustomDateLabel('');
        const dates = computeDatesForFilter(value);
        if (dates) handleDateChange(dates);
    };

    const is_range_ready = Array.isArray(chosen_range) && !!chosen_range[0];

    const applyRange = () => {
        if (!Array.isArray(chosen_range) || !chosen_range[0]) return;
        const from = dayjs(chosen_range[0] as Date);
        const to = chosen_range[1] ? dayjs(chosen_range[1] as Date).endOf('day') : from.endOf('day');
        const label = from.isSame(to, 'day')
            ? from.format('DD MMM YYYY')
            : `${from.format('DD MMM YYYY')} - ${to.format('DD MMM YYYY')}`;
        setCustomDateLabel(label);
        setSelectedTime('custom');
        handleDateChange({ from, to, is_batch: true });
        setShowCalendar(false);
    };

    // Landscape keeps the desktop dropdown: a bottom sheet would cover a 390px-tall screen.
    if (isMobile) {
        const time_label =
            custom_date_label ||
            time_filter_options.find(opt => opt.value === selected_time)?.label ||
            localize('All time');
        const selected_account = accounts.find(a => a.value === selectedLoginid);
        const SelectedCurrencyIcon =
            currencyIconMap[(selected_account?.currency || '').toLowerCase()] || CurrencyNoneIcon;

        return (
            <React.Fragment>
                {accounts.length > 0 && (
                    <Chip.Standard
                        className='archived-statement__chip'
                        dropdown
                        isDropdownOpen={is_account_sheet_open}
                        onClick={() => setIsAccountSheetOpen(!is_account_sheet_open)}
                        size='md'
                    >
                        <span className='archived-statement__chip-content'>
                            <SelectedCurrencyIcon iconSize='xs' />
                            <Text size='sm'>{selected_account?.text || ''}</Text>
                        </span>
                    </Chip.Standard>
                )}
                <Chip.Standard
                    className='archived-statement__chip'
                    dropdown
                    isDropdownOpen={is_time_sheet_open}
                    onClick={() => setIsTimeSheetOpen(!is_time_sheet_open)}
                    selected={!!(custom_date_label || (selected_time && selected_time !== '0'))}
                    size='md'
                >
                    <span className='archived-statement__chip-content'>
                        <LegacyCalendar1pxIcon iconSize='xs' fill='var(--color-text-primary)' />
                        <Text size='sm'>{time_label}</Text>
                    </span>
                </Chip.Standard>

                <ActionSheet.Root
                    isOpen={is_time_sheet_open}
                    onClose={() => setIsTimeSheetOpen(false)}
                    position='left'
                    expandable={false}
                >
                    <ActionSheet.Portal shouldCloseOnDrag>
                        <ActionSheet.Header title={<Localize i18n_default_text='Filter by time' />} />
                        <ActionSheet.Content className='archived-statement__filter-sheet'>
                            <RadioGroup
                                className='archived-statement__filter-sheet-radio'
                                onToggle={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    applyTimeFilter(e.target.value);
                                    setIsTimeSheetOpen(false);
                                }}
                                selected={custom_date_label ? '' : selected_time}
                                size='sm'
                            >
                                {time_filter_options.map(({ value, label }) => (
                                    <RadioGroup.Item
                                        key={value}
                                        value={value}
                                        label={label}
                                        radioButtonPosition='right'
                                    />
                                ))}
                            </RadioGroup>
                            <button
                                type='button'
                                className='archived-statement__custom-sheet-button'
                                onClick={() => {
                                    setIsTimeSheetOpen(false);
                                    setChosenRange([]);
                                    setShowCalendar(true);
                                }}
                            >
                                <Text size='md'>{localize('Custom')}</Text>
                                {custom_date_label && (
                                    <Text size='sm' color='quill-typography__color--subtle'>
                                        {custom_date_label}
                                    </Text>
                                )}
                                <LegacyChevronRight1pxIcon iconSize='xs' fill='var(--color-text-primary)' />
                            </button>
                        </ActionSheet.Content>
                        <ActionSheet.Footer
                            alignment='vertical'
                            secondaryAction={{
                                content: <Localize i18n_default_text='Reset' />,
                                onAction: () => {
                                    setSelectedTime('0');
                                    setCustomDateLabel('');
                                    setChosenRange([]);
                                    handleDateChange({ to: toMoment().endOf('day'), is_batch: true });
                                    setIsTimeSheetOpen(false);
                                },
                            }}
                            shouldCloseOnSecondaryButtonClick={false}
                        />
                    </ActionSheet.Portal>
                </ActionSheet.Root>

                <ActionSheet.Root
                    isOpen={is_account_sheet_open}
                    onClose={() => setIsAccountSheetOpen(false)}
                    position='left'
                    expandable={false}
                >
                    <ActionSheet.Portal shouldCloseOnDrag>
                        <ActionSheet.Content>
                            <div className='archived-statement__account-list'>
                                {accounts.map(account => {
                                    const Icon =
                                        currencyIconMap[(account.currency || '').toLowerCase()] || CurrencyNoneIcon;
                                    const is_active = account.value === selectedLoginid;
                                    return (
                                        <button
                                            type='button'
                                            key={account.value}
                                            className={`archived-statement__account-card${is_active ? ' archived-statement__account-card--active' : ''}`}
                                            onClick={() => {
                                                handleLoginidChange?.(account.value);
                                                setIsAccountSheetOpen(false);
                                            }}
                                        >
                                            <Icon iconSize='md' />
                                            <span className='archived-statement__account-card-text'>
                                                <span className='archived-statement__account-card-loginid'>
                                                    {account.text}
                                                </span>
                                                <span className='archived-statement__account-card-currency'>
                                                    {account.currency || ''}
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </ActionSheet.Content>
                    </ActionSheet.Portal>
                </ActionSheet.Root>

                <ActionSheet.Root
                    isOpen={show_calendar}
                    onClose={() => setShowCalendar(false)}
                    position='left'
                    expandable={false}
                >
                    <ActionSheet.Portal shouldCloseOnDrag>
                        <ActionSheet.Header title={<Localize i18n_default_text='Choose a date range' />} />
                        <ActionSheet.Content>
                            <DatePicker
                                allowPartialRange
                                className='date-picker__action-sheet'
                                locale='en-GB'
                                selectRange
                                onChange={setChosenRange}
                                optionsConfig={DATE_FORMATTING_CONFIG}
                                tileDisabled={({ date }: { date: Date }) =>
                                    date.getTime() > toMoment().endOf('day').valueOf()
                                }
                                maxDate={new Date()}
                            />
                        </ActionSheet.Content>
                        <ActionSheet.Footer
                            alignment='vertical'
                            isSecondaryButtonDisabled={!is_range_ready}
                            secondaryAction={{
                                content: <Localize i18n_default_text='Apply' />,
                                onAction: applyRange,
                            }}
                            shouldCloseOnSecondaryButtonClick={false}
                        />
                    </ActionSheet.Portal>
                </ActionSheet.Root>
            </React.Fragment>
        );
    }

    // Desktop
    const time_filter_list = [
        ...time_filter_options.map(option => ({
            value: option.value,
            text: (
                <RadioOption label={option.label} selected={selected_time === option.value} value={option.value} />
            ) as unknown as string,
        })),
        {
            value: 'custom',
            text: (
                <span
                    className='archived-statement__custom-option'
                    role='button'
                    tabIndex={0}
                    onClick={e => {
                        if ((e.target as HTMLElement).closest('.dc-dropdown__list')) {
                            setShowCalendar(true);
                        }
                    }}
                    onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setShowCalendar(true);
                        }
                    }}
                >
                    <LegacyCalendar1pxIcon
                        iconSize='xs'
                        className='archived-statement__option-prefix-icon'
                        fill='var(--color-text-primary)'
                    />
                    <span className='archived-statement__custom-option-labels'>
                        <span>{localize('Custom')}</span>
                        {custom_date_label && (
                            <span className='archived-statement__custom-option-sublabel'>{custom_date_label}</span>
                        )}
                    </span>
                    <LegacyChevronRight1pxIcon iconSize='xs' fill='var(--color-text-primary)' />
                </span>
            ) as unknown as string,
        },
    ];

    // Figma `139-43653`: landscape lists plain rows, without Yesterday or Custom.
    const landscape_time_filter_list = time_filter_options
        .filter(option => option.value !== 'Yesterday')
        .map(option => ({ value: option.value, text: option.label }));

    const account_list_with_icons = accounts.map(account => {
        const Icon = currencyIconMap[(account.currency || '').toLowerCase()] || CurrencyNoneIcon;
        return {
            ...account,
            text: (
                <span className='archived-statement__dropdown-item'>
                    <Icon iconSize='xs' />
                    <span>{account.text}</span>
                </span>
            ) as unknown as string,
        };
    });

    return (
        <React.Fragment>
            {accounts.length > 0 && (
                <div className='archived-statement__dropdown-wrapper'>
                    <Dropdown
                        className='archived-statement__account-dropdown'
                        classNameDisplay='archived-statement__dropdown-display'
                        list={account_list_with_icons}
                        value={selectedLoginid}
                        onChange={(e: { target: { value: string } }) => handleLoginidChange?.(e.target.value)}
                    />
                </div>
            )}
            <div className='archived-statement__dropdown-wrapper'>
                <Dropdown
                    className={classNames('archived-statement__time-dropdown', {
                        'archived-statement__time-dropdown--selected':
                            custom_date_label || (selected_time && selected_time !== '0'),
                    })}
                    classNameDisplay='archived-statement__dropdown-display'
                    list={isPhoneLandscape() ? landscape_time_filter_list : time_filter_list}
                    value={selected_time}
                    onChange={(e: { target: { value: string } }) => applyTimeFilter(e.target.value)}
                />
                {show_calendar && (
                    <div className='archived-statement__calendar-popover' ref={calendar_popover_ref}>
                        <DatePicker
                            allowPartialRange
                            className='date-picker__action-sheet'
                            locale='en-GB'
                            selectRange
                            onChange={setChosenRange}
                            optionsConfig={DATE_FORMATTING_CONFIG}
                            tileDisabled={({ date }: { date: Date }) =>
                                date.getTime() > toMoment().endOf('day').valueOf()
                            }
                            maxDate={new Date()}
                        />
                        <Button
                            size='lg'
                            color='black-white'
                            variant='secondary'
                            fullWidth
                            label={<Localize i18n_default_text='Apply' />}
                            disabled={!is_range_ready}
                            onClick={applyRange}
                        />
                    </div>
                )}
            </div>
        </React.Fragment>
    );
};

export default ArchivedStatementFilter;
