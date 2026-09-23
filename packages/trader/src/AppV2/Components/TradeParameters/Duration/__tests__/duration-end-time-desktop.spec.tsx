import { dayjs } from '@deriv/shared';
import { mockStore } from '@deriv/stores';
import { TCoreStores } from '@deriv/stores/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TraderProviders from '../../../../../trader-providers';
import DurationEndTimeDesktop from '../duration-end-time-desktop';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
}));

// The calendar grid itself is out of scope here; only that picking a date feeds the real
// ContractType.getTradingTimes lookup through to Save (mirrors day.spec.tsx's picker mocks).
jest.mock('@deriv-com/quill-ui', () => ({
    ...jest.requireActual('@deriv-com/quill-ui'),
    DatePicker: ({ onChange }: { onChange: (date: Date) => void }) => (
        <button onClick={() => onChange(new Date('2030-06-12T00:00:00.000Z'))}>pick-future-date</button>
    ),
}));

jest.mock('Stores/Modules/Trading/Helpers/contract-type', () => ({
    ContractType: {
        getTradingEvents: jest.fn(() => Promise.resolve([])),
        getTradingDays: jest.fn(() => Promise.resolve(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])),
        getTradingTimes: jest.fn((date: string) => {
            const close_by_date: Record<string, string[]> = {
                '2030-06-12': ['23:59:59'],
            };
            return Promise.resolve({ open: ['00:00:00'], close: close_by_date[date] ?? ['23:59:59'] });
        }),
    },
}));

// Must stay before the 14:30 the same-day test picks — the grid disables past slots. UTC, not
// local: a local literal is a different instant per machine.
const FROZEN_NOW = new Date('2026-09-03T06:00:00.000Z');

describe('DurationEndTimeDesktop', () => {
    let default_trade_store: TCoreStores, mockOnChangeMultiple: jest.Mock;

    beforeEach(() => {
        // Only `Date` is faked; faking timers hangs `userEvent`.
        jest.useFakeTimers({
            doNotFake: [
                'performance',
                'setTimeout',
                'clearTimeout',
                'setInterval',
                'clearInterval',
                'queueMicrotask',
                'nextTick',
                'setImmediate',
                'clearImmediate',
            ],
        });
        jest.setSystemTime(FROZEN_NOW);
        mockOnChangeMultiple = jest.fn();
        default_trade_store = mockStore({
            modules: {
                trade: {
                    expiry_type: 'duration',
                    expiry_time: '',
                    expiry_date: '',
                    duration_unit: 'd',
                    duration: 1,
                    duration_units_list: [{ value: 'd', text: 'days' }],
                    duration_min_max: {
                        daily: { min: 86400, max: 31536000 },
                    },
                    market_open_times: [],
                    market_close_times: [],
                    start_date: 0,
                    start_time: null,
                    symbol: 'frxUSDJPY',
                    onChangeMultiple: mockOnChangeMultiple,
                },
            },
            common: {
                server_time: dayjs(),
            },
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const mockDurationEndTimeDesktop = () =>
        render(
            <TraderProviders store={default_trade_store}>
                <DurationEndTimeDesktop onClose={jest.fn()} />
            </TraderProviders>
        );

    const pickFutureDate = async () => {
        await userEvent.click(screen.getByTestId('dt_duration_end_date_input'));
        await userEvent.click(screen.getByText('pick-future-date'));
    };

    it('[DCE-004][EGRID-002] saves the full close time for a daily-only contract closing at end of day', async () => {
        mockDurationEndTimeDesktop();

        await pickFutureDate();
        await screen.findByDisplayValue('23:59:59 GMT');

        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(mockOnChangeMultiple).toHaveBeenCalledWith({
            expiry_type: 'endtime',
            expiry_date: '2030-06-12',
            expiry_time: '23:59:59',
        });
    });

    it('[DCE-004][EGRID-002] keeps the displayed end time at full precision when the market closes before midnight', async () => {
        (
            jest.requireMock('Stores/Modules/Trading/Helpers/contract-type').ContractType.getTradingTimes as jest.Mock
        ).mockImplementationOnce(() => Promise.resolve({ open: ['00:00:00'], close: ['20:55:00'] }));

        mockDurationEndTimeDesktop();

        await pickFutureDate();

        // Currently truncates to `HH:mm` ('20:55 GMT') — the fix must show the full close time.
        await screen.findByDisplayValue('20:55:00 GMT');
    });

    it('[DCE-004][EGRID-001] characterizes the intraday same-day path: a grid-picked time still saves HH:mm plus seconds', async () => {
        default_trade_store.modules.trade.duration_unit = 'm';
        default_trade_store.modules.trade.duration_units_list = [
            { value: 'm', text: 'minutes' },
            { value: 'd', text: 'days' },
        ];
        default_trade_store.modules.trade.duration_min_max = {
            intraday: { min: 60, max: 3600 },
            daily: { min: 86400, max: 31536000 },
        };

        mockDurationEndTimeDesktop();

        await userEvent.click(screen.getByTestId('dt_duration_end_time_input'));
        await userEvent.click(await screen.findByRole('button', { name: 'Hour 14' }));
        await userEvent.click(screen.getByRole('button', { name: 'Minute 30' }));
        await userEvent.click(screen.getByRole('button', { name: 'Done' }));

        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(mockOnChangeMultiple).toHaveBeenCalledWith(
            expect.objectContaining({
                expiry_type: 'endtime',
                expiry_time: '14:30:00',
            })
        );
    });
});
