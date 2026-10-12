import { observable } from 'mobx';

import { dayjs } from '@deriv/shared';
import { mockStore } from '@deriv/stores';
import { TCoreStores } from '@deriv/stores/types';
import { act, render, screen } from '@testing-library/react';
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

    describe('intraday minimum end-time floor', () => {
        // frx Rise/Fall shape: 15-minute intraday minimum. Frozen at 06:00:00 UTC, the floor is
        // ceil(06:00 + 15min + 1min) = 06:20; the legacy boundary start would be 06:05.
        const setupIntradayForexStore = () => {
            default_trade_store.modules.trade.duration_unit = 'm';
            default_trade_store.modules.trade.duration_units_list = [
                { value: 'm', text: 'minutes' },
                { value: 'd', text: 'days' },
            ];
            default_trade_store.modules.trade.duration_min_max = {
                intraday: { min: 900, max: 3600 },
                daily: { min: 86400, max: 31536000 },
            };
        };

        it('[FEET-003] defaults the end time to the minimum-derived floor and disables sub-floor grid slots', async () => {
            setupIntradayForexStore();
            mockDurationEndTimeDesktop();

            await screen.findByDisplayValue('06:20 GMT');

            await userEvent.click(screen.getByTestId('dt_duration_end_time_input'));

            expect(await screen.findByRole('button', { name: 'Hour 05' })).toBeDisabled();
            expect(screen.getByRole('button', { name: 'Hour 06' })).toBeEnabled();
            expect(screen.getByRole('button', { name: 'Minute 00' })).toBeDisabled();
            expect(screen.getByRole('button', { name: 'Minute 05' })).toBeDisabled();
            expect(screen.getByRole('button', { name: 'Minute 10' })).toBeDisabled();
            expect(screen.getByRole('button', { name: 'Minute 15' })).toBeDisabled();
            expect(screen.getByRole('button', { name: 'Minute 20' })).toBeEnabled();
        });

        it('[FEET-003] re-evaluates the floor as the clock advances and bumps a decayed default', async () => {
            setupIntradayForexStore();
            // The store mock is a plain object; an observable common lets the ticking server_time
            // drive the observer component the way the real store's observable does.
            const observable_common = observable({ ...default_trade_store.common });
            default_trade_store = {
                ...default_trade_store,
                common: observable_common,
            } as unknown as TCoreStores;
            mockDurationEndTimeDesktop();

            await screen.findByDisplayValue('06:20 GMT');

            // 06:10:30 + 15min + 1min = 06:26:30 → ceil → 06:30; the seeded 06:20 is now sub-floor.
            act(() => {
                observable_common.server_time = dayjs('2026-09-03T06:10:30.000Z');
            });

            await screen.findByDisplayValue('06:30 GMT');

            await userEvent.click(screen.getByTestId('dt_duration_end_time_input'));
            expect(await screen.findByRole('button', { name: 'Minute 25' })).toBeDisabled();
            expect(screen.getByRole('button', { name: 'Minute 30' })).toBeEnabled();
        });

        it('[FEET-003] does not clobber a valid user pick when the floor advances', async () => {
            setupIntradayForexStore();
            const observable_common = observable({ ...default_trade_store.common });
            default_trade_store = {
                ...default_trade_store,
                common: observable_common,
            } as unknown as TCoreStores;
            mockDurationEndTimeDesktop();

            await userEvent.click(screen.getByTestId('dt_duration_end_time_input'));
            await userEvent.click(await screen.findByRole('button', { name: 'Hour 14' }));
            await userEvent.click(screen.getByRole('button', { name: 'Minute 30' }));
            await userEvent.click(screen.getByRole('button', { name: 'Done' }));
            await screen.findByDisplayValue('14:30 GMT');

            act(() => {
                observable_common.server_time = dayjs('2026-09-03T06:10:30.000Z');
            });

            expect(screen.getByDisplayValue('14:30 GMT')).toBeInTheDocument();
        });
    });
});
