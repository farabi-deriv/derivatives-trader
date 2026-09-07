import { dayjs } from '@deriv/shared';
import { mockStore } from '@deriv/stores';
import { TCoreStores } from '@deriv/stores/types';
import { useSnackbar } from '@deriv-com/quill-ui';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TraderProviders from '../../../../../trader-providers';
import DurationDesktop from '../duration-desktop';
import Duration from '../index';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
}));

global.ResizeObserver = ResizeObserver;

jest.mock('@deriv-com/quill-ui', () => ({
    ...jest.requireActual('@deriv-com/quill-ui'),
    useSnackbar: jest.fn(),
}));

jest.mock('AppV2/Hooks/useActiveSymbols', () => ({
    __esModule: true,
    default: jest.fn(() => ({
        activeSymbols: [
            { symbol: 'EURUSD', display_name: 'EUR/USD', exchange_is_open: 1 },
            { symbol: 'GBPUSD', display_name: 'GBP/USD', exchange_is_open: 0 },
            { symbol: 'CADAUD', display_name: 'CAD/AUD', exchange_is_open: 0 },
        ],
    })),
}));

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    toMoment: jest.fn(() => ({
        clone: jest.fn(),
        isSame: jest.fn(() => true),
    })),
    isMobile: jest.fn(() => false), // Default to desktop mode
}));

jest.mock('../day', () => ({
    __esModule: true,
    default: jest.fn(() => <div>Mocked DayInput</div>),
}));

// The shared translations mock is identity-like, so it cannot express one key in two languages.
// `createLanguageAwareTranslationsMock` layers language awareness over it; see that helper for why
// each part of it matters to this fix. Required lazily because `jest.mock` is hoisted above imports.
jest.mock('@deriv-com/translations', () =>
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('../../../../../../../../__mocks__/language-aware-translations.mock').createLanguageAwareTranslationsMock()
);

const { fireLanguageChanged } = jest.requireActual('@deriv-com/translations') as {
    fireLanguageChanged: (lang?: string) => void;
};

