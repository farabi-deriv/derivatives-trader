import { Locator, expect } from '@playwright/test';
import { TradeBasePage } from './TradeBasePage';

/**
 * Page Object for the market-selection picker and the trade-page's market-tabs strip (/).
 *
 * Covers: opening/closing the picker, browsing by trade type or asset-class category, search,
 * favourites, the Market Info screen, the Guide description modal, and managing open tabs
 * (switch/remove). Selecting a market end-to-end (open picker → search → commit → verify trade
 * params rendered) is `TradeParametersPage.selectMarketAndTradeType()`, which composes this page —
 * it stays there because it also asserts trade-*parameter* locators that belong to that class.
 *
 * @example
 * ```typescript
 * test('VERIFY favouriting a market', async ({ marketSelectionPage }) => {
 *     await marketSelectionPage.addMarketButton.click();
 *     await marketSelectionPage.toggleFavourite('Volatility 100 Index');
 * });
 * ```
 */
export class MarketSelectionPage extends TradeBasePage {
    /**
     * Max number of tabs that can be open simultaneously — 4 on mobile, 7 on desktop, both
     * intentional and final (confirmed via `getMaxOpenMarkets()`,
     * `packages/trader/src/AppV2/Utils/open-markets-utils.ts`, and its own Jest test).
     */
    get maxOpenMarkets(): number {
        return this.isMobile ? 4 : 7;
    }

    // ============================================
    // LOCATORS
    // ============================================

    /**
     * "Add market" button on the market-tabs strip — opens the market-selection picker to add a
     * NEW tab (as opposed to clicking the active tab, which opens it to REPLACE that tab).
     * Source: market-tabs.tsx aria-label='Add market'
     */
    get addMarketButton(): Locator {
        return this.page.getByRole('button', { name: 'Add market' });
    }

    /**
     * Root panel of the market-selection picker — present only while it's open. Both shells
     * unmount entirely when closed (`return null`), so this also doubles as the "closed" check via
     * `.not.toBeAttached()`.
     * - Desktop: `.market-selection-desktop` (InputPopover's className, market-selection-desktop.tsx)
     * - Mobile: the full-screen modal, `role="dialog"` `aria-label="Market selection"`
     *   (market-selection-mobile.tsx)
     */
    get marketSelectionPanel(): Locator {
        return this.isMobile
            ? this.page.locator('[role="dialog"][aria-label="Market selection"]')
            : this.page.locator('.market-selection-desktop');
    }

    /**
     * Desktop-only full-viewport backdrop for the market-selection InputPopover.
     * Scoped to the overlay that wraps `.market-selection-desktop` so we never dismiss a
     * trade-parameter popover overlay by mistake.
     */
    get marketSelectionOverlay(): Locator {
        return this.page
            .locator('.input-popover-overlay')
            .filter({ has: this.page.locator('.market-selection-desktop') });
    }

    /**
     * Search-icon trigger that opens the dedicated mobile search page — desktop's search field is
     * already inline, so this is mobile-only chrome.
     * Source: market-selection-header.tsx `.market-selection__header-icon` aria-label='Search'
     */
    get marketSelectionSearchButton(): Locator {
        return this.marketSelectionPanel.getByRole('button', { name: 'Search' });
    }

    /**
     * "Cancel" button that exits the dedicated mobile search page back to the trade-type
     * tablist/category view. Desktop has no equivalent — its search field is inline alongside
     * the sidebar, which is never hidden. Confirmed live: while the search page is active, the
     * trade-type tablist (including the Favourite tab) does not exist in the DOM at all — this
     * must be tapped before any locator that lives outside the search page.
     * Source: market-search-page.tsx
     */
    get marketSearchCancelButton(): Locator {
        return this.page.getByRole('button', { name: 'Cancel' });
    }

    /**
     * Mobile dedicated search page container. Empty until the header Search icon is tapped.
     * Source: market-search-page.tsx `.market-search`
     */
    get marketSearchPage(): Locator {
        return this.page.locator('.market-search');
    }

