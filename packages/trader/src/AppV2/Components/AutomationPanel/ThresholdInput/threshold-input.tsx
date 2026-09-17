import { useDevice } from '@deriv-com/ui';

import ThresholdInputDesktop from './threshold-input-desktop';
import ThresholdInputMobile from './threshold-input-mobile';

type TThresholdInputProps = {
    threshold_type: 'take_profit' | 'stop_loss';
    description?: string;
    currency: string;
    initialValue: number;
    disabled?: boolean;
    is_market_closed?: boolean;
    onSave: (value: number) => void;
};

const ThresholdInput = (props: TThresholdInputProps) => {
    const { isMobile } = useDevice();
    return isMobile ? <ThresholdInputMobile {...props} /> : <ThresholdInputDesktop {...props} />;
};

export default ThresholdInput;