describe('Duration', () => {
    let default_trade_store: TCoreStores, mockOnChangeMultiple: jest.Mock;

    beforeEach(() => {
        mockOnChangeMultiple = jest.fn();
        default_trade_store = mockStore({
            modules: {
                trade: {
                    onChange: jest.fn(),
                    validation_errors: { duration: [] },
                    duration: 30,
                    duration_unit: 'm',
                    expiry_type: 'duration',
                    expiry_time: '',
                    proposal_info: {},
                    onChangeMultiple: mockOnChangeMultiple,
                    duration_min_max: {
                        tick: { min: 1, max: 10 },
                        intraday: { min: 60, max: 3600 },
                        daily: { min: 86400, max: 172800 },
                    },
                    start_time: null,
                    symbol: 'EURUSD',
                    saved_expiry_date_v2: '',
                    setSavedExpiryDateV2: jest.fn(),
                    setUnsavedExpiryDateV2: jest.fn(),
                    unsaved_expiry_date_v2: '',
                },
            },
            common: {
                server_time: dayjs('2024-10-10T11:23:10.895Z'),
            },
        });
    });

    const mockAddSnackbar = jest.fn();

    beforeAll(() => {
        (useSnackbar as jest.Mock).mockReturnValue({ addSnackbar: mockAddSnackbar });
    });
    const mockDuration = () => {
        render(
            <TraderProviders store={default_trade_store}>
                <Duration />
            </TraderProviders>
        );
    };

    it('should render the Duration component with default values', () => {
        mockDuration();
        expect(screen.getByLabelText('Duration')).toBeInTheDocument();
        expect(screen.getByDisplayValue('30 min')).toBeInTheDocument();
    });

    it('should render the correct value for duration in hours and minutes', () => {
        default_trade_store.modules.trade.duration = 125;
        mockDuration();
        expect(screen.getByLabelText('Duration')).toBeInTheDocument();
        expect(screen.getByDisplayValue('2 hours 5 minutes')).toBeInTheDocument();
    });

    it('should open the popover when the text field is clicked (desktop)', async () => {
        default_trade_store.modules.trade.expiry_time = '12:30';
        mockDuration();
        const textField = screen.getByLabelText('Duration');
        expect(textField).toBeInTheDocument();
        await userEvent.click(textField);

        // Desktop uses popover, not ActionSheet dialog
        expect(screen.getByText('Ticks')).toBeInTheDocument();
        expect(screen.getByText('Seconds')).toBeInTheDocument();
        expect(screen.getByText('Minutes')).toBeInTheDocument();
        expect(screen.getByText('Hours')).toBeInTheDocument();
    });

    it('should not crash when validation_errors does not contain duration key', () => {
        default_trade_store.modules.trade.validation_errors = {};
        expect(() => mockDuration()).not.toThrow();
        expect(screen.getByLabelText('Duration')).toBeInTheDocument();
    });

    it('should display a validation error message if there is a duration error', () => {
        default_trade_store.modules.trade.validation_errors.duration = [
            { message: 'Invalid duration', error_field: 'duration' },
        ];
        mockDuration();
        expect(mockAddSnackbar).toHaveBeenCalled();
    });

    it('should display the market closed message when the market is closed', () => {
        default_trade_store.modules.trade.is_market_closed = true;
        mockDuration();
        expect(screen.getByText(/duration/i)).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('should calculate the correct duration based on the smallest unit from the store', () => {
        mockDuration();
        const smallest_duration = screen.getByDisplayValue('30 min');
        expect(smallest_duration).toBeInTheDocument();
    });

    it('should display duration in seconds if provided', () => {
        default_trade_store.modules.trade.duration = 45;
        default_trade_store.modules.trade.duration_unit = 's';
        mockDuration();
        expect(screen.getByDisplayValue('45 sec')).toBeInTheDocument();
    });

    it('should display correct duration in ticks when tick duration is selected', () => {
        default_trade_store.modules.trade.duration = 5;
        default_trade_store.modules.trade.duration_unit = 't';
        mockDuration();
        expect(screen.getByDisplayValue('5 ticks')).toBeInTheDocument();
    });

    it('should update the selected hour and unit when the component is opened', async () => {
        default_trade_store.modules.trade.duration_unit = 'm';
        default_trade_store.modules.trade.duration = 125;
        mockDuration();

        const textField = screen.getByLabelText('Duration');
        await userEvent.click(textField);

        expect(screen.getByDisplayValue('2 hours 5 minutes')).toBeInTheDocument();
    });

    it('should update saved_expiry_date when expiry_epoch changes to a different date', () => {
        // Initial state with next year's date (simulating Accumulator contract)
        const next_year_epoch = 1792108799; // Oct 15, 2026
        default_trade_store.modules.trade.expiry_epoch = next_year_epoch;
        default_trade_store.modules.trade.saved_expiry_date_v2 = ''; // Start with empty

        render(
            <TraderProviders store={default_trade_store}>
                <Duration />
            </TraderProviders>
        );

        // Verify initial date is set from expiry_epoch
        expect(default_trade_store.modules.trade.setSavedExpiryDateV2).toHaveBeenCalledWith('2026-10-15');
    });

    it('should not update saved_expiry_date when expiry_epoch changes but date remains the same', () => {
        const mockSetSavedExpiryDateV2 = jest.fn();

        // Initial state with today's date
        const initial_epoch = 1760507040; // Oct 15, 2025 00:00:00
        default_trade_store.modules.trade.expiry_epoch = initial_epoch;
        default_trade_store.modules.trade.saved_expiry_date_v2 = '2025-10-15';
        default_trade_store.modules.trade.setSavedExpiryDateV2 = mockSetSavedExpiryDateV2;

        const { rerender } = render(
            <TraderProviders store={default_trade_store}>
                <Duration />
            </TraderProviders>
        );

        mockSetSavedExpiryDateV2.mockClear();

        // Simulate streaming proposal update with same date but different time
        const updated_epoch = 1760507041; // Oct 15, 2025 00:00:01 (1 second later)
        default_trade_store.modules.trade.expiry_epoch = updated_epoch;

        rerender(
            <TraderProviders store={default_trade_store}>
                <Duration />
            </TraderProviders>
        );

        // Verify that setSavedExpiryDateV2 is NOT called since the date hasn't changed
        expect(mockSetSavedExpiryDateV2).not.toHaveBeenCalled();
    });

    it('should handle expiry_epoch updates correctly when switching between contract types', () => {
        // Start with Accumulator (no duration) - next year's date
        const accumulator_epoch = 1792108799; // Oct 15, 2026
        default_trade_store.modules.trade.expiry_epoch = accumulator_epoch;
        default_trade_store.modules.trade.saved_expiry_date_v2 = ''; // Start with empty
        default_trade_store.modules.trade.contract_type = 'accumulator';

        render(
            <TraderProviders store={default_trade_store}>
                <Duration />
            </TraderProviders>
        );

        // Verify Accumulator's date is set
        expect(default_trade_store.modules.trade.setSavedExpiryDateV2).toHaveBeenCalledWith('2026-10-15');
    });
});

describe('DurationDesktop', () => {
    let default_trade_store: TCoreStores, mockOnChangeMultiple: jest.Mock;

    beforeEach(() => {
        mockOnChangeMultiple = jest.fn();
        default_trade_store = mockStore({
            modules: {
                trade: {
                    onChange: jest.fn(),
                    validation_errors: { duration: [] },
                    duration: 1,
                    duration_unit: 'd',
                    duration_units_list: [{ value: 'd', text: 'days' }],
                    expiry_type: 'duration',
                    expiry_time: '',
                    expiry_date: '',
                    onChangeMultiple: mockOnChangeMultiple,
                    duration_min_max: {
                        daily: { min: 86400, max: 31536000 },
                    },
                    start_time: null,
                    symbol: 'frxUSDJPY',
                    contract_type: 'touchnotouch',
                    active_symbols: [],
                },
            },
            common: {
                server_time: dayjs('2024-10-10T11:23:10.895Z'),
            },
        });
    });

    it('[DCE-002] does not seed a daily expiry default on mount', () => {
        render(
            <TraderProviders store={default_trade_store}>
                <DurationDesktop />
            </TraderProviders>
        );

        expect(mockOnChangeMultiple).not.toHaveBeenCalled();
    });
});

describe('Duration - Mobile', () => {
    let default_trade_store: TCoreStores, mockOnChangeMultiple: jest.Mock;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { isMobile } = require('@deriv/shared');
    const mockAddSnackbar = jest.fn();

    beforeAll(() => {
        (useSnackbar as jest.Mock).mockReturnValue({ addSnackbar: mockAddSnackbar });
    });

    beforeEach(() => {
        // Mock isMobile to return true for mobile tests
        (isMobile as jest.Mock).mockReturnValue(true);

        mockOnChangeMultiple = jest.fn();
        default_trade_store = mockStore({
            modules: {
                trade: {
                    onChange: jest.fn(),
                    validation_errors: { duration: [] },
                    duration: 30,
                    duration_unit: 'm',
                    expiry_type: 'duration',
                    expiry_time: '',
                    proposal_info: {},
                    onChangeMultiple: mockOnChangeMultiple,
                    duration_min_max: {
                        tick: { min: 1, max: 10 },
                        intraday: { min: 60, max: 3600 },
                        daily: { min: 86400, max: 172800 },
                    },
                    duration_units_list: [
                        { value: 't', text: 'ticks' },
                        { value: 's', text: 'seconds' },
                        { value: 'm', text: 'minutes' },
                        { value: 'h', text: 'hours' },
                        { value: 'd', text: 'days' },
                    ],
                    start_time: null,
                    symbol: 'EURUSD',
                    saved_expiry_date_v2: '',
                    setSavedExpiryDateV2: jest.fn(),
                    setUnsavedExpiryDateV2: jest.fn(),
                    unsaved_expiry_date_v2: '',
                },
            },
            common: {
                server_time: dayjs('2024-10-10T11:23:10.895Z'),
            },
        });
    });

    afterEach(() => {
        // Reset mock after each test
        (isMobile as jest.Mock).mockReturnValue(false);
    });

    const mockDurationMobile = () => {
        render(
            <TraderProviders store={default_trade_store}>
                <Duration />
            </TraderProviders>
        );
    };

    // The old "endtime with no expiry_time" guard moved to trade-store.spec.ts — TradeStore seeds
    // the daily expiry now and Duration only reads it.

    it('should render durations with an hour component in clock format (mobile)', () => {
        default_trade_store.modules.trade.duration = 125;
        mockDurationMobile();
        expect(screen.getByLabelText('Duration')).toBeInTheDocument();
        expect(screen.getByDisplayValue('02:05:00')).toBeInTheDocument();
    });

    it('should open the ActionSheet when the text field is clicked (mobile)', async () => {
        default_trade_store.modules.trade.expiry_time = '12:30';
        mockDurationMobile();
        const textField = screen.getByLabelText('Duration');
        expect(textField).toBeInTheDocument();
        await userEvent.click(textField);

        // Mobile uses ActionSheet with dialog role
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('seeds a usable end-time date when none was ever received from a proposal (mobile)', async () => {
        // `saved_expiry_date_v2` stays '' when the proposal errors, and `new Date('')` throws in the
        // date picker — which still renders.
        default_trade_store.modules.trade.saved_expiry_date_v2 = '';
        mockDurationMobile();

        await userEvent.click(screen.getByLabelText('Duration'));

        const { setUnsavedExpiryDateV2 } = default_trade_store.modules.trade;
        expect(setUnsavedExpiryDateV2).toHaveBeenCalledTimes(1);
        const [seeded_date] = (setUnsavedExpiryDateV2 as jest.Mock).mock.calls[0];
        expect(seeded_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(new Date(seeded_date).getTime()).not.toBeNaN();
    });

    it('keeps an already-known end-time date when opening (mobile)', async () => {
        default_trade_store.modules.trade.saved_expiry_date_v2 = '2024-10-15';
        mockDurationMobile();

        await userEvent.click(screen.getByLabelText('Duration'));

        expect(default_trade_store.modules.trade.setUnsavedExpiryDateV2).toHaveBeenCalledWith('2024-10-15');
    });

    it('should update the selected hour and unit when the component is opened (mobile)', async () => {
        default_trade_store.modules.trade.duration_unit = 'm';
        default_trade_store.modules.trade.duration = 125;
        mockDurationMobile();

        const textField = screen.getByLabelText('Duration');
        await userEvent.click(textField);

        expect(screen.getByDisplayValue('02:05:00')).toBeInTheDocument();
    });

    it('should render second-based durations with an hour component in clock format (mobile)', () => {
        default_trade_store.modules.trade.duration_unit = 's';
        default_trade_store.modules.trade.duration = 5445;
        mockDurationMobile();

        expect(screen.getByDisplayValue('01:30:45')).toBeInTheDocument();
    });

    it('should render legacy hour-unit durations in clock format (mobile)', () => {
        default_trade_store.modules.trade.duration_unit = 'h';
        default_trade_store.modules.trade.duration = 2;
        mockDurationMobile();

        expect(screen.getByDisplayValue('02:00:00')).toBeInTheDocument();
    });

    it('should not commit when closing on a selection equivalent to the stored duration (mobile)', async () => {
        // 120 seconds and the wheel's [0, 2, 0] are the same duration in different units
        default_trade_store.modules.trade.duration_unit = 's';
        default_trade_store.modules.trade.duration = 120;
        mockDurationMobile();

        await userEvent.click(screen.getByLabelText('Duration'));
        await userEvent.click(screen.getByTestId('dt-actionsheet-overlay'));

        expect(mockOnChangeMultiple).not.toHaveBeenCalled();
    });

    it('should render sub-hour combined durations verbosely (mobile)', () => {
        default_trade_store.modules.trade.duration_unit = 's';
        default_trade_store.modules.trade.duration = 75;
        mockDurationMobile();

        expect(screen.getByDisplayValue('1 minute 15 seconds')).toBeInTheDocument();
    });

    it('should not commit a duration when the sheet is closed without changes (mobile)', async () => {
        mockDurationMobile();

        await userEvent.click(screen.getByLabelText('Duration'));
        await userEvent.click(screen.getByTestId('dt-actionsheet-overlay'));

        expect(mockOnChangeMultiple).not.toHaveBeenCalled();
    });

    it('should disable the header save action when the selection matches the stored duration (mobile)', async () => {
        // 30 minutes opens on the Time tab with [0,30,0], which equals the committed value → nothing to save
        mockDurationMobile();

        await userEvent.click(screen.getByLabelText('Duration'));

        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('should commit the clamped time wheel selection only when the header save is tapped (mobile)', async () => {
        // 2 hours exceeds the 3600s intraday max, so the wheel clamps to 1 hour → the draft differs
        // from the committed 2h, enabling save; tapping it commits the clamped value as minutes
        default_trade_store.modules.trade.duration_unit = 'h';
        default_trade_store.modules.trade.duration = 2;
        mockDurationMobile();

        await userEvent.click(screen.getByLabelText('Duration'));

        const save_button = screen.getByRole('button', { name: 'Save' });
        expect(save_button).toBeEnabled();

        await userEvent.click(save_button);

        expect(mockOnChangeMultiple).toHaveBeenCalledWith({
            duration_unit: 'm',
            duration: 60,
            expiry_type: 'duration',
        });
    });

    it('should not commit the changed selection when dismissed via the overlay (mobile)', async () => {
        // Same clamped-and-dirty selection as above, but dismissed instead of saved → no commit
        default_trade_store.modules.trade.duration_unit = 'h';
        default_trade_store.modules.trade.duration = 2;
        mockDurationMobile();

        await userEvent.click(screen.getByLabelText('Duration'));
        await userEvent.click(screen.getByTestId('dt-actionsheet-overlay'));

        expect(mockOnChangeMultiple).not.toHaveBeenCalled();
    });

    it('[DCE-002] does not seed a daily expiry default on mount (mobile)', () => {
        default_trade_store.modules.trade.duration_unit = 'd';
        default_trade_store.modules.trade.saved_expiry_date_v2 = '';
        mockDurationMobile();

        expect(mockOnChangeMultiple).not.toHaveBeenCalled();
    });

    it('[DCE-002] upgrades the provisional expiry time once the store resolves the real close time', () => {
        // The store seeds expiry_date first, the close time a trading_times round trip later. The
        // field must land on the real close time, not the 23:59:59 fallback shown during the gap.
        default_trade_store.modules.trade.duration_unit = 'd';
        default_trade_store.modules.trade.saved_expiry_date_v2 = '';
        default_trade_store.modules.trade.expiry_date = '2026-08-28';
        default_trade_store.modules.trade.expiry_time = null;

        // Provisional pass. setSavedExpiryDateV2 is a jest.fn() so the store date does not persist
        // and the label stays blank, but setSavedExpiryTime is local state and holds the fallback.
        const { rerender } = render(
            <TraderProviders store={default_trade_store}>
                <Duration is_minimized={false} />
            </TraderProviders>
        );

        // Mirror the store write the mocked setter would have made, then land the real close time.
        // observer() wraps in React.memo and mockStore is not observable, so a same-props rerender
        // short-circuits — flipping is_minimized forces the re-read without remounting.
        act(() => {
            default_trade_store.modules.trade.saved_expiry_date_v2 = '2026-08-28';
            default_trade_store.modules.trade.expiry_time = '20:55:00';
        });
        rerender(
            <TraderProviders store={default_trade_store}>
                <Duration is_minimized />
            </TraderProviders>
        );

        expect(screen.getByDisplayValue(/28 Aug 2026, 20:55:00 GMT/)).toBeInTheDocument();
        expect(screen.queryByDisplayValue(/23:59:59/)).not.toBeInTheDocument();
    });

    it('should enable the header save and commit an endtime change when switching to the End time tab (mobile)', async () => {
        // The committed expiry_type is 'duration', so moving to End time is inherently dirty
        mockDurationMobile();

        await userEvent.click(screen.getByLabelText('Duration'));
        await userEvent.click(screen.getByRole('tab', { name: 'End time' }));

        const save_button = screen.getByRole('button', { name: 'Save' });
        expect(save_button).toBeEnabled();

        await userEvent.click(save_button);

        expect(mockOnChangeMultiple).toHaveBeenCalledWith(expect.objectContaining({ expiry_type: 'endtime' }));
    });
});

describe('DurationDesktop language switch', () => {
    const buildStore = (
        trade_overrides: Record<string, unknown> = {},
        common_overrides: Record<string, unknown> = {}
    ) =>
        mockStore({
            modules: {
                trade: {
                    onChange: jest.fn(),
                    validation_errors: { duration: [] },
                    onChangeMultiple: jest.fn(),
                    duration: 10,
                    duration_unit: 't',
                    duration_units_list: [
                        { value: 't', text: 'ticks' },
                        { value: 's', text: 'seconds' },
                        { value: 'm', text: 'minutes' },
                        { value: 'h', text: 'hours' },
                    ],
                    expiry_type: 'duration',
                    expiry_time: '',
                    expiry_date: '',
                    duration_min_max: {
                        tick: { min: 1, max: 10 },
                        intraday: { min: 60, max: 3600 },
                    },
                    start_time: null,
                    symbol: 'EURUSD',
                    contract_type: 'rise_fall',
                    active_symbols: [],
                    ...trade_overrides,
                },
            },
            common: { server_time: dayjs('2024-10-10T11:23:10.895Z'), ...common_overrides },
        });

    const renderDuration = (store: TCoreStores) =>
        render(
            <TraderProviders store={store}>
                <DurationDesktop />
            </TraderProviders>
        );

    const value_cases: { label: string; trade: Record<string, unknown>; english: string; spanish: string }[] = [
        {
            label: 'a tick duration',
            trade: { duration: 10, duration_unit: 't' },
            english: '10 ticks',
            spanish: '10 ES_ticks',
        },
        {
            label: 'a seconds duration',
            trade: { duration: 45, duration_unit: 's' },
            english: '45 sec',
            spanish: '45 ES_sec',
        },
        {
            label: 'whole hours stored in minutes',
            trade: { duration: 120, duration_unit: 'm' },
            english: '2 hours',
            spanish: '2 ES_hours',
        },
        {
            label: 'hours plus minutes',
            trade: { duration: 125, duration_unit: 'm' },
            english: '2 hours 5 minutes',
            spanish: '2 ES_hours 5 ES_minutes',
        },
        {
            // Under an hour, so the `'m'` branch falls through to `formatMinutesValue`. The >= 120
            // entries above never reach it, leaving its `[localize]` dep unguarded.
            label: 'minutes under an hour (reaches the minutes formatter)',
            trade: { duration: 45, duration_unit: 'm' },
            english: '45 min',
            spanish: '45 ES_min',
        },
    ];

    it.each(value_cases)(
        '[TPL-001] re-translates $label once the new language is available',
        ({ trade, english, spanish }) => {
            renderDuration(buildStore(trade));

            expect(screen.getByDisplayValue(english)).toBeInTheDocument();

            act(() => fireLanguageChanged('ES'));

            expect(screen.getByDisplayValue(spanish)).toBeInTheDocument();
        }
    );

    it('[TPL-001] re-translates the field label in the same update as its value', () => {
        renderDuration(buildStore());

        act(() => fireLanguageChanged('ES'));

        expect(screen.getByLabelText('ES_Duration')).toHaveValue('10 ES_ticks');
        expect(screen.queryByLabelText('Duration')).not.toBeInTheDocument();
    });

    it('[TPL-003] does not settle the text on a re-render that precedes the translations', () => {
        const { rerender } = renderDuration(buildStore());

        // The selected language flips before the bundle loads, and `TradeDesktop` is an observer on
        // it, so the panel re-renders at that too-early moment. It must not settle the text there.
        rerender(
            <TraderProviders store={buildStore({}, { current_language: 'ES' })}>
                <DurationDesktop />
            </TraderProviders>
        );

        expect(screen.getByDisplayValue('10 ticks')).toBeInTheDocument();

        act(() => fireLanguageChanged('ES'));

        expect(screen.getByDisplayValue('10 ES_ticks')).toBeInTheDocument();
    });

    it('[TPL-003] keeps an end-time value in the same date and time format', () => {
        renderDuration(buildStore({ expiry_type: 'endtime', expiry_date: '2024-10-15', expiry_time: '12:30:00' }));

        expect(screen.getByDisplayValue('15 Oct, 12:30')).toBeInTheDocument();

        act(() => fireLanguageChanged('ES'));

        expect(screen.getByDisplayValue('15 Oct, 12:30')).toBeInTheDocument();
    });

    it('[TPL-004] lands on the second language after two consecutive switches', () => {
        renderDuration(buildStore());

        act(() => fireLanguageChanged('ES'));
        act(() => fireLanguageChanged('FR'));

        expect(screen.getByDisplayValue('10 FR_ticks')).toBeInTheDocument();
    });

    // Behavioural only — `VerticalTabSelector`'s own `<Localize>` re-translates either way, so this
    // passes pre-fix too. `duration-unit-selector.spec.tsx` guards the selector itself.
    it('[TPL-004] re-translates the duration-unit options while the popover stays open', async () => {
        renderDuration(buildStore());

        await userEvent.click(screen.getByLabelText('Duration'));

        expect(screen.getByRole('tab', { name: 'Ticks' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: 'Seconds' })).toBeInTheDocument();

        act(() => fireLanguageChanged('ES'));

        expect(screen.getByRole('tab', { name: 'ES_Ticks' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: 'ES_Seconds' })).toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: 'Ticks' })).not.toBeInTheDocument();
    });

    // Covers the hour chip labels, previously unreached. Not a dep-array guard: the chips come from
    // `config`, which lists the formatter, so freezing it freezes `config` too and nothing re-renders.
    it('[TPL-001] re-translates the hour chip labels while the hours tab stays open', async () => {
        renderDuration(buildStore());

        await userEvent.click(screen.getByLabelText('Duration'));
        await userEvent.click(screen.getByRole('tab', { name: 'Hours' }));

        expect(screen.getByText('1 hr')).toBeInTheDocument();

        act(() => fireLanguageChanged('ES'));

        expect(screen.getByText('1 ES_hr')).toBeInTheDocument();
        expect(screen.queryByText('1 hr')).not.toBeInTheDocument();
    });
});

describe('Duration default on trade-type switch', () => {
    const mockApplyDefaultDuration = jest.fn();

    const buildStore = (trade_overrides: Record<string, unknown> = {}) =>
        mockStore({
            modules: {
                trade: {
                    onChange: jest.fn(),
                    validation_errors: { duration: [] },
                    duration: 30,
                    duration_unit: 'm',
                    expiry_type: 'duration',
                    expiry_time: '',
                    proposal_info: {},
                    onChangeMultiple: jest.fn(),
                    applyDefaultDuration: mockApplyDefaultDuration,
                    duration_min_max: {
                        tick: { min: 1, max: 10 },
                        intraday: { min: 60, max: 3600 },
                        daily: { min: 86400, max: 172800 },
                    },
                    duration_units_list: [
                        { value: 't', text: 'Ticks' },
                        { value: 'm', text: 'Minutes' },
                        { value: 'h', text: 'Hours' },
                        { value: 'd', text: 'Days' },
                    ],
                    start_time: null,
                    symbol: 'EURUSD',
                    contract_type: 'rise_fall',
                    saved_expiry_date_v2: '',
                    setSavedExpiryDateV2: jest.fn(),
                    setUnsavedExpiryDateV2: jest.fn(),
                    unsaved_expiry_date_v2: '',
                    ...trade_overrides,
                },
            },
            common: { server_time: dayjs('2024-10-10T11:23:10.895Z') },
        });

    const renderWith = (store: TCoreStores) =>
        render(
            <TraderProviders store={store}>
                <Duration />
            </TraderProviders>
        );

    beforeAll(() => {
        (useSnackbar as jest.Mock).mockReturnValue({ addSnackbar: jest.fn() });
    });

    beforeEach(() => {
        mockApplyDefaultDuration.mockClear();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    it('applies the configured default when the persisted duration is invalid for the constraints', () => {
        const { rerender } = renderWith(buildStore({ contract_type: 'rise_fall' }));

        // Clear the 500ms initial-mount guard so subsequent runs act on changes.
        act(() => jest.advanceTimersByTime(500));

        // 999 ticks is out of range for tick max 10 -> invalid persisted duration.
        rerender(
            <TraderProviders store={buildStore({ contract_type: 'rise_fall', duration: 999, duration_unit: 't' })}>
                <Duration />
            </TraderProviders>
        );

        act(() => jest.advanceTimersByTime(10)); // flush the reset timer

        expect(mockApplyDefaultDuration).toHaveBeenCalled();
    });

    it('does not reset when the persisted duration is still valid', () => {
        const { rerender } = renderWith(buildStore({ contract_type: 'rise_fall' }));

        act(() => jest.advanceTimersByTime(500));

        // Still a valid duration for the same constraints -> no reset.
        rerender(
            <TraderProviders store={buildStore({ contract_type: 'rise_fall', duration: 20 })}>
                <Duration />
            </TraderProviders>
        );

        act(() => jest.advanceTimersByTime(10));

        expect(mockApplyDefaultDuration).not.toHaveBeenCalled();
    });
});