    /**
     * Cross-trade-type search results list — rendered after the query matches loaded symbol lists.
     * Source: market-search-results.tsx `.market-search-results`
     */
    get marketSearchResults(): Locator {
        return this.page.locator('.market-search-results');
    }

    /** Skeleton shown while per-trade-type symbol lists are still loading for a query. */
    get marketSearchLoadingList(): Locator {
        return this.page.locator('.market-selection-list--loading');
    }

    /**
     * Market-selection search input — viewport-aware. Searching by name reaches any market across
     * every trade type in one step, rather than switching categories and scrolling a long list.
     * - Desktop: always-inline field, placeholder "Search by market name" (market-selection-desktop.tsx)
     * - Mobile: on the dedicated search page (opened via `marketSelectionSearchButton`), placeholder
     *   "Search markets" (market-search-page.tsx)
     */
    get marketSearchInput(): Locator {
        return this.isMobile
            ? this.marketSearchPage.getByPlaceholder('Search markets')
            : this.page.locator('.market-selection-desktop__search').getByPlaceholder('Search by market name');
    }

    /**
     * Clear (X) control on the SearchField — shown while the query is non-empty. Clears the query
     * but keeps the picker (and the mobile search page) open.
     * Source: @deriv-com/quill-ui SearchField `button.icon_wrapper`
     */
    get marketSearchClearButton(): Locator {
        return this.isMobile
            ? this.page.locator('.market-search__header button.icon_wrapper')
            : this.page.locator('.market-selection-desktop__search button.icon_wrapper');
    }

    /**
     * Search-results group for one trade type — results are grouped by trade type (a symbol can
     * appear under several), and selecting a row commits it under whichever group it's in.
     * Source: market-search-results.tsx `.market-search-results__group` / `__trade-type` header
     *
     * @param tradeType - Visible trade-type label (e.g. 'Rise/Fall', 'Multipliers')
     */
    marketSearchResultsGroup(tradeType: string): Locator {
        return this.page
            .locator('.market-search-results__group')
            .filter({ has: this.page.locator('.market-search-results__trade-type', { hasText: tradeType }) })
            .first();
    }

    /**
     * First market row matching the display name in search results — search is grouped by trade type
     * and a symbol can appear under several groups; this takes the first match in list order.
     *
     * @param market - Visible market name (e.g. 'Volatility 100 Index')
     */
    firstMarketSearchResultRow(market: string): Locator {
        const results = this.marketSearchResults;
        return this.isMobile
            ? results
                  .locator('.market-selection-row')
                  .filter({ has: this.page.locator('.market-selection-row__name', { hasText: market }) })
                  .first()
            : results
                  .locator('.market-row-desktop')
                  .filter({ has: this.page.locator('.market-row-desktop__name', { hasText: market }) })
                  .first();
    }

    /**
     * CLOSED tag on a search-result row when the exchange is shut (replaces the % change pill).
     * Mobile: inside `.market-selection-row__content`. Desktop: inside `.market-row-desktop`.
     * Market Info uses title case **Closed** in `.market-info__price-row` instead.
     * Source: market-selection-row-mobile.tsx / market-selection-row-desktop.tsx
     */
    searchResultRowClosedTag(row: Locator): Locator {
        return row.locator('.tag__color--error-fill', { hasText: 'CLOSED' }).first();
    }

    /** Whether a search-result row shows the CLOSED tag (market outside trading hours). */
    async isSearchResultRowClosed(row: Locator): Promise<boolean> {
        return this.searchResultRowClosedTag(row)
            .isVisible()
            .catch(() => false);
    }

    /**
     * Market row within a search-results trade-type group, filtered by display name —
     * viewport-aware. Clicking it commits BOTH this symbol and the group's trade type.
     * - Desktop: `.market-row-desktop` (market-selection-row-desktop.tsx)
     * - Mobile: `.market-selection-row` (market-selection-row-mobile.tsx)
     *
     * @param market - Visible market name (e.g. 'Volatility 100 Index')
     * @param tradeType - Visible trade-type label the row must be grouped under
     */
    marketSearchResultRow(market: string, tradeType: string): Locator {
        const group = this.marketSearchResultsGroup(tradeType);
        return this.isMobile
            ? group
                  .locator('.market-selection-row')
                  .filter({ has: this.page.locator('.market-selection-row__name', { hasText: market }) })
                  .locator('.market-selection-row__content')
                  .first()
            : group
                  .locator('.market-row-desktop')
                  .filter({ has: this.page.locator('.market-row-desktop__name', { hasText: market }) })
                  .first();
    }

