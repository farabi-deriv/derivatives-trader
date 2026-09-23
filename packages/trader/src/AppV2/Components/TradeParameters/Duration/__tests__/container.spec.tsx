import React from 'react';

import { dayjs } from '@deriv/shared';
import { mockStore } from '@deriv/stores';
import { TCoreStores } from '@deriv/stores/types';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TraderProviders from '../../../../../trader-providers';
import DurationActionSheetContainer from '../container';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
}));

global.ResizeObserver = ResizeObserver;
global.HTMLElement.prototype.scrollIntoView = jest.fn();

jest.mock('Stores/Modules/Trading/Helpers/contract-type', () => ({
    ContractType: {
        getTradingEvents: jest.fn(),
        getTradingDays: jest.fn(),
    },
}));

jest.mock('AppV2/Hooks/useActiveSymbols', () => ({
    __esModule: true,
    default: jest.fn(() => ({
        activeSymbols: [{ symbol: '1HZ100V', display_name: '"Volatility 100 (1s) Index"', exchange_is_open: 1 }],
    })),
}));

jest.mock('../day', () => ({
    __esModule: true,
    default: jest.fn(() => <div>Mocked DayInput</div>),
}));

const default_props = {
    tab: 'time',
    setTab: jest.fn(),
    selected_ticks: 1,
    setSelectedTicks: jest.fn(),
    selected_time: [0, 30, 0],
    setSelectedTime: jest.fn(),
    selected_expiry_time: '',
    selected_expiry_date: '',
    setSelectedExpiryTime: jest.fn(),
    setSelectedExpiryDate: jest.fn(),
    onSave: jest.fn(),
    is_save_disabled: false,
};

