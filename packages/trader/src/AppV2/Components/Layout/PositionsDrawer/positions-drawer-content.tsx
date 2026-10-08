import React from 'react';

import { Money, Text } from '@deriv/components';
import { observer, useStore } from '@deriv/stores';
import { Localize, localize } from '@deriv-com/translations';

import { ContractCardList } from 'AppV2/Components/ContractCard';
import useIsPhoneLandscape from 'AppV2/Hooks/useIsPhoneLandscape';

import EmptyPortfolioMessage from './empty-portfolio-message';

type TPortfolioPosition = ReturnType<typeof useStore>['portfolio']['active_positions'][0];

/**
 * PositionsDrawerContent - Open positions list using the same card as mobile
 */
export const PositionsDrawerContent = observer(() => {
    const { client, common, portfolio, ui } = useStore();
    const { currency } = client;
    const { server_time } = common;
    const { active_positions, error, onClickCancel, onClickSell } = portfolio;
    const { is_switching_account } = ui;
    const is_phone_landscape = useIsPhoneLandscape();

    if (active_positions.length === 0 || error || is_switching_account) {
        return <EmptyPortfolioMessage error={error} />;
    }

    return (
        <div className='positions-drawer-open'>
            {is_phone_landscape && (
                <div className='positions-drawer-tabs__summary'>
                    <PositionsDrawerFooter />
                </div>
            )}
            <ContractCardList
                currency={currency}
                onClickCancel={onClickCancel}
                onClickSell={onClickSell}
                positions={active_positions}
                serverTime={server_time}
            />
        </div>
    );
});

/**
 * PositionsDrawerFooter - Footer component showing positions summary
 */
export const PositionsDrawerFooter = observer(() => {
    const { client, portfolio, ui } = useStore();
    const { currency } = client;
    const { active_positions } = portfolio;
    const { is_switching_account } = ui;
    const is_phone_landscape = useIsPhoneLandscape();

    const getTotalProfit = (positions: TPortfolioPosition[]) =>
        positions.reduce((total: number, position: TPortfolioPosition) => {
            const profitValue = Number(position.profit_loss) || 0;
            return total + profitValue;
        }, 0);

    if (active_positions.length === 0 || is_switching_account) return null;

    return (
        <div className='positions-drawer-footer--summary'>
            <Text size='xxs' className='positions-drawer-footer--count'>
                {active_positions.length}{' '}
                {`${active_positions.length === 1 ? localize('open position') : localize('open positions')}`}
            </Text>
            <div className='positions-drawer-footer--total'>
                {/* Landscape's summary sits above the list (Figma): a quiet label, as the amount carries it. */}
                {is_phone_landscape ? (
                    <Text size='xs' color='less-prominent'>
                        <Localize i18n_default_text='Current P/L' />
                    </Text>
                ) : (
                    <Text size='xs' weight='bold'>
                        <Localize i18n_default_text='Total P/L:' />
                    </Text>
                )}
                <Text size='xs' weight='bold' color={getTotalProfit(active_positions) > 0 ? 'success' : 'danger'}>
                    <React.Fragment>
                        <Money amount={getTotalProfit(active_positions)} currency={currency} has_sign /> {currency}
                    </React.Fragment>
                </Text>
            </div>
        </div>
    );
});

export default PositionsDrawerContent;
