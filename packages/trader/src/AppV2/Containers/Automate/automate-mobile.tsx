import React from 'react';
import { observer } from 'mobx-react-lite';

import { Loading } from '@deriv/components';
import { StandalonePauseFillIcon, StandalonePlayFillIcon, StandaloneSquareFillIcon } from '@deriv/quill-icons';
import { trackAutomationSectionViewed, trackTradeTypeSwitched } from '@deriv/shared';
import { useStore } from '@deriv/stores';
import { Button, Text } from '@deriv-com/quill-ui';
import { Localize, useTranslations } from '@deriv-com/translations';

import { KNOWN_PARAM_KEYS } from 'AppV2/Components/AutomationPanel/automation-config';
import AutomationErrorBanner from 'AppV2/Components/AutomationPanel/automation-error-banner';
import AutomationStatusInfo from 'AppV2/Components/AutomationPanel/automation-status-info';
import AutomationGuide from 'AppV2/Components/AutomationPanel/AutomationGuide';
import MaxTradeStake from 'AppV2/Components/AutomationPanel/MaxTradeStake/max-trade-stake';
import StakeMultiplier from 'AppV2/Components/AutomationPanel/StakeMultiplier/stake-multiplier';
import StrategySelector from 'AppV2/Components/AutomationPanel/StrategySelector';
import ThresholdInput from 'AppV2/Components/AutomationPanel/ThresholdInput/threshold-input';
import CurrentSpot from 'AppV2/Components/CurrentSpot';
import MarketTabs, { MarketTabsSkeleton } from 'AppV2/Components/MarketTabs';
import ServiceErrorSheet from 'AppV2/Components/ServiceErrorSheet';
import TradeErrorSnackbar from 'AppV2/Components/TradeErrorSnackbar';
import { TradeParameters } from 'AppV2/Components/TradeParameters';
import useActiveSymbols from 'AppV2/Hooks/useActiveSymbols';
import useAutomationConfig from 'AppV2/Hooks/useAutomationConfig';
import useAutomationSupportedTradeTypes from 'AppV2/Hooks/useAutomationSupportedTradeTypes';
import useAutomationTicks from 'AppV2/Hooks/useAutomationTicks';
import useContractsFor from 'AppV2/Hooks/useContractsFor';
import useNonAutomatableSymbolSnackbar from 'AppV2/Hooks/useNonAutomatableSymbolSnackbar';
import useRunControls from 'AppV2/Hooks/useRunControls';
import { formatSignedAmountWithSymbol } from 'AppV2/Utils/currency-utils';
import { isDigitTradeType } from 'AppV2/Utils/digits';
import { getTradeTypeTabsList } from 'AppV2/Utils/trade-params-utils';
import { useAutomationStore } from 'Stores/useAutomationStore';
import { useTraderStore } from 'Stores/useTraderStores';

import 'AppV2/Components/AutomationPanel/automation-actions.scss';
import 'AppV2/Components/AutomationPanel/automation-panel.scss';
import 'AppV2/Components/TradeParameters/trade-parameters.scss';
import './automate-mobile.scss';

