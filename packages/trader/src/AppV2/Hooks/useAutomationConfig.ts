import React from 'react';

import { getAutomationPlatform, trackStrategyParameterChanged, trackStrategySelected } from '@deriv/shared';
import { useTranslations } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';

import {
    DEFAULT_MULTIPLIER_BOUNDS,
    getParamDescription,
    getStrategyDescription,
    getStrategyOrderIndex,
    KNOWN_PARAM_KEYS,
    TStakeMultiplierBounds,
    TStrategyOption,
} from 'AppV2/Components/AutomationPanel/automation-config';
import { useAutomationStore } from 'Stores/useAutomationStore';
import { useTraderStore } from 'Stores/useTraderStores';

import useAutoStrategies from './useAutoStrategies';

/**
 * Shared hook for automation configuration logic used by both
 * desktop (AutomationPanel) and mobile (AutomateMobile) views.
 */
const useAutomationConfig = () => {
    const automation_store = useAutomationStore();
    const { config } = automation_store;
    const { contract_type } = useTraderStore();
    const { isMobile } = useDevice();
    const { strategies: server_strategies } = useAutoStrategies();
    // Subscribe to the active language so consumers re-render on a language
    // switch — our `localize()`-derived descriptions are plain strings and won't
    // refresh otherwise (they'd be stale until a page reload).
    const { currentLang } = useTranslations();

    const strategy_options: TStrategyOption[] = React.useMemo(
        () =>
            // Sort to a stable preferred order (Martingale first); BE order isn't reliable.
            [...server_strategies]
                .sort((a, b) => getStrategyOrderIndex(a.strategy_id) - getStrategyOrderIndex(b.strategy_id))
                .map(s => ({
                    value: s.strategy_id,
                    label: s.display_name,
                    // Prefer our localized copy; fall back to the (English-only) BE text.
                    description: getStrategyDescription(s.strategy_id) ?? s.description,
                })),
        // `currentLang` isn't read in the body but recomputes the localized
        // descriptions when the language switches.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [server_strategies, currentLang]
    );

    const selected_strategy = React.useMemo(
        () => server_strategies.find(s => s.strategy_id === config.strategy),
        [server_strategies, config.strategy]
    );

    const strategy_description = getStrategyDescription(config.strategy) ?? selected_strategy?.description;

    const schema_keys = React.useMemo(() => {
        if (selected_strategy) {
            return new Set(Object.keys(selected_strategy.parameters.properties ?? {}));
        }
        // Fallback to default param keys when server strategies haven't loaded yet
        return new Set(Object.values(KNOWN_PARAM_KEYS) as string[]);
    }, [selected_strategy]);

    /** Reads per-parameter bounds from the schema; falls back per end to defaults. */
    // `selected_strategy` isn't read in the factory — it's the cache-invalidation key,
    // so the Map resets whenever the strategy changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const bounds_cache = React.useMemo(() => new Map<string, TStakeMultiplierBounds>(), [selected_strategy]);

    const getParamBounds = React.useCallback(
        (key: string): TStakeMultiplierBounds => {
            // Cached per key for stable identity (avoids invalidating consumers' useMemo).
            const cached = bounds_cache.get(key);
            if (cached) return cached;

            const property = selected_strategy?.parameters.properties?.[key];
            const toNum = (v: unknown) => (typeof v === 'number' ? v : undefined);
            const exclusive_min = toNum(property?.exclusiveMinimum);
            const inclusive_min = toNum(property?.minimum);
            const has_min = exclusive_min !== undefined || inclusive_min !== undefined;

            const bounds: TStakeMultiplierBounds = {
                min: exclusive_min ?? inclusive_min ?? DEFAULT_MULTIPLIER_BOUNDS.min,
                max: toNum(property?.maximum) ?? DEFAULT_MULTIPLIER_BOUNDS.max,
                is_min_exclusive: has_min ? exclusive_min !== undefined : DEFAULT_MULTIPLIER_BOUNDS.is_min_exclusive,
            };
            bounds_cache.set(key, bounds);
            return bounds;
        },
        [selected_strategy, bounds_cache]
    );

    // Prefer our own localized copy; fall back to the (English-only) BE schema
    // description for any param we don't map. The bounds keep the copy in step with
    // what `getParamBounds` actually enforces.
    const getSchemaDescription = (key: string) =>
        getParamDescription(config.strategy, key, getParamBounds(key)) ??
        selected_strategy?.parameters.properties[key]?.description;

    const getParamNumber = (key: string): number => Number(config.strategy_params[key]) || 0;

    const getParamNumberOrNull = (key: string): number | null => {
        const val = config.strategy_params[key];
        return val ? Number(val) : null;
    };

    const trackParamChanged = (key: string, value: number | null) =>
        trackStrategyParameterChanged({
            parameter_name: key,
            new_value: value,
            trade_type: contract_type,
            strategy_name: config.strategy,
            platform: getAutomationPlatform(isMobile),
        });

    const setParamFromNumber = (key: string, value: number) => {
        automation_store.setStrategyParam(key, String(value));
        trackParamChanged(key, value);
    };

    const setParamFromNumberOrNull = (key: string, value: number | null) => {
        automation_store.setStrategyParam(key, value !== null ? String(value) : '');
        trackParamChanged(key, value);
    };

    /** Commit a strategy selection and fire the `strategy_selected` event. */
    const selectStrategy = (value: string) => {
        automation_store.setConfig('strategy', value);
        trackStrategySelected({
            strategy_name: value,
            trade_type: contract_type,
            platform: getAutomationPlatform(isMobile),
        });
    };

    return {
        strategy_options,
        selected_strategy,
        strategy_description,
        schema_keys,
        getSchemaDescription,
        getParamBounds,
        getParamNumber,
        getParamNumberOrNull,
        setParamFromNumber,
        setParamFromNumberOrNull,
        selectStrategy,
    };
};

export default useAutomationConfig;
