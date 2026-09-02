import { ContractType as ContractTypeHelper } from 'Stores/Modules/Trading/Helpers/contract-type';
import { TTradeStore } from 'Types';

import * as ContractType from '../Actions/contract-type';
import * as Duration from '../Actions/duration';
import * as StartDate from '../Actions/start-date';

// remove local TGetSnapshot type and assertion after TS migration for trader package is complete
type TGetSnapshot = (properties?: string[]) => TTradeStore;

const processInSequence = async (
    store: TTradeStore,
    functions: ReturnType<typeof getMethodsList> | ReturnType<typeof getExpiryMethodsList>
) => {
    const snapshot = (store.getSnapshot as TGetSnapshot)();
    // Accumulate only what functions explicitly return (the diff), not the full snapshot.
    // Applying the full snapshot would overwrite concurrent store changes (e.g. form_components
    // set by a racing processTradeParams call) with stale snapshot values.
    const diff: Partial<TTradeStore> = {};
    // To make sure that every function is invoked and affects the snapshot respectively, we have to use for instead of forEach
    for (let i = 0; i < functions.length; i++) {
        // Shallow copy with Object.assign is good enough to extend the snapshot with new state
        // we don't need deep extension here, since each function in functions array composes a property of the store completely
        const result = await functions[i](snapshot); // eslint-disable-line no-await-in-loop
        Object.assign(snapshot, result);
        Object.assign(diff, result);
    }
    // Params processors may never write the market identity: `symbol`/`contract_type` are owned
    // exclusively by the selection pipeline (selectMarketAndTradeType / resolveInitialMarket /
    // setTradeSubType / resolveContractTypeAvailability). Enforced here at the choke point so no
    // future process function can regress into an identity writer.
    delete diff.symbol;
    delete diff.contract_type;
    store.updateStore({
        ...diff,
    });
};

export const processTradeParams = async (store: TTradeStore, new_state: Partial<TTradeStore>) => {
    const functions = getMethodsList(store, new_state);
    await processInSequence(store, functions);

    const duration_functions = getExpiryMethodsList();
    await processInSequence(store, duration_functions);

    store.updateStore({
        is_trade_enabled: true,
        is_trade_enabled_v2: true,
    });
};

const getMethodsList = (
    store: Parameters<typeof processTradeParams>[0],
    new_state: Parameters<typeof processTradeParams>[1]
) => {
    const filtered_keys = Object.keys(new_state).filter(key => /\b(symbol|contract_type|is_equal)\b/.test(key));
    return [
        (store: TTradeStore) => ContractTypeHelper.getContractCategories(store.symbol),
        ...(filtered_keys.length > 0 || !store.contract_type // symbol/contract_type changed or contract_type not set yet
            ? [ContractType.onChangeContractType]
            : []),
        StartDate.onChangeStartDate,
        ...(filtered_keys.length || !store.contract_type // symbol/contract_type changed or contract_type not set yet
            ? [Duration.onChangeContractType]
            : []),
    ];
};

const getExpiryMethodsList = () => [StartDate.onChangeExpiry];