    /**
     * Empty-state title inside the market-selection picker — shown for both "no search
     * results" ("No result found") and "no favourites yet" ("No favourites yet").
     * Source: market-empty-state.tsx `.market-empty-state__title`
     */
    get marketEmptyStateTitle(): Locator {
        return this.page.locator('.market-empty-state__title');
    }

    /**
     * A market row within the Favourite tab/section, filtered by display name. Distinct from
     * {@link marketSearchResultRow} — the Favourites view groups rows under
     * `.market-favourites__group`, not `.market-search-results__group`.
     * Source: market-favourites-view.tsx
     *
     * @param market - Visible market name (e.g. 'Volatility 100 Index')
     */
    favouriteMarketRow(market: string): Locator {
        return this.page
            .locator('.market-favourites__group')
            .locator(this.isMobile ? '.market-selection-row' : '.market-row-desktop', { hasText: market });
    }

    /**
     * Empty-state description text under {@link marketEmptyStateTitle}.
     * Source: market-empty-state.tsx `.market-empty-state__description`
     */
    get marketEmptyStateDescription(): Locator {
        return this.page.locator('.market-empty-state__description');
    }

    /**
     * Asset-class category chip (e.g. 'Derived', 'Forex', 'Stocks & indices', 'Commodities',
     * 'Cryptocurrencies') in the market-selection picker. There is no 'Featured' chip — it was
     * removed in master PR #974 (2026-08-06) along with the Trending/Gainers/Losers discovery
     * view. Selected state is exposed as `data-state="selected"` (confirmed live — Quill's
     * `Chip.Selectable`), not `aria-selected`.
     * Source: market-category-chips.tsx `.market-selection__category-chips`
     *
     * @param label - Visible chip label (e.g. 'Forex')
     */
    marketCategoryChip(label: string): Locator {
        return this.page.locator('.market-selection__category-chips button', { hasText: label });
    }

    /**
     * Trade-type navigation item — viewport-aware. Mobile renders a `role="tablist"` strip
     * (`market-selection__trade-type-tab`); desktop renders a grouped sidebar
     * (`market-selection-sidebar__item`) under Directional/Growth based/Digit based headers.
     * Source: trade-type-tabs.tsx (mobile) / market-selection-sidebar.tsx (desktop)
     */
    get tradeTypeNavItems(): Locator {
        return this.isMobile
            ? this.page.locator('.market-selection__trade-type-tab')
            : this.page.locator('.market-selection-sidebar__item');
    }

    /**
     * Trade-type navigation item filtered by visible label — same viewport split as
     * {@link tradeTypeNavItems}.
     *
     * @param tradeType - Visible trade-type label (e.g. 'Accumulators')
     */
    tradeTypeNavItem(tradeType: string): Locator {
        return this.tradeTypeNavItems.filter({ hasText: tradeType });
    }

    /**
     * "Favourite ({{count}})" tab/sidebar-item — viewport-aware. Mobile: leading tab in the
     * trade-type tablist. Desktop: pinned item at the bottom of the sidebar.
     * Source: trade-type-tabs.tsx / market-selection-sidebar.tsx
     */
    get favouritesTab(): Locator {
        return this.isMobile
            ? this.page.locator('.market-selection__trade-type-tab').filter({ hasText: 'Favourite' })
            : this.page.locator('.market-selection-sidebar__favourite');
    }

