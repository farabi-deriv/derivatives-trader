import { useMemo } from 'react';

import { getAvailableContracts, getOrderedAvailableContracts } from 'AppV2/Utils/trade-types-utils';

import useTradeTypeAvailability from './useTradeTypeAvailability';

/**
 * The trade types to offer this client, in display order.
 *
 * Starts from the static list, then drops anything the server says isn't tradeable: one
 * `active_symbols` call per trade type (filtered by `contract_type`), where a trade type is offered
 * iff at least one symbol comes back for it. That last step is what keeps restricted clients — EU
 * accounts, which are offered Multipliers only — from being shown trade types they cannot open,
 * without the UI knowing anything about jurisdictions.
 *
 * The availability lookup is shared through React Query (5-minute staleTime) with per-tab browsing
 * in the market selector, so it costs one round of requests rather than one per consumer. Call this
 * from something that mounts with the page, not only from inside the market selector: asking for it
 * when the selector opens makes the trade-type list render in full and then visibly collapse.
 */
const useAvailableContracts = () => {
    const all_trade_types = useMemo(() => getOrderedAvailableContracts(), []);
    const { available_trade_type_ids, isLoading } = useTradeTypeAvailability(all_trade_types);

    return useMemo(() => {
        const contracts = getAvailableContracts();
        // Fail open while the lookup is in flight — a brief permissive list beats an empty one.
        if (isLoading) return contracts;

        const tradeable = contracts.filter(contract => available_trade_type_ids.has(contract.id));
        // Also fail open if nothing at all came back (e.g. every request errored), rather than
        // presenting a client with no trade types.
        return tradeable.length ? tradeable : contracts;
    }, [isLoading, available_trade_type_ids]);
};

export default useAvailableContracts;
