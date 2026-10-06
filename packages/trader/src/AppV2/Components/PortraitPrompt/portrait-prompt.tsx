import { observer } from 'mobx-react-lite';

import { Localize, useTranslations } from '@deriv-com/translations';

import RotatePrompt from 'AppV2/Components/RotatePrompt';
import useIsPortraitPromptBlocking from 'AppV2/Hooks/useIsPortraitPromptBlocking';
import { getTradeTypeForContractType } from 'AppV2/Utils/market-selection-utils';
import { useTraderStore } from 'Stores/useTraderStores';

/**
 * Blocks a phone held in landscape on any trade type but Accumulators, which is the only one with a
 * landscape surface. It replaces core's LandscapeBlocker on the trade page — that component cannot
 * name the trade type, since core has no access to the trader store.
 *
 * Names the HELD selection in preference to the committed one: picking a portrait-only trade type in
 * landscape does not commit (see `selectMarketAndTradeType`), so the committed type is still
 * Accumulators at this point. The committed one covers arriving already on such a type — rotating
 * into landscape, or a reload.
 *
 * Dismissible only for a held selection, which cancels it and leaves Accumulators as it was. Arriving
 * on such a type has nothing usable behind the prompt, so it stays. The OS check lives in
 * `useIsPortraitPromptBlocking`, so a tablet or a short desktop window never sees this.
 */
const PortraitPrompt = observer(() => {
    const { localize } = useTranslations();
    const { contract_type, pending_landscape_selection, setPendingLandscapeSelection } = useTraderStore();
    const is_blocking = useIsPortraitPromptBlocking();

    if (!is_blocking) return null;

    // The tab name ('Rise/Fall'), not the raw contract type. The ids double as the translation keys
    // for the labels in trade-types-utils, so a plain `localize` resolves them.
    const blocked_contract_type = pending_landscape_selection?.contract_type ?? contract_type;
    const trade_type_id = getTradeTypeForContractType(blocked_contract_type)?.id;

    return (
        <RotatePrompt
            message={
                <Localize
                    i18n_default_text='{{trade_type}} is only available in portrait. Rotate your phone to continue.'
                    values={{ trade_type: trade_type_id ? localize(trade_type_id) : localize('This trade type') }}
                />
            }
            onDismiss={pending_landscape_selection ? () => setPendingLandscapeSelection(null) : undefined}
        />
    );
});

export default PortraitPrompt;