    /**
     * "Changes ({window})" time-window dropdown trigger — appears in every category list view
     * (the picker's default landing state, since the Featured/Discovery screen was removed in
     * master PR #974) and on the Market Info screen's chart. NOT present on the Favourite tab —
     * `MarketFavouritesView` never wires a window selector.
     * Source: market-changes-dropdown.tsx `.market-changes-dropdown__trigger`
     */
    get marketChangesDropdownTrigger(): Locator {
        return this.page.locator('.market-changes-dropdown__trigger');
    }

    /**
     * An option inside the open {@link marketChangesDropdownTrigger} menu, filtered by label
     * (e.g. '15 minutes'). Desktop renders a `role="listbox"` popover; mobile an ActionSheet
     * titled "Change period" — both expose `role="option"` rows.
     */
    marketChangesDropdownOption(label: string): Locator {
        return this.page.getByRole('option', { name: label });
    }

    /**
     * Info button on a market row or discovery card — opens the Market Info screen for that
     * symbol. Present on rows (list/search/favourites) and discovery cards alike.
     * - Desktop: nested inside the row's own button, always in the accessibility tree (hover
     *   reveals it visually) — `getByRole` works directly.
     * - Mobile: a SIBLING of the row's content button, not a descendant, wrapped in
     *   `.market-selection-row__actions[aria-hidden="true"]` until swiped — `getByRole` would
     *   exclude it regardless of scope (it respects `aria-hidden`, mirroring real assistive
     *   tech), so this targets the CSS class directly, which queries the raw DOM instead.
     * Source: market-card.tsx / market-selection-row-desktop.tsx / market-selection-row-mobile.tsx `aria-label="Info"`
     *
     * @param market - Visible market name whose row/card to target
     */
    marketInfoButton(market: string): Locator {
        return this.isMobile
            ? this.page
                  .locator('.market-selection-row', { hasText: market })
                  .locator('.market-selection-row__action--info')
                  .first()
            : this.page
                  .locator('button, [role="button"]', { hasText: market })
                  .getByRole('button', { name: 'Info' })
                  .first();
    }

    /**
     * Favourite/Unfavourite toggle button on a market row or the Info screen. Label flips
     * between "Favourite" and "Unfavourite" based on current state. Same desktop/mobile split
     * as {@link marketInfoButton} — see its doc comment for why mobile needs a raw CSS-class
     * locator instead of `getByRole`.
     * Source: market-selection-row-desktop.tsx / market-selection-row-mobile.tsx / market-info-screen.tsx
     *
     * @param market - Visible market name whose row to target
     */
    favouriteButton(market: string): Locator {
        return this.isMobile
            ? this.page
                  .locator('.market-selection-row', { hasText: market })
                  .locator('.market-selection-row__action--favourite')
                  .first()
            : this.page
                  .locator('button, [role="button"]', { hasText: market })
                  .getByRole('button', { name: /^(Favourite|Unfavourite)$/ })
                  .first();
    }

    /**
     * Root of the Market Info screen — replaces the browse panel/modal in place (same popover
     * footprint on desktop, same full-screen dialog on mobile).
     * Source: market-info-screen.tsx `.market-info`
     */
    get marketInfoScreen(): Locator {
        return this.page.locator('.market-info');
    }

    /**
     * Back button on the Market Info screen — returns to whichever browse view was active
     * before Info opened.
     * Source: market-info-screen.tsx `aria-label="Back"`
     */
    get marketInfoBackButton(): Locator {
        return this.marketInfoScreen.getByRole('button', { name: 'Back' });
    }

    /**
     * Favourite/Unfavourite toggle on the Market Info screen itself (distinct from the row
     * button — scoped to the Info screen so it doesn't collide with a row of the same name).
     * Source: market-info-screen.tsx `.market-info__favourite`
     */
    get marketInfoFavouriteButton(): Locator {
        return this.marketInfoScreen.locator('.market-info__favourite');
    }

    /**
     * "Trade on" section listing every trade type the Info screen's symbol supports as a
     * direct CTA.
     * Source: market-info-screen.tsx `.market-info__trade-types`
     */
    get marketInfoTradeOnSection(): Locator {
        return this.marketInfoScreen.locator('.market-info__trade-types');
    }

