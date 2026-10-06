import React, { lazy, Suspense } from 'react';

import { SmartFallbackLoader } from '@deriv/components';
import useIsPhoneViewport from 'AppV2/Hooks/useIsPhoneViewport';

const V1Contract = lazy(() => import(/* webpackChunkName: "trader-contract-v1" */ 'Modules/Contract'));
const V2ContractDetails = lazy(
    () => import(/* webpackChunkName: "trader-contract-details" */ 'AppV2/Containers/ContractDetails')
);

const ContractDetailsSwitch = () => {
    // Viewport, not width: landscape reads as desktop at 844px and would get the legacy V1 replay.
    const is_phone_viewport = useIsPhoneViewport();

    return (
        <Suspense fallback={<SmartFallbackLoader />}>
            {is_phone_viewport ? <V2ContractDetails /> : <V1Contract />}
        </Suspense>
    );
};

export default ContractDetailsSwitch;
