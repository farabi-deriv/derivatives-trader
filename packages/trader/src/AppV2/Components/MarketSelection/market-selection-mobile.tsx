import { createPortal } from 'react-dom';
import clsx from 'clsx';

import { useIsRtl } from '@deriv/api';
import { observer } from '@deriv/stores';
import { Localize, localize } from '@deriv-com/translations';

import useMarketSelection from 'AppV2/Hooks/useMarketSelection';

import Guide from '../Guide';

import DiscoveryView from './discovery-view';
import MarketCategoryChips from './market-category-chips';
import MarketEmptyState from './market-empty-state';
import MarketFavouritesView from './market-favourites-view';
import MarketInfoScreen from './market-info-screen';
import MarketSearchPage from './market-search-page';
import MarketSelectionHeader from './market-selection-header';
import MarketSelectionList from './market-selection-list';
import MarketSelectionSidebar from './market-selection-sidebar';
import SlideUpPresence from './slide-up-presence';
import TradeTypeTabs from './trade-type-tabs';

import './market-selection.scss';

type TMarketSelectionMobile = {
    isOpen: boolean;
    setIsOpen: (input: boolean) => void;
    /** When set (e.g. in Automate), restrict the trade-type tabs to these trade-type values. */
    supported_trade_types?: Set<string>;
    /** Lay the same shell out in two columns, with the trade types in a sidebar instead of tabs. */
    is_landscape?: boolean;
};

/**
 * Full-screen market-selection experience: browse markets by trade type, discover Trending/Gainers/
 * Losers, search, and open a market info screen. Rendered through a portal as a fixed full-viewport
 * overlay (not an ActionSheet), matching the design. All browse state + commit logic lives in
 * `useMarketSelection`, shared with the desktop shell.
 *
 * Serves both phone portrait and phone landscape. The two differ only in how the trade types are
 * presented — stacked tabs above the list, or a sidebar beside it — so the shell, header, search page
 * and info screen are shared rather than forked.
 */