describe('DurationActionSheetContainer', () => {
    let default_trade_store: TCoreStores;

    beforeEach(() => {
        jest.clearAllMocks();
        default_trade_store = mockStore({
            modules: {
                trade: {
                    duration: 30,
                    duration_unit: 'm',
                    duration_units_list: [
                        { value: 't', text: 'ticks' },
                        { value: 's', text: 'seconds' },
                        { value: 'm', text: 'minutes' },
                        { value: 'h', text: 'hours' },
                        { value: 'd', text: 'days' },
                    ],
                    duration_min_max: {
                        daily: {
                            min: 86400,
                            max: 31536000,
                        },
                        intraday: {
                            min: 15,
                            max: 86400,
                        },
                        tick: {
                            min: 1,
                            max: 10,
                        },
                    },
                    onChangeMultiple: jest.fn(),
                    expiry_time: null,
                    contract_type: 'call',
                    symbol: '1HZ100V',
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

    const renderDurationContainer = (
        mocked_store: TCoreStores,
        props: Partial<React.ComponentProps<typeof DurationActionSheetContainer>> = {}
    ) => {
        render(
            <TraderProviders store={mocked_store}>
                <DurationActionSheetContainer {...default_props} {...props} />
            </TraderProviders>
        );
    };

    it('should render Ticks, Time and End time tabs when all units are available', () => {
        renderDurationContainer(default_trade_store);

        expect(screen.getByRole('tab', { name: 'Ticks' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Time' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'End time' })).toBeInTheDocument();
    });

    it('should not render Ticks tab when ticks are not available', () => {
        default_trade_store.modules.trade.duration_units_list = [
            { value: 'm', text: 'minutes' },
            { value: 'h', text: 'hours' },
            { value: 'd', text: 'days' },
        ];
        renderDurationContainer(default_trade_store);

        expect(screen.queryByRole('tab', { name: 'Ticks' })).not.toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Time' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'End time' })).toBeInTheDocument();
    });

    it('should not render Time tab when no intraday units are available', () => {
        default_trade_store.modules.trade.duration_units_list = [
            { value: 't', text: 'ticks' },
            { value: 'd', text: 'days' },
        ];
        renderDurationContainer(default_trade_store, { tab: 't' });

        expect(screen.getByRole('tab', { name: 'Ticks' })).toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: 'Time' })).not.toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'End time' })).toBeInTheDocument();
    });

    it('should not render tabs if duration_units_list contains only ticks', () => {
        default_trade_store.modules.trade.duration_unit = 't';
        default_trade_store.modules.trade.duration_units_list = [{ value: 't', text: 'ticks' }];
        renderDurationContainer(default_trade_store, { tab: 't' });

        expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    });

    it('should call setTab when switching tabs', async () => {
        const setTab = jest.fn();
        renderDurationContainer(default_trade_store, { setTab });

        await userEvent.click(screen.getByRole('tab', { name: 'Ticks' }));
        expect(setTab).toHaveBeenCalledWith('t');

        await userEvent.click(screen.getByRole('tab', { name: 'End time' }));
        expect(setTab).toHaveBeenCalledWith('d');
    });

    it('should render the full ticks range on the Ticks tab', () => {
        renderDurationContainer(default_trade_store, { tab: 't', selected_ticks: 5 });

        expect(screen.getByText('1 tick')).toBeInTheDocument();
        expect(screen.getByText('5 ticks')).toBeInTheDocument();
        expect(screen.getByText('10 ticks')).toBeInTheDocument();
    });

    it('should render hour, minute and second wheels on the Time tab', () => {
        renderDurationContainer(default_trade_store, { selected_time: [1, 30, 0] });

        expect(screen.getByText('1 hr')).toBeInTheDocument();
        expect(screen.getByText('30 min')).toBeInTheDocument();
        expect(screen.getByText('0 sec')).toBeInTheDocument();
    });

    it('[DTW-001] renders seconds starting at the intraday minimum when hours and minutes are both 0', () => {
        renderDurationContainer(default_trade_store, { selected_time: [0, 0, 15] });

        expect(screen.queryByText('0 sec')).not.toBeInTheDocument();
        expect(screen.queryByText('14 sec')).not.toBeInTheDocument();
        expect(screen.getByText('15 sec')).toBeInTheDocument();
        expect(screen.getByText('59 sec')).toBeInTheDocument();
    });

    it('should snap a selection below the intraday minimum back into range once the wheel settles', async () => {
        const setSelectedTime = jest.fn();
        renderDurationContainer(default_trade_store, { selected_time: [0, 0, 10], setSelectedTime });

        await waitFor(() => expect(setSelectedTime).toHaveBeenCalledWith([0, 0, 15]));
    });

    it('should snap a selection above the intraday maximum back into range once the wheel settles', async () => {
        const setSelectedTime = jest.fn();
        renderDurationContainer(default_trade_store, { selected_time: [24, 30, 0], setSelectedTime });

        await waitFor(() => expect(setSelectedTime).toHaveBeenCalledWith([24, 0, 0]));
    });

    it('should not snap a valid selection', async () => {
        const setSelectedTime = jest.fn();
        renderDurationContainer(default_trade_store, { selected_time: [1, 30, 45], setSelectedTime });

        // Wait past the snap-back delay; the wheels echo the mounted value, but nothing may change it
        await new Promise(resolve => setTimeout(resolve, 400));
        setSelectedTime.mock.calls.forEach(([value]) => expect(value).toEqual([1, 30, 45]));
    });

    // Renders the container with real selection state and records every update the wheels emit
    const renderStatefulTimeWheel = (initial_time: number[], selections: number[][]) => {
        const Wrapper = () => {
            const [selected_time, setSelectedTime] = React.useState(initial_time);
            return (
                <TraderProviders store={default_trade_store}>
                    <DurationActionSheetContainer
                        {...default_props}
                        selected_time={selected_time}
                        setSelectedTime={next => {
                            selections.push(next);
                            setSelectedTime(next);
                        }}
                    />
                </TraderProviders>
            );
        };
        render(<Wrapper />);
    };

    // Simulates the quill wheel's scroll listener (captured at mount) settling on an item index.
    // Scoped to the Time wheel because the always-mounted Ticks wheel also renders a listbox.
    const scrollWheelColumn = (column_index: number, item_index: number) => {
        const list = within(screen.getByTestId('dt_duration_time_wheel')).getAllByRole('listbox')[column_index];
        Object.defineProperty(list, 'scrollTop', { value: item_index * 48, configurable: true });
        fireEvent.scroll(list);
    };

    it('should keep a minutes selection when seconds change afterwards', async () => {
        const selections: number[][] = [];
        renderStatefulTimeWheel([0, 0, 15], selections);

        scrollWheelColumn(1, 1); // minutes → 1
        scrollWheelColumn(2, 10); // seconds → 10

        // 1 min 10 sec is valid, so it must survive both the update and the snap-back window
        await new Promise(resolve => setTimeout(resolve, 400));
        expect(selections[selections.length - 1]).toEqual([0, 1, 10]);
    });

    it('should relax seconds back to 0 when minutes move off the boundary that forced them up', async () => {
        const selections: number[][] = [];
        renderStatefulTimeWheel([0, 0, 15], selections);

        scrollWheelColumn(1, 1); // minutes 0 → 1 releases the 15s floor

        await waitFor(() => expect(selections[selections.length - 1]).toEqual([0, 1, 0]));
    });

    it('should keep a deliberate seconds value when minutes change', async () => {
        const selections: number[][] = [];
        renderStatefulTimeWheel([0, 5, 30], selections);

        scrollWheelColumn(1, 6); // minutes 5 → 6; 30 sec was not forced, so it stays

        await new Promise(resolve => setTimeout(resolve, 400));
        expect(selections[selections.length - 1]).toEqual([0, 6, 30]);
    });

    it('[DTW-001] does not render a seconds wheel and floors minutes at the intraday minimum when seconds are not available', () => {
        default_trade_store.modules.trade.duration_units_list = [
            { value: 'm', text: 'minutes' },
            { value: 'h', text: 'hours' },
            { value: 'd', text: 'days' },
        ];
        default_trade_store.modules.trade.duration_min_max.intraday = { min: 900, max: 86400 };
        renderDurationContainer(default_trade_store, { selected_time: [0, 15, 0] });

        expect(screen.queryByText(/sec/)).not.toBeInTheDocument();
        expect(screen.queryByText('0 min')).not.toBeInTheDocument();
        expect(screen.getByText('15 min')).toBeInTheDocument();
        expect(screen.getByText('59 min')).toBeInTheDocument();
    });

    it('should not render hours the contract can never reach', () => {
        default_trade_store.modules.trade.duration_min_max.intraday = { min: 15, max: 3600 };
        renderDurationContainer(default_trade_store, { selected_time: [0, 30, 0] });

        expect(screen.getByText('0 hr')).toBeInTheDocument();
        expect(screen.getByText('1 hr')).toBeInTheDocument();
        expect(screen.queryByText('2 hr')).not.toBeInTheDocument();
    });

    it('should render DayInput and the header save action on the End time tab', () => {
        renderDurationContainer(default_trade_store, { tab: 'd' });

        expect(screen.getByText('Mocked DayInput')).toBeInTheDocument();
        // The commit is a header icon-action (aria-label), not a visible-text footer button
        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('should not render a footer Save button for the End time tab', () => {
        renderDurationContainer(default_trade_store, { tab: 'd' });

        // The header save exposes only an aria-label, so there is no visible "Save" text anymore
        expect(screen.queryByText('Save')).not.toBeInTheDocument();
    });

    it('should call onSave when the header save action is tapped', async () => {
        const onSave = jest.fn();
        renderDurationContainer(default_trade_store, { tab: 'd', onSave });

        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('should disable the header save action when is_save_disabled is true', () => {
        renderDurationContainer(default_trade_store, { tab: 'd', is_save_disabled: true });

        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });
});
