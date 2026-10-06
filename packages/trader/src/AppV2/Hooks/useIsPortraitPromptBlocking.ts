import { useTraderStore } from 'Stores/useTraderStores';

import useIsPhoneLandscape from './useIsPhoneLandscape';

/**
 * True while PortraitPrompt covers the page — a phone in landscape on a trade type with no landscape
 * surface, or holding back a selection for one. Shared, so the prompt, the surface behind it and the
 * nav rail beside it cannot disagree. Callers must be observers: `useTraderStore` is a bare `useContext`.
 */
const useIsPortraitPromptBlocking = () => {
    const { contract_type, is_accumulator, pending_landscape_selection } = useTraderStore();
    const is_phone_landscape = useIsPhoneLandscape();
    // A blank type is one startup has not resolved yet, not a portrait-only one.
    const is_portrait_only = !!contract_type && !is_accumulator;

    return is_phone_landscape && (is_portrait_only || !!pending_landscape_selection);
};

export default useIsPortraitPromptBlocking;
