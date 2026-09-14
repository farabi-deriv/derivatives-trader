import React from 'react';
import { observer } from 'mobx-react-lite';

import { trackAutomationSectionViewed, trackTradeTypeSwitched } from '@deriv/shared';
import { Text } from '@deriv-com/quill-ui';
import { Localize } from '@deriv-com/translations';

import useAutomationConfig from 'AppV2/Hooks/useAutomationConfig';
import { useAutomationStore } from 'Stores/useAutomationStore';
import { useTraderStore } from 'Stores/useTraderStores';

import MaxTradeStake from './MaxTradeStake/max-trade-stake';
import StakeMultiplier from './StakeMultiplier/stake-multiplier';
import ThresholdInput from './ThresholdInput/threshold-input';
import { KNOWN_PARAM_KEYS } from './automation-config';
import StrategySelector from './StrategySelector';

import './automation-panel.scss';

/**
 * Renders the strategy + risk-management configuration for automation.
 * Status display + Run/Pause/Stop controls live in `AutomationActions` so
 * they can be rendered in the non-scrollable bottom strip of `.trade-params`.
 */
const AutomationPanel = observer(() => {
    const trade_store = useTraderStore();
    const { amount, contract_type, currency, is_automation_params_locked } = trade_store;
    const automation_store = useAutomationStore();
    const { config } = automation_store;

    // Desktop reaches the automation section when this panel mounts (the
    // "Automated trading" tab is selected), so mount is the "section viewed"
    // moment.
    React.useEffect(() => {
        trackAutomationSectionViewed({ trade_type: contract_type, platform: 'web' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fire when the trade type changes while the automation panel is visible.
    const prev_contract_type = React.useRef(contract_type);
    React.useEffect(() => {
        if (prev_contract_type.current !== contract_type) {
            trackTradeTypeSwitched({
                from_trade_type: prev_contract_type.current,
                to_trade_type: contract_type,
                platform: 'web',
            });
            prev_contract_type.current = contract_type;
        }
    }, [contract_type]);

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

    const display_currency = currency || 'USD';

    return (
        <div className='automation-panel'>
            <div className='automation-panel__section'>
                <Text size='sm' bold className='automation-panel__header'>
                    <Localize i18n_default_text='Strategy parameters' />
                </Text>

                <div className='automation-panel__fields'>
                    <StrategySelector
                        options={strategy_options}
                        selectedValue={config.strategy}
                        description={strategy_description}
                        disabled={is_automation_params_locked}
                        onSelect={selectStrategy}
                    />

                    {schema_keys.has(KNOWN_PARAM_KEYS.MULTIPLIER) && (
                        <StakeMultiplier
                            param_key={KNOWN_PARAM_KEYS.MULTIPLIER}
                            bounds={getParamBounds(KNOWN_PARAM_KEYS.MULTIPLIER)}
                            selectedValue={getParamNumber(KNOWN_PARAM_KEYS.MULTIPLIER)}
                            description={getSchemaDescription(KNOWN_PARAM_KEYS.MULTIPLIER)}
                            disabled={is_automation_params_locked}
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
                            onSave={value => setParamFromNumberOrNull(KNOWN_PARAM_KEYS.MAX_STAKE, value)}
                        />
                    )}
                </div>
            </div>

            <div className='automation-panel__section'>
                <Text size='sm' bold className='automation-panel__header'>
                    <Localize i18n_default_text='Risk management' />
                </Text>

                <div className='automation-panel__fields'>
                    {schema_keys.has(KNOWN_PARAM_KEYS.TAKE_PROFIT) && (
                        <ThresholdInput
                            threshold_type='take_profit'
                            description={getSchemaDescription(KNOWN_PARAM_KEYS.TAKE_PROFIT)}
                            currency={display_currency}
                            initialValue={getParamNumber(KNOWN_PARAM_KEYS.TAKE_PROFIT)}
                            disabled={is_automation_params_locked}
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
                            onSave={value => setParamFromNumber(KNOWN_PARAM_KEYS.STOP_LOSS, value)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
});

export default AutomationPanel;
