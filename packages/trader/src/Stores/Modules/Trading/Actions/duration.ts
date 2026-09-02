import { getDurationMinMaxValues, getExpiryType } from '@deriv/shared';

import { TTradeStore } from 'Types';

type TAssertDurationParams = Partial<
    Pick<TTradeStore, 'contract_expiry_type' | 'duration' | 'duration_min_max' | 'duration_unit'>
>;

/**
 * `contract_expiry_type` is a computed on the store now — a total function of the duration fields —
 * so the pipeline step that re-derived it into diffs is gone. Writing it back would throw (MobX
 * forbids assigning a computed), which aborted the cascade mid-flight: the market selector needed a
 * second click to add a tab because the first click's cascade died on that assignment.
 */
export const onChangeContractType = (store: TTradeStore) => {
    const contract_expiry_type = getExpiryType(store);

    const { duration, duration_min_max, duration_unit } = store;

    const obj_duration = assertDuration({ contract_expiry_type, duration, duration_min_max, duration_unit });

    return {
        ...obj_duration,
    };
};

const assertDuration = ({
    contract_expiry_type,
    duration,
    duration_min_max,
    duration_unit,
}: TAssertDurationParams = {}) => {
    const [min, max] = getDurationMinMaxValues(duration_min_max ?? {}, contract_expiry_type ?? '', duration_unit ?? '');

    if (Number(duration) < Number(min)) {
        return { duration: min };
    }
    if (Number(duration) > Number(max)) {
        return { duration: max };
    }
    return {};
};