    /**
     * A "Trade on" CTA card, filtered by trade-type label. Clicking it commits the Info
     * screen's symbol under that trade type and closes the whole picker.
     * Source: market-info-screen.tsx `.market-info__trade-type-card`
     *
     * @param tradeType - Visible trade-type label (e.g. 'Multipliers')
     */
    marketInfoTradeOnCard(tradeType: string): Locator {
        return this.marketInfoScreen.locator('.market-info__trade-type-card', { hasText: tradeType });
    }

    /**
     * Guide trigger — opens the "how to trade" description modal for the currently-selected
     * trade type. Rendered in the mobile header and the desktop sidebar header alike.
     * Source: guide.tsx `aria-label="Guide"`
     */
    get guideButton(): Locator {
        return this.page.getByRole('button', { name: 'Guide' });
    }

    /**
     * Guide description modal — opened by {@link guideButton}. Confirmed live: the modal has no
     * `role="dialog"` at all, and (since our call site always sets `show_all_trade_types_in_guide`)
     * its title is literally "Trade types" — the same text the sidebar header already shows
     * statically, so this matches on the real `<h4>` heading specifically (`Heading.H4` → `role="heading"`
     * level 4) to avoid colliding with the sidebar's plain-text label.
     * Source: guide-description-modal.tsx
     */
    get guideDescriptionModal(): Locator {
        return this.page.getByRole('heading', { name: 'Trade types', level: 4 });
    }

    /**
     * A trade-type chip inside the open Guide modal — switching one updates the modal's own
     * description in place, independent of the underlying picker's selected trade type.
     * `.guide__menu` is shared markup on both viewports; only its containing wrapper differs
     * (see {@link guideContent}).
     * Source: guide-description-modal.tsx `.guide__menu`
     *
     * @param tradeType - Visible trade-type label inside the Guide (e.g. 'Accumulators')
     */
    guideTradeTypeChip(tradeType: string): Locator {
        return this.page.locator('.guide__menu button', { hasText: tradeType });
    }

    /**
     * Guide modal's content area (chip row + description) — confirmed live the two viewports use
     * different wrapper classes despite sharing `.guide__menu` inside: desktop wraps it in a
     * modal (`.guide-desktop-modal__content`), mobile in a bottom ActionSheet
     * (`.guide__wrapper__content`). Used to assert the description text changes after switching
     * {@link guideTradeTypeChip}.
     */
    get guideContent(): Locator {
        return this.isMobile
            ? this.page.locator('.guide__wrapper__content')
            : this.page.locator('.guide-desktop-modal__content');
    }

    /**
     * Close ("X") button on the mobile market-selection modal header. Desktop has no
     * equivalent button — its popover closes via an outside click instead, see
     * {@link closeMarketSelectionPicker}.
     * Source: market-selection-header.tsx `aria-label="Close"`
     */
    get marketSelectionCloseButton(): Locator {
        return this.page.getByRole('button', { name: 'Close' });
    }

    /**
     * All currently-open market tabs on the trade-page strip.
     * Source: market-tabs.tsx `[data-testid="dt_market_tabs_list"] [data-testid="dt_market_tab"]`
     */
    get marketTabs(): Locator {
        return this.page.locator('[data-testid="dt_market_tabs_list"] [data-testid="dt_market_tab"]');
    }

    /**
     * A specific market tab, filtered by its market name and trade-type subtitle.
     * Source: market-tab.tsx `[data-testid="dt_market_tab"]`
     *
     * @param market - Visible market name (e.g. 'Volatility 100 Index')
     * @param tradeType - Visible trade-type subtitle (e.g. 'Rise/Fall')
     */
    marketTab(market: string, tradeType: string): Locator {
        return this.marketTabs.filter({ hasText: market }).filter({ hasText: tradeType });
    }

    /**
     * Remove ("×") button for a specific market tab — only rendered/tappable when the tab is
     * removable (more than one tab open, and not the last tradeable tab). On desktop it's
     * hidden until the tab is hovered; on the active tab it is shown by default.
     * Source: market-tab.tsx `aria-label="Remove market"`
     *
     * @param market - Visible market name of the tab to target
     * @param tradeType - Visible trade-type subtitle of the tab to target
     */
    removeMarketTabButton(market: string, tradeType: string): Locator {
        return this.marketTab(market, tradeType).getByRole('button', { name: 'Remove market' });
    }

