import React from 'react';
import classNames from 'classnames';

import { useIsRtl } from '@deriv/api';
import { Loading } from '@deriv/components';
import {
    hasContractEntered,
    isAccumulatorContract,
    isMultiplierContract,
    isOpen,
    isValidToCancel,
    isValidToSell,
    TContractStore,
    trackAnalyticsEvent,
    WS,
} from '@deriv/shared';
import { observer, useStore } from '@deriv/stores';

import CardWrapper from 'AppV2/Components/CardWrapper';
import { ContractCard } from 'AppV2/Components/ContractCard';
import ContractDetailsFooter from 'AppV2/Components/ContractDetailsFooter';
import ContractDetailsHeader from 'AppV2/Components/ContractDetailsHeader';
import DealCancellation from 'AppV2/Components/DealCancellation/deal-cancellation';
import EntryExitDetails from 'AppV2/Components/EntryExitDetails';
import OrderDetails from 'AppV2/Components/OrderDetails';
import PayoutInfo from 'AppV2/Components/PayoutInfo';
import StopLoss from 'AppV2/Components/StopLoss/stop-loss';
import TakeProfit from 'AppV2/Components/TakeProfit/take-profit';
import TakeProfitHistory from 'AppV2/Components/TakeProfitHistory';
import useContractDetails from 'AppV2/Hooks/useContractDetails';
import useIsPhoneLandscape from 'AppV2/Hooks/useIsPhoneLandscape';
import { getContractDetailsConfig } from 'AppV2/Utils/contract-details-config';

import ContractDetailsChart from '../Chart/contract-details-chart';

const ContractDetails = observer(() => {
    const { contract_info, is_loading } = useContractDetails();
    const is_phone_landscape = useIsPhoneLandscape();
    const is_rtl = useIsRtl();
    const { contract_id, currency, contract_type, limit_order } = contract_info;
    const { take_profit, stop_loss } = limit_order ?? { take_profit: {}, stop_loss: {} };
    const [update_history, setUpdateHistory] = React.useState<TContractUpdateHistory>([]);
    const { common } = useStore();
    const { server_time } = common;
    const { isTakeProfitVisible, isStopLossVisible } = getContractDetailsConfig(contract_type ?? '');
    const canSell = isValidToSell(contract_info);
    type TContractUpdateHistory = TContractStore['contract_update_history'];
    type TResponse = {
        contract_update_history: TContractUpdateHistory;
    };

    const getSortedUpdateHistory = (history: TContractUpdateHistory) =>
        history?.sort((a, b) => Number(b?.order_date) - Number(a?.order_date));
    const requestUpdatedHistory = React.useCallback((id?: number) => {
        if (!id) return;
        WS.contractUpdateHistory(id)
            .then((response: TResponse) => {
                setUpdateHistory(getSortedUpdateHistory(response.contract_update_history));
            })
            .catch(() => null);
    }, []);

    React.useEffect(() => {
        requestUpdatedHistory(contract_id);
    }, [contract_id, take_profit?.order_amount, stop_loss?.order_amount, requestUpdatedHistory]);

    React.useEffect(() => {
        trackAnalyticsEvent('ce_reports_form_v2', {
            action: 'open_contract_details',
            platform: 'DTrader',
        });
    }, []);

    if (is_loading) return <Loading.DTraderV2 is_contract_details />;

    const isMultiplier = isMultiplierContract(contract_info.contract_type);

    const canCancel = isValidToCancel(contract_info);
    const shouldShowSell = hasContractEntered(contract_info) && isOpen(contract_info);
    const { isTpHistoryVisible, isDealCancellationVisible } = getContractDetailsConfig(
        contract_info.contract_type ?? ''
    );
    const showCancelButton = isMultiplier && canCancel;
    let showRiskManagement =
        isOpen(contract_info) && (isTakeProfitVisible || isStopLossVisible) && (canSell || isDealCancellationVisible);

    if (isAccumulatorContract(contract_info.contract_type)) {
        showRiskManagement = isOpen(contract_info) && Boolean(limit_order);
    }
    const contract_and_chart = (
        <React.Fragment>
            <ContractCard contractInfo={contract_info} serverTime={server_time} currency={currency} />
            <ContractDetailsChart />
        </React.Fragment>
    );

    const details = (
        <React.Fragment>
            <DealCancellation />
            {showRiskManagement && (
                <CardWrapper>
                    <TakeProfit />
                    <StopLoss />
                </CardWrapper>
            )}
            <OrderDetails contract_info={contract_info} />
            {/* Hidden as we disable longcode temporarily */}
            {/* TODO: enable or delete when decision is made */}
            {/* <PayoutInfo contract_info={contract_info} /> */}
            <EntryExitDetails contract_info={contract_info} />
            {isTpHistoryVisible && update_history && update_history.length > 0 && (
                <TakeProfitHistory history={update_history} currency={currency} is_multiplier={isMultiplier} />
            )}
        </React.Fragment>
    );

    const footer = shouldShowSell && <ContractDetailsFooter contract_info={contract_info} />;

    // Two columns in landscape (contract + chart | the detail cards), the page itself scrolling.
    // Portrait keeps the single column, in the same DOM order as before.
    if (is_phone_landscape) {
        return (
            // Arabic landscape keeps the app left-to-right (see AppContent); this page reads right-to-left,
            // as in portrait.
            <div
                className='contract-details-landscape'
                dir={is_rtl ? 'rtl' : undefined}
                data-testid='dt_contract_details_landscape'
            >
                <ContractDetailsHeader />
                <div className='contract-details contract-details--landscape'>
                    <div className='contract-details__pane' data-testid='dt_contract_details_pane'>
                        {contract_and_chart}
                    </div>
                    <div
                        className='contract-details__pane contract-details__pane--details'
                        data-testid='dt_contract_details_pane'
                    >
                        {details}
                        {footer}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <ContractDetailsHeader />
            <div
                className={classNames('contract-details', {
                    'contract-details--two-buttons': shouldShowSell && showCancelButton,
                    'contract-details--one-button': shouldShowSell && !showCancelButton,
                })}
            >
                {contract_and_chart}
                {details}
            </div>
            {footer}
        </>
    );
});

export default ContractDetails;
