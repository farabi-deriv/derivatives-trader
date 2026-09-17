import { toMoment, WS } from '@deriv/shared';
import StatementStore from '../statement-store';
import { mockStore } from '@deriv/stores';

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    WS: {
        statement: jest.fn(),
        forgetAll: jest.fn(),
        setOnReconnect: jest.fn(),
        removeOnReconnect: jest.fn(),
    },
}));

jest.mock('lodash.debounce', () => jest.fn(fn => fn));

describe('StatementStore', () => {
    let statement_store;
    const root_store = mockStore({
        client: {
            loginid: 'test_loginid',
            is_logged_in: true,
        },
    });
    const response = {
        statement: {
            transactions: [
                { id: 1, action_type: 'buy', amount: 100 },
                { id: 2, action_type: 'sell', amount: 200 },
            ],
        },
    };

    beforeEach(() => {
        statement_store = new StatementStore({ root_store });
    });

    it('should initialize with correct default values', () => {
        expect(statement_store.data).toEqual([]);
        expect(statement_store.is_loading).toBe(true);
        expect(statement_store.has_loaded_all).toBe(false);
        expect(statement_store.date_from).toBeNull();
        expect(statement_store.date_to).toBe(toMoment().startOf('day').add(1, 'd').subtract(1, 's').unix());
        expect(statement_store.error).toBe('');
        expect(statement_store.action_type).toBe('all');
        expect(statement_store.client_loginid).toBe('');
        expect(statement_store.is_empty).toBe(false);
    });

    it('should compute is_empty correctly', () => {
        statement_store.is_loading = false;
        statement_store.data = [];
        expect(statement_store.is_empty).toBe(true);

        statement_store.data = [{ id: 1 }];
        expect(statement_store.is_empty).toBe(false);
    });

    it('should clear table correctly', () => {
        statement_store.data = [{ id: 1 }];
        statement_store.has_loaded_all = true;
        statement_store.is_loading = true;

        statement_store.clearTable();

        expect(statement_store.data).toEqual([]);
        expect(statement_store.has_loaded_all).toBe(false);
        expect(statement_store.is_loading).toBe(false);
    });

    it('should clear date filters', () => {
        statement_store.clearDateFilter();

        expect(statement_store.date_from).toBeNull();
        expect(statement_store.date_to).toBe(toMoment().startOf('day').add(1, 'd').subtract(1, 's').unix());
        expect(statement_store.partial_fetch_time).toBe(0);
    });

    it('should return false when shouldFetchNextBatch is called', () => {
        statement_store.has_loaded_all = true;
        statement_store.is_loading = true;
        expect(statement_store.shouldFetchNextBatch(false)).toBe(false);
    });

    it('should return true when shouldFetchNextBatch is called', () => {
        statement_store.has_loaded_all = false;
        statement_store.is_loading = false;
        statement_store.partial_fetch_time = '2024-07-08 07:10:00 GMT';
        expect(statement_store.shouldFetchNextBatch(false)).toBe(true);
    });

    it('should fetch next batch correctly', async () => {
        WS.statement.mockResolvedValue(response);
        statement_store.shouldFetchNextBatch = jest.fn().mockReturnValue(true);

        await statement_store.fetchNextBatch();

        expect(statement_store.is_loading).toBe(false);
        expect(WS.statement).toHaveBeenCalled();
        expect(statement_store.data.length).toBe(2);
    });

    it('should handle date change when both from and to date values are provided', () => {
        const date_values = {
            from: '2021-01-01',
            to: '2021-01-31',
            is_batch: false,
        };

        statement_store.handleDateChange(date_values);

        expect(statement_store.date_from).toBe(toMoment(date_values.from).unix());
        expect(statement_store.date_to).toBe(toMoment(date_values.to).unix());
    });

    it('should handle date change when is_batch value is true', () => {
        const date_values = {
            from: '',
            to: '2021-01-31',
            is_batch: true,
        };

        statement_store.handleDateChange(date_values);

        expect(statement_store.date_from).toBeNull();
        expect(statement_store.date_to).toBe(toMoment(date_values.to).unix());
    });

    it('should handle filter change correctly', () => {
        const filterValue = 'deposit';
        WS.statement.mockResolvedValue(response);
        statement_store.shouldFetchNextBatch = jest.fn().mockReturnValue(true);

        statement_store.handleFilterChange(filterValue);

        expect(statement_store.action_type).toBe(filterValue);
    });

    it("[RSF-001] resets action_type to the string 'all' when handleFilterChange is called with no argument", () => {
        WS.statement.mockResolvedValue(response);
        statement_store.shouldFetchNextBatch = jest.fn().mockReturnValue(true);
        statement_store.action_type = 'deposit';

        statement_store.handleFilterChange();

        expect(statement_store.action_type).toBe('all');
    });

    it('should fetch statement when fetchOnScroll is called with left less than 1500', () => {
        WS.statement.mockResolvedValue(response);
        statement_store.shouldFetchNextBatch = jest.fn().mockReturnValue(true);

        statement_store.fetchOnScroll(1400);

        expect(statement_store.is_loading).toBe(true);
        expect(WS.statement).toHaveBeenCalled();
    });

    it('should handle statement response correctly', () => {
        statement_store.statementHandler(response);

        expect(statement_store.data.length).toBe(2);
        expect(statement_store.is_loading).toBe(false);
    });

    it('should set error in statementHandler when response has error', () => {
        const response_with_error = {
            error: {
                message: 'error message',
            },
        };
        statement_store.statementHandler(response_with_error);

        expect(statement_store.error).toBe('error message');
    });

    it('[ABF-003] clears a prior error on a successful response', () => {
        statement_store.error = 'previous error';

        statement_store.statementHandler(response);

        expect(statement_store.error).toBe('');
    });

    it('[ABF-003] resets loading on the error branch so the tab is not stuck', () => {
        statement_store.is_loading = true;

        statement_store.statementHandler({ error: { message: 'boom' } });

        expect(statement_store.is_loading).toBe(false);
        expect(statement_store.error).toBe('boom');
    });

    it('should handle scroll when handleScroll is called', () => {
        const event = {
            target: {
                scrollTop: 0,
                scrollHeight: 3000,
                clientHeight: 1500,
            },
        };
        statement_store.fetchOnScroll = jest.fn();
        statement_store.handleScroll(event);

        expect(statement_store.fetchOnScroll).toHaveBeenCalledWith(1500);
    });

    it('should change is_loading as per is_online status', () => {
        statement_store.is_loading = false;

        statement_store.networkStatusChangeListener(false);

        expect(statement_store.is_loading).toBe(true);
    });

    it('should initialize the statements on mount and wait for authentication', async () => {
        WS.statement.mockResolvedValue(response);
        statement_store.shouldFetchNextBatch = jest.fn().mockReturnValue(true);

        statement_store.onMount();

        expect(statement_store.client_loginid).toBe(root_store.client.loginid);
        // Verify fetchNextBatch is eventually called after authentication
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(WS.statement).toHaveBeenCalled();
    });

    it('should not forget price-proposal subscriptions it does not own on Unmount', () => {
        statement_store.onUnmount();

        expect(WS.forgetAll).not.toHaveBeenCalledWith('proposal');
    });

    it('[ABF-002] disposes the base network-status reaction on unmount (calls super.onUnmount)', () => {
        statement_store.onMount();
        const network_disposer = jest.fn();
        statement_store.networkStatusChangeDisposer = network_disposer;

        statement_store.onUnmount();

        expect(network_disposer).toHaveBeenCalled();
    });

    // Characterization guard: never went red; pins that the dead members are gone while the live
    // statement surfaces survive.
    it('[SMC-018] drops account_statistics/filtered_date_range and keeps the live statement members', () => {
        expect('account_statistics' in statement_store).toBe(false);
        expect('filtered_date_range' in statement_store).toBe(false);

        [
            'data',
            'is_loading',
            'has_loaded_all',
            'date_from',
            'date_to',
            'error',
            'action_type',
            'client_loginid',
        ].forEach(member => expect(member in statement_store).toBe(true));
        expect(typeof statement_store.handleFilterChange).toBe('function');
    });
});
