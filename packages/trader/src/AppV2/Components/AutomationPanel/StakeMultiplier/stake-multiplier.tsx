import React from 'react';

import { useDevice } from '@deriv-com/ui';

import { TStakeMultiplierBounds, TStakeMultiplierParamKey } from '../automation-config';

import StakeMultiplierDesktop from './stake-multiplier-desktop';
import StakeMultiplierMobile from './stake-multiplier-mobile';

type TStakeMultiplierProps = {
    /** Which strategy parameter this editor edits — drives the bounds, hint and copy. */
    param_key: TStakeMultiplierParamKey;
    /** Bounds from the strategy schema; defaults to the client fallbacks. */
    bounds?: TStakeMultiplierBounds;
    selectedValue: number;
    description?: string;
    disabled?: boolean;
    onSelect: (value: number) => void;
};

const StakeMultiplier = (props: TStakeMultiplierProps) => {
    const { isMobile } = useDevice();
    return isMobile ? <StakeMultiplierMobile {...props} /> : <StakeMultiplierDesktop {...props} />;
};

export default StakeMultiplier;