    // ============================================
    // ACTIONS
    // ============================================

    /**
     * Switch to an already-open market tab by market + trade type.
     *
     * @param market - Visible market name of the tab to activate
     * @param tradeType - Visible trade-type subtitle of the tab to activate
     */
    async switchToMarketTab(market: string, tradeType: string): Promise<void> {
        await this.marketTab(market, tradeType).click();
    }

    /**
     * Remove an open market tab. Desktop reveals the close control on hover for non-active
     * tabs, so this hovers first. Mobile has no hover state at all, and a non-active tab's
     * close control sits behind the tab's own content until that tab is activated — confirmed
     * live: clicking it directly times out (something else always intercepts the pointer
     * event). So on mobile, a non-active target tab is activated first, making its close
     * control the reliably-clickable one; an already-active tab is left alone, since clicking
     * it again would open the market-selection picker instead (see `selectMarketAndTradeType`'s
     * "replace" behavior).
     *
     * @param market - Visible market name of the tab to remove
     * @param tradeType - Visible trade-type subtitle of the tab to remove
     */
    async removeMarketTab(market: string, tradeType: string): Promise<void> {
        const tab = this.marketTab(market, tradeType);
        if (this.isMobile) {
            const isActive = (await tab.getAttribute('aria-current')) === 'true';
            if (!isActive) {
                await tab.click();
            }
        } else {
            await tab.hover();
        }
        await this.removeMarketTabButton(market, tradeType).click();
    }

    /**
     * Select an asset-class category chip in the market-selection picker (e.g. 'Forex',
     * 'Derived'). The picker must already be open.
     *
     * @param label - Visible chip label
     */
    async selectMarketCategory(label: string): Promise<void> {
        await this.marketCategoryChip(label).click();
    }

    /**
     * Select a trade type inside the market-selection picker's navigation (mobile tab strip
     * or desktop sidebar). The picker must already be open. Unlike
     * `TradeParametersPage.selectMarketAndTradeType()`, this only switches which trade type is
     * being browsed — it does not commit a market or close the picker.
     *
     * @param tradeType - Visible trade-type label (e.g. 'Accumulators')
     */
    async selectTradeTypeInPicker(tradeType: string): Promise<void> {
        await this.tradeTypeNavItem(tradeType).click();
    }

    /**
     * Toggle the Favourite state for a market row in the currently-browsed list/search/
     * favourites view. The picker must already be open and the row visible.
     *
     * Desktop reveals Info/Favourite inline (hover suffices). Mobile only reveals them via a
     * swipe-left gesture, which Playwright cannot simulate as a real touch swipe — the buttons
     * are always present in the DOM (`tabindex="-1"`/`aria-hidden="true"` toggle, not
     * `display: none`), but they sit BEHIND the row's content element until swiped, so a
     * coordinate-based click (even `force: true`) lands on the content on top and selects the
     * market instead — confirmed live: it closed the picker rather than toggling. Dispatching a
     * `click` event directly targets the button's own handler without any hit-testing.
     *
     * @param market - Visible market name whose row to toggle
     */
    async toggleFavourite(market: string): Promise<void> {
        if (this.isMobile) {
            await this.favouriteButton(market).dispatchEvent('click');
        } else {
            await this.favouriteButton(market).click();
        }
    }

    /**
     * Open the Market Info screen for a market row or discovery card.
     *
     * Mobile rows only reveal the Info button via a swipe-left gesture — see
     * {@link toggleFavourite} for why a dispatched click event is used instead of a real click.
     * Discovery cards show Info inline on both viewports, so this is safe for both entry points.
     *
     * @param market - Visible market name whose Info button to click
     */
    async openMarketInfo(market: string): Promise<void> {
        if (this.isMobile) {
            await this.marketInfoButton(market).dispatchEvent('click');
        } else {
            await this.marketInfoButton(market).click();
        }
    }