const AutomateMobile = observer(() => {
    const {
        common: { current_language, network_status },
        ui: { setIsChartLoading },
    } = useStore();
    const trade_store = useTraderStore();
    const {
        amount,
        contract_type,
        currency,
        is_automation_params_locked,
        is_market_closed,
        onMount,
        onUnmount,
        trade_type_tab,
    } = trade_store;
    const automation_store = useAutomationStore();
    const { config, run_status, is_running, is_paused } = automation_store;
    const { trade_types } = useContractsFor();
    const { supported_trade_types: supported_automation_trade_types, is_loading: are_strategies_loading } =
        useAutomationSupportedTradeTypes();
    const { localize } = useTranslations();
    // Drives the active_symbols fetch into the store (multiplier-only markets excluded on this
    // route); selection itself is owned by the trade store's resolveInitialMarket.
    useActiveSymbols();
    useNonAutomatableSymbolSnackbar();
    useAutomationTicks();

    const {
        strategy_options,
        strategy_description,
        schema_keys,
        getSchemaDescription,
        getParamBounds,
        getParamNumber,
        getParamNumberOrNull,
        setParamFromNumber,
        setParamFromNumberOrNull,
        selectStrategy,
    } = useAutomationConfig();

    const {
        handleRunClick,
        handleStopClick,
        handlePauseClick,
        handleResumeClick,
        isStarting,
        is_busy,
        is_run_disabled,
    } = useRunControls();

    const display_currency = currency || 'USD';
    const tab_index = getTradeTypeTabsList(contract_type).findIndex(tab => tab.contract_type === trade_type_tab);
    const run_button_color = tab_index > 0 ? 'sell' : 'purchase';

    React.useEffect(() => {
        onMount();
        setIsChartLoading(false);
        return onUnmount;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [current_language, network_status.class]);

    // Mark the automation view so shared trade params lock during a run here —
    // and only here, never in manual trading (desktop uses `is_automation_tab`).
    React.useEffect(() => {
        trade_store.setIsAutomationPage(true);
        return () => trade_store.setIsAutomationPage(false);
    }, [trade_store]);

    // Mobile reaches the automation section by opening this screen, so mount is
    // the "section viewed" moment.
    React.useEffect(() => {
        trackAutomationSectionViewed({ trade_type: contract_type, platform: 'mobile' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fire when the trade type changes while the automation screen is open.
    const prev_contract_type = React.useRef(contract_type);
    React.useEffect(() => {
        if (prev_contract_type.current !== contract_type) {
            trackTradeTypeSwitched({
                from_trade_type: prev_contract_type.current,
                to_trade_type: contract_type,
                platform: 'mobile',
            });
            prev_contract_type.current = contract_type;
        }
    }, [contract_type]);

    if (!trade_types.length) {
        return <Loading.DTraderV2 />;
    }

    return (
        <div className='automate-mobile'>
            <AutomationErrorBanner />
            <div className='automate-mobile__main'>
                <AutomationGuide />
                <div className='automate-mobile__content'>
                    {are_strategies_loading ? (
                        <MarketTabsSkeleton />
                    ) : (
                        <MarketTabs supported_trade_types={supported_automation_trade_types} />
                    )}

                    {/* Live spot + last digit for digit trade types (no chart here). */}
                    {isDigitTradeType(contract_type) && <CurrentSpot />}

                    {/* Trade Configuration */}
                    <div className='automate-mobile__trade-config'>
                        <TradeParameters is_automation />
                    </div>

                    {/* Strategy parameters */}
                    <div className='automate-mobile__automation-config'>
                        <Text size='sm' bold className='automate-mobile__section-header'>
                            <Localize i18n_default_text='Strategy parameters' />
                        </Text>
                        <StrategySelector
                            options={strategy_options}
                            selectedValue={config.strategy}
                            description={strategy_description}
                            disabled={is_automation_params_locked}
                            is_market_closed={is_market_closed}
                            onSelect={selectStrategy}
                        />

                        {schema_keys.has(KNOWN_PARAM_KEYS.MULTIPLIER) && (
                            <StakeMultiplier
                                param_key={KNOWN_PARAM_KEYS.MULTIPLIER}
                                bounds={getParamBounds(KNOWN_PARAM_KEYS.MULTIPLIER)}
                                selectedValue={getParamNumber(KNOWN_PARAM_KEYS.MULTIPLIER)}
                                description={getSchemaDescription(KNOWN_PARAM_KEYS.MULTIPLIER)}
                                disabled={is_automation_params_locked}
                                is_market_closed={is_market_closed}
                                onSelect={value => setParamFromNumber(KNOWN_PARAM_KEYS.MULTIPLIER, value)}
                            />
                        )}

                        {schema_keys.has(KNOWN_PARAM_KEYS.UNIT) && (
                            <StakeMultiplier
                                param_key={KNOWN_PARAM_KEYS.UNIT}
                                bounds={getParamBounds(KNOWN_PARAM_KEYS.UNIT)}
                                selectedValue={getParamNumber(KNOWN_PARAM_KEYS.UNIT)}
                                description={getSchemaDescription(KNOWN_PARAM_KEYS.UNIT)}
                                disabled={is_automation_params_locked}
                                is_market_closed={is_market_closed}
                                onSelect={value => setParamFromNumber(KNOWN_PARAM_KEYS.UNIT, value)}
                            />
                        )}

                        {schema_keys.has(KNOWN_PARAM_KEYS.MAX_STAKE) && (
                            <MaxTradeStake
                                currency={display_currency}
                                initialValue={getParamNumberOrNull(KNOWN_PARAM_KEYS.MAX_STAKE)}
                                initialStake={Number(amount) || undefined}
                                description={getSchemaDescription(KNOWN_PARAM_KEYS.MAX_STAKE)}
                                disabled={is_automation_params_locked}
                                is_market_closed={is_market_closed}
                                onSave={value => setParamFromNumberOrNull(KNOWN_PARAM_KEYS.MAX_STAKE, value)}
                            />
                        )}
                    </div>

                    <div className='automate-mobile__automation-config'>
                        <Text size='sm' bold className='automate-mobile__section-header'>
                            <Localize i18n_default_text='Risk management' />
                        </Text>

                        {schema_keys.has(KNOWN_PARAM_KEYS.TAKE_PROFIT) && (
                            <ThresholdInput
                                threshold_type='take_profit'
                                description={getSchemaDescription(KNOWN_PARAM_KEYS.TAKE_PROFIT)}
                                currency={display_currency}
                                initialValue={getParamNumber(KNOWN_PARAM_KEYS.TAKE_PROFIT)}
                                disabled={is_automation_params_locked}
                                is_market_closed={is_market_closed}
                                onSave={value => setParamFromNumber(KNOWN_PARAM_KEYS.TAKE_PROFIT, value)}
                            />
                        )}

                        {schema_keys.has(KNOWN_PARAM_KEYS.STOP_LOSS) && (
                            <ThresholdInput
                                threshold_type='stop_loss'
                                description={getSchemaDescription(KNOWN_PARAM_KEYS.STOP_LOSS)}
                                currency={display_currency}
                                initialValue={getParamNumber(KNOWN_PARAM_KEYS.STOP_LOSS)}
                                disabled={is_automation_params_locked}
                                is_market_closed={is_market_closed}
                                onSave={value => setParamFromNumber(KNOWN_PARAM_KEYS.STOP_LOSS, value)}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Sticky bottom buttons — hidden when market is closed (matches manual). */}
            {!is_market_closed && (
                <div className='automate-mobile__run-button'>
                    {(is_running || is_paused) && (
                        <div className='automation-actions__status'>
                            <div className='automation-actions__status-line'>
                                <Text size='sm' bold>
                                    <Localize
                                        i18n_default_text='Status: {{status}}'
                                        values={{ status: is_paused ? localize('Paused') : localize('Running') }}
                                    />
                                </Text>
                                <AutomationStatusInfo />
                            </div>
                            <Text size='sm'>
                                <Localize
                                    i18n_default_text='Contracts: {{count}} | P/L: {{profit}}'
                                    values={{
                                        count: automation_store.contracts_count,
                                        profit: formatSignedAmountWithSymbol(
                                            display_currency,
                                            automation_store.net_profit
                                        ),
                                    }}
                                />
                            </Text>
                        </div>
                    )}
                    {is_running || is_paused || run_status === 'stopping' ? (
                        <div className='automation-actions__run-actions'>
                            <Button
                                color='black-white'
                                size='lg'
                                fullWidth
                                variant='secondary'
                                label={is_paused ? localize('Resume') : localize('Pause')}
                                onClick={is_paused ? handleResumeClick : handlePauseClick}
                                disabled={is_busy}
                                icon={
                                    is_paused ? (
                                        <StandalonePlayFillIcon iconSize='sm' fill='currentColor' />
                                    ) : (
                                        <StandalonePauseFillIcon iconSize='sm' fill='currentColor' />
                                    )
                                }
                            />
                            <Button
                                size='lg'
                                fullWidth
                                label={localize('Stop')}
                                onClick={handleStopClick}
                                disabled={run_status === 'stopping' || is_busy}
                                icon={<StandaloneSquareFillIcon iconSize='sm' fill='currentColor' />}
                                className='automation-actions__run-stop'
                            />
                        </div>
                    ) : (
                        <Button
                            color={run_button_color}
                            size='lg'
                            fullWidth
                            label={isStarting || run_status === 'starting' ? localize('Starting...') : localize('Run')}
                            onClick={handleRunClick}
                            disabled={is_run_disabled}
                            icon={<StandalonePlayFillIcon iconSize='sm' fill='currentColor' />}
                            className='automate-mobile__run-button-inner'
                        />
                    )}
                </div>
            )}
            <ServiceErrorSheet />
            <TradeErrorSnackbar error_fields={['stake', 'amount']} should_show_snackbar />
        </div>
    );
});

export default AutomateMobile;
