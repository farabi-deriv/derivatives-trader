import React from 'react';

import { dayjs, routes } from '@deriv/shared';
import { mockStore } from '@deriv/stores';
import { TCoreStores } from '@deriv/stores/types';
import { useSnackbar } from '@deriv-com/quill-ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useProposal } from 'AppV2/Hooks/useProposal';
import { getErrorSnackbarBottomOffset } from 'AppV2/Utils/layout-utils';

import TraderProviders from '../../../../../trader-providers';
import DayInput from '../day';

jest.mock('@deriv-com/quill-ui', () => ({
    ...jest.requireActual('@deriv-com/quill-ui'),
    useSnackbar: jest.fn(),
}));

jest.mock('AppV2/Hooks/useProposal', () => ({
    useProposal: jest.fn(() => ({ data: undefined, error: undefined })),
}));

jest.mock('@deriv/quill-icons', () => ({
    ...jest.requireActual('@deriv/quill-icons'),
    LabelPairedChevronDownMdRegularIcon: (props: Record<string, unknown>) => (
        <svg data-testid='chevron-down-icon' {...props} />
    ),
    LabelPairedCalendarSmRegularIcon: (props: Record<string, unknown>) => (
        <svg data-testid='calendar-icon' {...props} />
    ),
    LabelPairedClockThreeSmRegularIcon: (props: Record<string, unknown>) => <svg data-testid='clock-icon' {...props} />,
}));

// The pickers' own data-fetching behaviour is out of scope here; only that DayInput opens them.
jest.mock('../datepicker', () => ({
    __esModule: true,
    default: () => <div>Mocked DaysDatepicker</div>,
}));

// Interactive so a test can browse to a new end time (the real picker just calls setEndTime)
jest.mock('../timepicker', () => ({
    __esModule: true,
    default: ({ setEndTime }: { setEndTime: (t: string) => void }) => (
        <button onClick={() => setEndTime('10:30:00')}>browse-time</button>
    ),
}));

describe('DayInput', () => {
    let default_trade_store: TCoreStores;

    beforeEach(() => {
        default_trade_store = mockStore({
            modules: {
                trade: {
                    amount: 10,
                    barrier_1: '',
                    contract_type: 'rise_fall',
                    duration_min_max: {
                        intraday: { min: 60, max: 3600 },
                        daily: { min: 86400, max: 172800 },
                    },
                    duration_unit: 'd',
                    duration_units_list: [
                        { value: 'd', text: 'days' },
                        { value: 'm', text: 'minutes' },
                    ],
                    duration: 1,
                    expiry_type: 'endtime',
                    is_turbos: false,
                    market_close_times: [],
                    market_open_times: [],
                    start_date: 1,
                    start_time: null,
                    symbol: 'EURUSD',
                    trade_types: { rise_fall: 'Rise/Fall' },
                },
            },
            common: {
                server_time: dayjs('2024-10-10T11:23:10.895Z'),
            },
        });
    });

    beforeAll(() => {
        (useSnackbar as jest.Mock).mockReturnValue({ addSnackbar: jest.fn() });
    });

    afterEach(() => {
        // Reset the proposal hook so an error stubbed in one test does not leak into the next
        (useProposal as jest.Mock).mockReturnValue({ data: undefined, error: undefined });
    });

    const mockDayInput = (props: Partial<React.ComponentProps<typeof DayInput>> = {}) =>
        render(
            <TraderProviders store={default_trade_store}>
                <DayInput
                    selected_expiry_date='2025-10-15'
                    selected_expiry_time='23:59:59'
                    setSelectedExpiryDate={jest.fn()}
                    setSelectedExpiryTime={jest.fn()}
                    {...props}
                />
            </TraderProviders>
        );

    it('does not render a chevron icon on the Date or Time field', () => {
        mockDayInput();

        expect(screen.queryAllByTestId('chevron-down-icon')).toHaveLength(0);
    });

    it('still renders the leading calendar and clock icons', () => {
        mockDayInput();

        expect(screen.getByTestId('calendar-icon')).toBeInTheDocument();
        expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    });

    it('opens the date picker when the Date field is tapped', async () => {
        mockDayInput();

        await userEvent.click(screen.getByTestId('dt_date_input'));

        expect(screen.getByText('Pick an end date')).toBeInTheDocument();
    });

    it('opens the time picker when the Time field is tapped', async () => {
        mockDayInput();

        await userEvent.click(screen.getByDisplayValue('23:59:59 GMT'));

        expect(screen.getByText('Pick an end time')).toBeInTheDocument();
    });

    it('disables the header save until the browsed value differs from the snapshot', async () => {
        mockDayInput();

        await userEvent.click(screen.getByDisplayValue('23:59:59 GMT'));

        // Nothing browsed yet → save disabled
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

        await userEvent.click(screen.getByText('browse-time'));

        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('keeps the browsed end time when the header save is tapped', async () => {
        mockDayInput();

        await userEvent.click(screen.getByDisplayValue('23:59:59 GMT'));
        await userEvent.click(screen.getByText('browse-time'));
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        // Save keeps the browsed value: the time field still shows the new value
        expect(screen.getByDisplayValue('10:30:00 GMT')).toBeInTheDocument();
    });

    it('restores the snapshot when the picker is dismissed via the close action', async () => {
        mockDayInput();

        await userEvent.click(screen.getByDisplayValue('23:59:59 GMT'));
        await userEvent.click(screen.getByText('browse-time'));

        // Field reflects the browsed value while the picker is open
        expect(screen.getByDisplayValue('10:30:00 GMT')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Close' }));

        // Dismiss discards the browse and restores the snapshot taken on open
        expect(screen.getByDisplayValue('23:59:59 GMT')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('10:30:00 GMT')).not.toBeInTheDocument();
    });

    it('disables the header save while the browsed date fails proposal validation', async () => {
        // Mount with a valid proposal, then flip to an error so the proposal effect runs while the
        // picker is open (mirrors a browsed date that fails validation) and sets the disabled state.
        let proposal_result: { data: unknown; error: unknown } = { data: { proposal: {} }, error: undefined };
        (useProposal as jest.Mock).mockImplementation(() => proposal_result);
        mockDayInput();

        proposal_result = {
            data: undefined,
            error: { message: 'Invalid duration', details: { field: 'duration' } },
        };
        await userEvent.click(screen.getByDisplayValue('23:59:59 GMT'));
        await userEvent.click(screen.getByText('browse-time'));

        // Even though the browsed value is dirty, the proposal error keeps save disabled
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('positions its error toast clear of the Buy button', async () => {
        // The offset arithmetic is covered in layout-utils.spec.ts; what this pins is that this call
        // site passes the trade-page arguments, so a later edit here cannot silently drop the
        // clearance and put the toast back on top of Buy (issue #1246).
        const mockAddSnackbar = jest.fn();
        (useSnackbar as jest.Mock).mockReturnValue({ addSnackbar: mockAddSnackbar });

        let proposal_result: { data: unknown; error: unknown } = { data: { proposal: {} }, error: undefined };
        (useProposal as jest.Mock).mockImplementation(() => proposal_result);
        mockDayInput();

        proposal_result = {
            data: undefined,
            error: { message: 'Invalid duration', details: { field: 'duration' } },
        };
        await userEvent.click(screen.getByDisplayValue('23:59:59 GMT'));
        await userEvent.click(screen.getByText('browse-time'));

        expect(mockAddSnackbar).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'fail',
                style: expect.objectContaining({
                    marginBottom: getErrorSnackbarBottomOffset({ pathname: routes.index }),
                }),
            })
        );
    });
});