const MarketSelectionMobile = observer(
    ({ isOpen, setIsOpen, supported_trade_types, is_landscape }: TMarketSelectionMobile) => {
        const {
            current_trade_type,
            selected_category,
            setSelectedCategory,
            is_favourites_tab,
            setIsFavouritesTab,
            is_searching,
            setIsSearching,
            is_guide_open,
            toggleGuide,
            setInfoSymbol,
            info_trade_type,
            showInfo,
            list_window,
            setListWindow,
            symbols,
            isLoading,
            favourites,
            categories,
            favourite_groups,
            visible_symbols,
            change_by_symbol,
            series_by_symbol,
            revealListSymbols,
            show_discovery,
            info_item,
            symbols_by_trade_type,
            is_all_symbols_loading,
            handleClose,
            handleSelectSymbol,
            handleSelectFavourite,
            handleSelectSymbolForTradeType,
            handleSelectTradeType,
        } = useMarketSelection({ is_open: isOpen, onClose: () => setIsOpen(false) });
        const is_rtl = useIsRtl();

        const favourites_content =
            favourites.length === 0 ? (
                <MarketEmptyState
                    title={<Localize i18n_default_text='No favourites yet' />}
                    description={<Localize i18n_default_text='Markets you add to your favourites will appear here.' />}
                />
            ) : (
                <MarketFavouritesView
                    groups={favourite_groups}
                    change_by_symbol={change_by_symbol}
                    series_by_symbol={series_by_symbol}
                    onSelectFavourite={handleSelectFavourite}
                    onInfo={showInfo}
                />
            );

        let content;
        if (is_searching) {
            content = (
                <MarketSearchPage
                    symbols_by_trade_type={symbols_by_trade_type}
                    is_loading={is_all_symbols_loading}
                    onSelectSymbol={handleSelectSymbolForTradeType}
                    onInfo={showInfo}
                    onBack={() => setIsSearching(false)}
                    supported_trade_types={supported_trade_types}
                />
            );
        } else {
            const browse_content = is_favourites_tab ? (
                favourites_content
            ) : (
                <>
                    <MarketCategoryChips
                        categories={categories}
                        selected_id={selected_category}
                        onSelect={setSelectedCategory}
                    />
                    {show_discovery ? (
                        <DiscoveryView
                            symbols={symbols}
                            onSelectSymbol={handleSelectSymbol}
                            onInfo={underlying_symbol => showInfo(underlying_symbol, current_trade_type)}
                            is_loading={isLoading}
                        />
                    ) : (
                        <MarketSelectionList
                            symbols={visible_symbols}
                            is_loading={isLoading}
                            trade_type={current_trade_type}
                            onSelectSymbol={handleSelectSymbol}
                            onInfo={showInfo}
                            change_by_symbol={change_by_symbol}
                            series_by_symbol={series_by_symbol}
                            window={list_window}
                            onSelectWindow={setListWindow}
                            onRevealSymbols={revealListSymbols}
                        />
                    )}
                </>
            );

            let shell_content;
            if (is_landscape) {
                shell_content = (
                    <div className='market-selection__columns'>
                        <MarketSelectionSidebar
                            selected_trade_type_id={current_trade_type}
                            is_favourites_selected={is_favourites_tab}
                            favourites_count={favourites.length}
                            onSelectTradeType={handleSelectTradeType}
                            onSelectFavourites={() => setIsFavouritesTab(true)}
                            supported_trade_types={supported_trade_types}
                            with_tooltips={false}
                        />
                        <div className='market-selection__browse'>{browse_content}</div>
                    </div>
                );
            } else {
                shell_content = (
                    <>
                        <TradeTypeTabs
                            selected_id={current_trade_type}
                            onSelect={handleSelectTradeType}
                            is_favourites_selected={is_favourites_tab}
                            favourites_count={favourites.length}
                            onSelectFavourites={() => setIsFavouritesTab(true)}
                            supported_trade_types={supported_trade_types}
                        />
                        {browse_content}
                    </>
                );
            }

            content = (
                <div className={clsx('market-selection', { 'market-selection--landscape': is_landscape })}>
                    <MarketSelectionHeader
                        onClose={handleClose}
                        onSearch={() => setIsSearching(true)}
                        selected_trade_type={current_trade_type}
                        onGuide={is_landscape ? toggleGuide : undefined}
                    />
                    {shell_content}
                </div>
            );
        }

        return createPortal(
            <SlideUpPresence
                is_open={isOpen}
                // Arabic landscape keeps the page left-to-right (see AppContent); the selector reads
                // right-to-left, as in portrait.
                dir={is_rtl ? 'rtl' : undefined}
                className='market-selection__modal'
                role='dialog'
                aria-modal='true'
                aria-label={localize('Market selection')}
            >
                {content}
                {/* Pages over the one they were opened from, which stays mounted so Back keeps its scroll. */}
                {/* Landscape's guide is a page rather than Guide's own sheet; ✕ steps back to browse. */}
                <SlideUpPresence
                    is_open={!!is_landscape && is_guide_open}
                    className='market-selection__page market-selection market-selection--landscape'
                    data-testid='dt_market_selection_guide'
                >
                    <MarketSelectionHeader onClose={toggleGuide} />
                    <div className='market-selection__guide'>
                        <Guide
                            show_trigger_button={false}
                            show_description_in_a_modal={false}
                            show_all_trade_types_in_guide
                            guide_contract_type={current_trade_type}
                        />
                    </div>
                </SlideUpPresence>
                <SlideUpPresence is_open={!!info_item} className='market-selection__page'>
                    {info_item && (
                        <MarketInfoScreen
                            item={info_item}
                            onBack={() => setInfoSymbol(null)}
                            onTraded={handleClose}
                            default_trade_type={info_trade_type}
                        />
                    )}
                </SlideUpPresence>
            </SlideUpPresence>,
            document.body
        );
    }
);

export default MarketSelectionMobile;
