import { observer } from 'mobx-react-lite';

import { isMobileOs } from '@deriv/shared';
import { useStore } from '@deriv/stores';
import { Localize } from '@deriv-com/translations';

import RotatePrompt from 'AppV2/Components/RotatePrompt';
import { useTraderStore } from 'Stores/useTraderStores';

// One-time nudge toward landscape, shown the first time Accumulators is picked.
// Gated on `isMobileOs` rather than viewport width: "rotate your phone" is nonsense in a narrow
// desktop window, which is exactly what a width check calls a phone.
const LandscapePrompt = observer(() => {
    const { ui } = useStore();
    const { has_seen_landscape_prompt, setHasSeenLandscapePrompt } = ui;
    const { is_accumulator } = useTraderStore();

    if (has_seen_landscape_prompt || !is_accumulator || !isMobileOs()) return null;

    return (
        <RotatePrompt
            message={<Localize i18n_default_text='Rotate your phone to landscape mode for a better experience.' />}
            onDismiss={() => setHasSeenLandscapePrompt(true)}
        />
    );
});

export default LandscapePrompt;
