import React from 'react';

import { Loading, Money, Text } from '@deriv/components';
import { TReportsStore, useReportsStore } from '@deriv/reports/src/Stores/useReportsStores';
import { observer, useStore } from '@deriv/stores';
import { Localize, localize } from '@deriv-com/translations';

import { ContractCardsSections } from 'AppV2/Components/ContractCard';
import useIsAutomationEnabled from 'AppV2/Hooks/useIsAutomationEnabled';
import useTradeModeFilter from 'AppV2/Hooks/useTradeModeFilter';
import { filterByTradeMode } from 'AppV2/Utils/positions-utils';

import EmptyPortfolioMessage from './empty-portfolio-message';
import PositionsDrawerTimeFilter from './positions-drawer-time-filter';
import PositionsDrawerTradeModeFilter from './positions-drawer-trade-mode-filter';

type TClosedPosition = {
    contract_info: TReportsStore['profit_table']['data'][number];
};

/**
 * PositionsDrawerClosedContent - Closed positions content for the desktop flyout
 */
export const PositionsDrawerClosedContent = observer(() => {
    const { client } = useStore();
    const { currency } = client;
    const { data, handleDateChange, handleScroll, is_empty, is_loading, onMount, onUnmount, clearTable } =
        useReportsStore().profit_table;
    const { tradeModeFilter } = useTradeModeFilter();
    const { is_enabled: is_automation_enabled } = useIsAutomationEnabled();

    const closedPositions: TClosedPosition[] = React.useMemo(
        () =>
            filterByTradeMode(
                data.map(d => ({ contract_info: d })),
                tradeModeFilter
            ),
        [data, tradeModeFilter]
    );

    React.useEffect(() => {
        onMount(true);
        return () => {
            clearTable();
            onUnmount();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
        handleScroll(e, true);
    };

    // Filter is always rendered so the user can change/clear the time range
    // even from the loading and empty-results states — otherwise they'd be
    // stranded when a filter returns zero rows.

    const renderBody = () => {
        if (is_loading && !closedPositions.length) {
            return <Loading.DTraderV2 is_positions is_closed_tab />;
        }
        if (is_empty && !closedPositions.length) {
            return (
                <EmptyPortfolioMessage
                    // Mirrors the open tab's wording; Figma only specifies the open-positions state.
                    title={<Localize i18n_default_text='No closed positions yet' />}
                    description={<Localize i18n_default_text='Your closed positions will appear here.' />}
                />
            );
        }
        return (
            <div className='positions-drawer-closed' onScroll={onScroll}>
                <ContractCardsSections currency={currency} positions={closedPositions} isLoadingMore={is_loading} />
            </div>
        );
    };

    return (
        <div className='positions-drawer-closed-tab'>
            <div className='positions-drawer-closed-tab__filters'>
                <PositionsDrawerTimeFilter handleDateChange={handleDateChange} />
                {is_automation_enabled && <PositionsDrawerTradeModeFilter />}
            </div>
            {renderBody()}
        </div>
    );
});

/**
 * PositionsDrawerClosedFooter - Footer for closed positions tab
 */
export const PositionsDrawerClosedFooter = observer(() => {
    const { client } = useStore();
    const { currency } = client;
    const { data } = useReportsStore().profit_table;

    const totalProfit = React.useMemo(
        () => data.reduce((total, position) => total + (Number(position.profit_loss) || 0), 0),
        [data]
    );

    if (!data.length) return null;

    return (
        <div className='positions-drawer-footer--summary'>
            <Text size='xxs' className='positions-drawer-footer--count'>
                {data.length} {`${data.length > 1 ? localize('closed positions') : localize('closed position')}`}
            </Text>
            <div className='positions-drawer-footer--total'>
                <Text size='xs' weight='bold'>
                    <Localize i18n_default_text='Total P/L:' />
                </Text>
                <Text size='xs' weight='bold' color={totalProfit > 0 ? 'success' : 'danger'}>
                    <React.Fragment>
                        <Money amount={totalProfit} currency={currency} has_sign /> {currency}
                    </React.Fragment>
                </Text>
            </div>
        </div>
    );
});