    /**
     * Open Market Info from a specific search-result row (use when multiple trade-type groups match).
     *
     * @param row - A row locator from {@link firstMarketSearchResultRow} or {@link marketSearchResultRow}
     */
    async openMarketInfoOnSearchRow(row: Locator): Promise<void> {
        if (this.isMobile) {
            await row.locator('.market-selection-row__action--info').dispatchEvent('click');
        } else {
            await row.getByRole('button', { name: 'Info' }).click();
        }
    }

    /**
     * Open the Guide description modal for the currently-selected trade type.
     */
    async openGuide(): Promise<void> {
        await this.guideButton.click();
    }

    /**
     * Switch to a different trade type inside the open Guide modal. This only changes which
     * description the modal shows — the modal stays open, and it does not affect the underlying
     * picker's own selected trade type (confirmed live: the sidebar/tablist item for the
     * original trade type remains selected throughout).
     *
     * @param tradeType - Visible trade-type label inside the Guide (e.g. 'Accumulators')
     */
    async selectTradeTypeInGuide(tradeType: string): Promise<void> {
        await this.guideTradeTypeChip(tradeType).click();
    }

    /**
     * Open the search field, ready for `.fill()`. Desktop's search field is already inline, so
     * this is a no-op there; mobile taps Search then waits for the dedicated search input before
     * returning so the caller can fill immediately with no extra hidden wait.
     */
    async openMarketSearch(): Promise<void> {
        if (this.isMobile) {
            await expect(
                this.marketSelectionSearchButton,
                'Search icon should be visible on the market-selection header'
            ).toBeVisible();
            await this.marketSelectionSearchButton.click();
            await expect(this.marketSearchPage, 'Mobile search page should open').toBeVisible();
            await expect(this.marketSearchInput, 'Mobile search input should be ready to type').toBeVisible();
            await expect(this.marketSearchInput, 'Mobile search input should be editable').toBeEditable();
        }
    }

    /**
     * Wait for a market row to appear in cross-trade-type search results — skips the loading
     * skeleton phase while per-trade-type symbol lists resolve.
     */
    async waitForMarketSearchResultRow(market: string): Promise<Locator> {
        const row = this.firstMarketSearchResultRow(market);

        await expect
            .poll(
                async () => {
                    if (await this.marketSearchLoadingList.isVisible().catch(() => false)) {
                        return false;
                    }
                    return await row.isVisible().catch(() => false);
                },
                { message: `[${market}] should appear in search results after symbol lists load` }
            )
            .toBe(true);

        return row;
    }

    /**
     * Clear the market-selection search query via the SearchField X control — keeps the picker
     * open so the next symbol can be typed immediately.
     */
    async clearMarketSearch(): Promise<void> {
        await expect(
            this.marketSearchClearButton,
            'Search clear (X) should be visible while a query is active'
        ).toBeVisible();
        await this.marketSearchClearButton.click();
        await expect(this.marketSearchInput, 'Search field should be empty after clearing').toHaveValue('');
    }

    /**
     * Exit the search field back to the trade-type tablist/category view. A no-op on desktop,
     * where search is inline and never hides the sidebar; required on mobile before interacting
     * with anything from the tablist (e.g. {@link favouritesTab}) after searching, since the
     * dedicated search page replaces that tablist entirely while active.
     */
    async exitMarketSearch(): Promise<void> {
        if (this.isMobile) {
            await this.marketSearchCancelButton.click();
        }
    }

