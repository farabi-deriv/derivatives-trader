import { StandaloneSearchBoldIcon, StandaloneXmarkBoldIcon } from '@deriv/quill-icons';

import Guide from '../Guide';

type TMarketSelectionHeader = {
    onClose: () => void;
    /** Opens the dedicated search page. */
    onSearch?: () => void;
    /** The trade type currently selected in the selector's tabs — the Guide opens on this one (rather
     *  than the trade page's active contract). */
    selected_trade_type?: string;
    /** Set where the host renders the Guide itself (landscape shows it as a page in this shell), so
     *  the trigger press comes back here instead of opening Guide's own overlay. */
    onGuide?: () => void;
};

/**
 * Top bar of the redesigned selector: Close (X) on the left, Guide + Search icons on
 * the right. Search opens a separate search page rather than an inline field.
 */
const MarketSelectionHeader = ({ onClose, onSearch, selected_trade_type, onGuide }: TMarketSelectionHeader) => (
    <div className='market-selection__header-bar'>
        <button type='button' className='market-selection__header-icon' aria-label='Close' onClick={onClose}>
            <StandaloneXmarkBoldIcon iconSize='sm' fill='var(--semantic-color-monochrome-surface-normal-high)' />
        </button>
        {onSearch && (
            <div className='market-selection__header-actions'>
                <Guide
                    show_guide_for_selected_contract
                    show_all_trade_types_in_guide
                    guide_contract_type={selected_trade_type}
                    onTriggerClick={onGuide}
                />
                <button type='button' className='market-selection__header-icon' aria-label='Search' onClick={onSearch}>
                    <StandaloneSearchBoldIcon
                        iconSize='sm'
                        fill='var(--semantic-color-monochrome-surface-normal-high)'
                    />
                </button>
            </div>
        )}
    </div>
);

export default MarketSelectionHeader;
