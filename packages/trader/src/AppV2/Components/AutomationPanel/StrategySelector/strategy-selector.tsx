import React from 'react';

import { useDevice } from '@deriv-com/ui';

import { TStrategyOption } from '../automation-config';

import StrategySelectorDesktop from './strategy-selector-desktop';
import StrategySelectorMobile from './strategy-selector-mobile';

type TStrategySelectorProps = {
    options: TStrategyOption[];
    selectedValue: string;
    description?: string;
    disabled?: boolean;
    is_market_closed?: boolean;
    onSelect: (value: string) => void;
};

const StrategySelector = (props: TStrategySelectorProps) => {
    const { isMobile } = useDevice();
    return isMobile ? <StrategySelectorMobile {...props} /> : <StrategySelectorDesktop {...props} />;
};

export default StrategySelector;