    /**
     * Close the market-selection picker without selecting a market. Mobile taps the header's
     * Close (X) button — if the dedicated search page is still open, taps Cancel first because
     * Close is not rendered on the search page. Desktop clicks the InputPopover backdrop.
     */
    async closeMarketSelectionPicker(): Promise<void> {
        const panel = this.marketSelectionPanel;

        await expect(async () => {
            if ((await panel.count()) === 0) {
                return;
            }

            if (this.isMobile) {
                // Close (X) is on the browse header only — the dedicated search page replaces it with Cancel.
                if (await this.marketSearchPage.isVisible().catch(() => false)) {
                    await this.marketSearchCancelButton.click();
                    await expect(
                        this.marketSearchPage,
                        'Search page should close before dismissing the picker'
                    ).not.toBeVisible();
                }
                await this.marketSelectionCloseButton.click();
            } else {
                const overlay = this.marketSelectionOverlay;
                await expect(overlay, 'Market-selection overlay should be visible while open').toBeVisible();

                const panelBox = await panel.boundingBox();
                const overlayBox = await overlay.boundingBox();
                if (!panelBox || !overlayBox) {
                    throw new Error('Cannot dismiss market-selection picker — overlay/panel box unavailable');
                }

                // Tap the overlay backdrop to the right of the panel (not on the panel — stopPropagation).
                const clickX = Math.min(panelBox.x + panelBox.width + 40 - overlayBox.x, overlayBox.width - 10);
                const clickY = Math.min(
                    panelBox.y + Math.min(120, panelBox.height / 2) - overlayBox.y,
                    overlayBox.height - 10
                );
                await overlay.click({ position: { x: clickX, y: clickY } });

                // Playwright's pointer click can miss the overlay in the full trade-page stack; a DOM
                // click on the overlay element reliably invokes InputPopover's onClose handler.
                if ((await panel.count()) > 0) {
                    await overlay.evaluate(element => (element as HTMLElement).click());
                }
            }

            await expect(panel, 'Market-selection picker should close after dismiss').not.toBeAttached();
            if (!this.isMobile) {
                await expect(this.marketSelectionOverlay, 'Market-selection overlay should be removed').toHaveCount(0);
            }
        }).toPass({ timeout: 10_000 });
    }

    // ============================================
    // VERIFICATIONS
    // ============================================

    /**
     * Verify a trade type is the currently-selected item in the market-selection picker's
     * navigation. Mobile renders the trade-type nav as `role="tab"` (`aria-selected`); desktop
     * renders it as a sidebar button (`aria-pressed`) — see trade-type-tabs.tsx vs
     * market-selection-sidebar.tsx.
     *
     * @param tradeType - Visible trade-type label (e.g. 'Accumulators')
     */
    async verifyTradeTypeSelectedInPicker(tradeType: string): Promise<void> {
        await expect(
            this.tradeTypeNavItem(tradeType),
            `${tradeType} should become the selected trade-type tab/sidebar item`
        ).toHaveAttribute(this.isMobile ? 'aria-selected' : 'aria-pressed', 'true');
    }

    /**
     * Verify Add-market's blocked-at-cap behavior, taps/hovers it, and asserts the resulting
     * platform-specific outcome. Desktop sets the real HTML `disabled` attribute (button is
     * inert; hover reveals a tooltip). Mobile only sets `aria-disabled` — confirmed live the
     * button remains genuinely tappable by a real user, so this force-clicks it (Playwright's
     * own actionability check otherwise treats `aria-disabled="true"` as not-enabled and hangs)
     * and expects a dismissible snackbar instead, with the picker staying closed.
     *
     * @param max - The platform's cap (from {@link maxOpenMarkets}), embedded in the expected
     *   snackbar/tooltip text (e.g. "up to 4 tabs").
     */
    async verifyAddMarketBlockedAtCap(max: number): Promise<void> {
        const capMessage = `You can open up to ${max} tabs at a time. Close one to add another.`;

        if (this.isMobile) {
            await this.addMarketButton.click({ force: true });
            await expect(
                this.page.getByText(capMessage),
                'Mobile should show a dismissible snackbar explaining the cap'
            ).toBeVisible();
            await expect(
                this.marketSelectionPanel,
                'The picker should NOT open while at the mobile cap'
            ).not.toBeVisible();
        } else {
            await expect(
                this.addMarketButton,
                'Desktop should set the real HTML disabled attribute at the cap'
            ).toBeDisabled();
            await this.addMarketButton.hover();
            await expect(
                this.page.getByText(capMessage),
                'Desktop should show a tooltip explaining the cap'
            ).toBeVisible();
        }
    }
}
