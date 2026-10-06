import { useDevice } from '@deriv-com/ui';

import useIsPhoneLandscape from 'AppV2/Hooks/useIsPhoneLandscape';

import MarketSelectionDesktop from './market-selection-desktop';
import MarketSelectionMobile from './market-selection-mobile';

type TMarketSelection = {
    isOpen: boolean;
    setIsOpen: (input: boolean) => void;
    /** Anchor for the desktop popover (the market-tabs "add" button). Ignored on mobile. */
    triggerRef?: React.RefObject<HTMLElement>;
    /** When set (e.g. in Automate), restrict the trade-type selector to these trade-type values. */
    supported_trade_types?: Set<string>;
};

/**
 * Entry point for the redesigned market-selection experience. Picks the device-specific shell: a
 * full-screen modal on mobile, or an anchored popover panel on desktop (which needs `triggerRef` to
 * position itself). Both shells share their browse state + commit logic via `useMarketSelection`.
 */
const MarketSelection = ({ isOpen, setIsOpen, triggerRef, supported_trade_types }: TMarketSelection) => {
    const { isMobile } = useDevice();
    const is_phone_landscape = useIsPhoneLandscape();

    // Landscape is a phone despite `isMobile` being width-only — 844px reads as desktop, so it would
    // otherwise get the 900px anchored popover, which does not fit a 390px-tall viewport. It takes the
    // full-screen shell instead, laid out in two columns: there is room for the trade-type sidebar
    // beside the list, but not for a second stacked row above it.
    if (is_phone_landscape) {
        return (
            <MarketSelectionMobile
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                supported_trade_types={supported_trade_types}
                is_landscape
            />
        );
    }

    if (!isMobile && triggerRef) {
        return (
            <MarketSelectionDesktop
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                triggerRef={triggerRef}
                supported_trade_types={supported_trade_types}
            />
        );
    }

    return (
        <MarketSelectionMobile isOpen={isOpen} setIsOpen={setIsOpen} supported_trade_types={supported_trade_types} />
    );
};

export default MarketSelection;
