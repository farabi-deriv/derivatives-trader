import React, { useCallback, useEffect, useRef } from 'react';

import { useMobileBridge, useQuery } from '@deriv/api';
import { cloneObject, getContractCategoriesConfig, getContractTypesConfig } from '@deriv/shared';
import { useStore } from '@deriv/stores';

import { TContractType } from 'AppV2/Types/contract-type';
import { getTradeTypesList } from 'AppV2/Utils/trade-types-utils';
import { ContractType } from 'Stores/Modules/Trading/Helpers/contract-type';
import { useTraderStore } from 'Stores/useTraderStores';
import { TConfig, TContractTypesList } from 'Types';

import useNativeAppAllowedTradeTypes from './useNativeAppAllowedTradeTypes';

const useContractsFor = () => {
    const [contract_types_list, setContractTypesList] = React.useState<TContractTypesList | []>([]);

    const [trade_types, setTradeTypes] = React.useState<TContractType[]>([]);
    const {
        contract_type,
        processContractsForV2,
        resolveContractTypeAvailability,
        setContractTypesListV2,
        setDefaultStake,
        setPayoutChoices,
        setIsAwaitingContractsFor,
        symbol,
        active_symbols,
    } = useTraderStore();
    const { client } = useStore();
    const { loginid } = client;
    const { isMobileApp } = useMobileBridge();
    const nativeAppAllowedTradeTypes = useNativeAppAllowedTradeTypes();

    // Helper function to get underlying_symbol from active_symbols
    const getUnderlyingSymbol = useCallback(
        (current_symbol: string) => {
            if (!current_symbol || !active_symbols?.length) return current_symbol;

            // Find symbol object where either symbol or underlying_symbol matches current_symbol
            const symbolInfo = active_symbols.find(symbol_info => {
                const underlying = (symbol_info as { underlying_symbol?: string }).underlying_symbol;
                const symbol = (symbol_info as { symbol?: string }).symbol;
                return underlying === current_symbol || symbol === current_symbol;
            });

            // Return underlying_symbol if found, otherwise fallback to current_symbol
            return symbolInfo
                ? (symbolInfo as { underlying_symbol?: string }).underlying_symbol || current_symbol
                : current_symbol;
        },
        [active_symbols]
    );

    const isQueryEnabled = useCallback(() => {
        // Always validate symbol presence first - prevents API calls with undefined symbol
        if (!symbol) return false;
        // Removed switching logic for single account model
        return true;
    }, [symbol]);

    // Get the underlying_symbol for the API call
    const underlying_symbol = getUnderlyingSymbol(symbol);

    const {
        data: response,
        error,
        isLoading,
    } = useQuery('contracts_for', {
        payload: {
            contracts_for: underlying_symbol, // Use underlying_symbol from active_symbols lookup
        },
        options: {
            enabled: isQueryEnabled(),
            staleTime: 60 * 1000,
        },
    });

    const contract_categories = getContractCategoriesConfig();
    const available_categories = cloneObject(contract_categories);
    const contract_types = getContractTypesConfig();
    const [available_contract_types, setAvailableContractTypes] = React.useState<
        ReturnType<typeof getContractTypesConfig> | undefined
    >();

    const is_fetching_ref = useRef(isLoading);

    const getTradeTypes = useCallback(
        (categories: TContractTypesList) => {
            return Array.isArray(categories) && categories.length === 0
                ? []
                : getTradeTypesList(categories as TContractTypesList, nativeAppAllowedTradeTypes);
        },
        [nativeAppAllowedTradeTypes]
    );

    useEffect(() => {
        setAvailableContractTypes(undefined);
        setContractTypesList([]);
        is_fetching_ref.current = true;
    }, [loginid]);

    useEffect(() => {
        // Skip processing stale response data during loading
        if (isLoading) {
            return;
        }
        // Wait for native app allowed trade types to be ready before processing
        // to prevent showing unfiltered trade types during bridge initialization
        if (isMobileApp && nativeAppAllowedTradeTypes === undefined) {
            return;
        }

        try {
            const { contracts_for } = response || {};
            const available_contract_types: ReturnType<typeof getContractTypesConfig> = {};
            is_fetching_ref.current = isLoading;

            if (!error && contracts_for?.available.length) {
                contracts_for.available.forEach(contract => {
                    // Enhanced contract type matching logic from legacy implementation
                    const type = Object.keys(contract_types).find(key => {
                        const isContractTypeMatch =
                            contract_types[key].trade_types.indexOf(contract.contract_type) !== -1;

                        // Handle the new API structure where Rise/Fall and Higher/Lower are distinguished by contract_category
                        if (contract.contract_category) {
                            // For Rise/Fall contracts with contract_category "callput"
                            if (contract.contract_category === 'callput' && key === 'rise_fall') {
                                return isContractTypeMatch;
                            }
                            // For Higher/Lower contracts with contract_category "higherlower"
                            if (contract.contract_category === 'higherlower' && key === 'high_low') {
                                return isContractTypeMatch;
                            }
                            // For other contract categories, use existing logic
                            return isContractTypeMatch;
                        }

                        // Fallback to original logic for backward compatibility
                        return (
                            isContractTypeMatch &&
                            (contract.contract_type !== 'PUT' || contract_types[key].barrier_count === 1)
                        );
                    });

                    if (!type) {
                        return; // ignore unsupported contract types
                    }

                    if (!available_contract_types[type]) {
                        // extend contract_categories to include what is needed to create the contract list
                        const category =
                            Object.keys(available_categories).find(
                                key => available_categories[key].categories.indexOf(type) !== -1
                            ) ?? '';

                        const sub_cats = available_categories[category]?.categories;

                        if (!sub_cats) {
                            return;
                        }

                        sub_cats[(sub_cats as string[]).indexOf(type)] = {
                            value: type,
                            text: contract_types[type].title,
                        };

                        available_contract_types[type] = cloneObject(contract_types[type]);
                    }
                    const config: TConfig = available_contract_types[type].config || {};
                    config.default_stake = contract.default_stake;
                    // A later per-expiry row without choices must not wipe an earlier row's.
                    if (contract.payout_choices?.length) config.payout_choices = contract.payout_choices;
                    if (type === contract_type) {
                        setDefaultStake(contract.default_stake);
                        // Turbos: without these choices the first proposal goes out with no
                        // payout_per_point, and that rejection carries nothing recoverable.
                        if (contract.payout_choices?.length) {
                            setPayoutChoices(contract.payout_choices.map(choice => String(choice)));
                        }
                    }
                    available_contract_types[type].config = config;
                });

                setContractTypesListV2(available_categories);
                setContractTypesList(available_categories);
                setAvailableContractTypes(available_contract_types);

                // Populate the ContractType closure with the React Query response data.
                // This ensures ContractType.getContractValues() returns barrier/duration config
                // without making a duplicate WS.contractsFor call.
                ContractType.processContractsForResponse(
                    { contracts_for } as Required<typeof response>,
                    underlying_symbol
                );

                const trade_types = getTradeTypes(available_categories);
                setTradeTypes(trade_types);

                // Report availability to the store; the store owns the "current type isn't offered"
                // policy (evaluated against its live state, deferred while a selection is committing,
                // and correcting the tab strip in place). This hook never changes the trade type
                // itself — the old in-hook swap ran on stale render closures and could override a
                // user's mid-cascade selection, spawning phantom tabs on the strip.
                resolveContractTypeAvailability(
                    symbol,
                    trade_types.map(type => type.value)
                );

                // Call processContractsForV2 AFTER resolveContractTypeAvailability ensures the
                // correct contract_type is set in the store (a synchronous fallback swap has been
                // applied by now). On page refresh, the contract_type may be empty or stale before
                // the resolution runs. getContractValues(this) needs the correct contract_type to
                // return barrier/duration config from the populated ContractType closure.
                // processContractsForV2 awaits its calls sequentially and triggers
                // debouncedProposal internally after all values are applied.
                processContractsForV2();
            } else {
                setTradeTypes([]);
                // A settled response with no available contracts never reaches
                // processContractsForV2 — release the hold so the panel isn't frozen.
                setIsAwaitingContractsFor(false);
            }
        } catch (err) {
            /* eslint-disable no-console */
            console.error(err);
            // Release the proposal hold so failures surface as server errors, not a dead page.
            setIsAwaitingContractsFor(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [response, isLoading, isMobileApp, nativeAppAllowedTradeTypes]);

    // Same degradation when the contracts_for request itself fails — otherwise the
    // proposal hold is never released for this symbol.
    useEffect(() => {
        if (error) setIsAwaitingContractsFor(false);
    }, [error, setIsAwaitingContractsFor]);

    const resetTradeTypes = () => {
        setTradeTypes([]);
    };

    // contracts_for is per symbol, so a trade-type switch within a symbol reuses the cached
    // response and the effect above does not re-run — re-push the active type's stake config here,
    // or a switch into Turbos sends its first proposal without a payout_per_point (unrecoverable).
    useEffect(() => {
        const config: TConfig | undefined = contract_type
            ? available_contract_types?.[contract_type]?.config
            : undefined;
        if (!config) return;
        // A type without its own default keeps the store's current one.
        if (config.default_stake !== undefined) setDefaultStake(config.default_stake);
        if (config.payout_choices?.length) setPayoutChoices(config.payout_choices.map(choice => String(choice)));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [available_contract_types, contract_type]);

    return { trade_types, contract_types_list, available_contract_types, is_fetching_ref, resetTradeTypes };
};

export default useContractsFor;
