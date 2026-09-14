import React from 'react';

import { type Dayjs } from '@deriv/shared';
import { useStore } from '@deriv/stores';

import { formatProfitTableTransactions } from './Modules/Profit/Helpers/format-response';
import ProfitStores from './Modules/Profit/profit-store';
import StatementStores from './Modules/Statement/statement-store';

type TOverrideProfitStore = Omit<ProfitStores, 'data' | 'date_from' | 'totals' | 'handleDateChange'> & {
    date_from: number;
    data: ReturnType<typeof formatProfitTableTransactions>[];
    handleDateChange: (
        values: { to?: Dayjs; from?: Dayjs; is_batch?: boolean },
        otherParams?: {
            date_range?: Record<string, string | number>;
            shouldFilterContractTypes?: boolean;
        }
    ) => void;
    totals: { [key: string]: unknown };
};

type TOverrideStatementStore = Omit<
    StatementStores,
    'action_type' | 'data' | 'date_from' | 'date_to' | 'handleDateChange' | 'handleFilterChange' | 'handleScroll'
> & {
    action_type: string;
    data: { [key: string]: string }[];
    date_from: number;
    date_to: number;
    handleDateChange: () => void;
    handleFilterChange: () => void;
    handleScroll: React.UIEventHandler<HTMLDivElement>;
};

export type TReportsStore = {
    profit_table: TOverrideProfitStore;
    statement: TOverrideStatementStore;
};

const ReportsStoreContext = React.createContext<TReportsStore | null>(null);

export const ReportsStoreProvider = ({ children }: React.PropsWithChildren<unknown>) => {
    const root_store = useStore();
    const memoizedValue = React.useMemo(() => {
        return {
            profit_table: new ProfitStores({ root_store }),
            statement: new StatementStores({ root_store }),
        } as unknown as TReportsStore;
    }, [root_store]);

    return <ReportsStoreContext.Provider value={memoizedValue}>{children}</ReportsStoreContext.Provider>;
};

export const useReportsStore = () => {
    const store = React.useContext(ReportsStoreContext);

    if (!store) {
        throw new Error('useReportsStore must be used within ReportsStoreProvider');
    }

    return store;
};
