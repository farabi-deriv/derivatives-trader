import React from 'react';

import { useDevice } from '@deriv-com/ui';

import MaxTradeStakeDesktop from './max-trade-stake-desktop';
import MaxTradeStakeMobile from './max-trade-stake-mobile';

type TMaxTradeStakeProps = {
    currency: string;
    initialValue: number | null;
    initialStake?: number;
    description?: string;
    disabled?: boolean;
    is_market_closed?: boolean;
    onSave: (value: number | null) => void;
};

const MaxTradeStake = (props: TMaxTradeStakeProps) => {
    const { isMobile } = useDevice();
    return isMobile ? <MaxTradeStakeMobile {...props} /> : <MaxTradeStakeDesktop {...props} />;
};

export default MaxTradeStake;
