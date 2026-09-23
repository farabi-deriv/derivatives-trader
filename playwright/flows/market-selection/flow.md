# 📋 Market Selection & Trade Tabs Journey Spec — What to Test

**Analysis date:** 2026-08-06

---

## Section 1 — Shared Step Pattern

### Open Market Selection Steps

> Referenced by every flow below except the Tab-strip-only flows (Flows 14–24), which start from an
> already-open picker or an already-populated tab strip.

**Prerequisites:** On the trade page, at least one tab open (always true — the app never has zero tabs).

| #   | Step                  | Action                                             | Expected Result                                                                                                                                                                                                                                                              | Platform |
| --- | --------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Open picker (new tab) | Click the "Add market" (+) button on the tab strip | Mobile: full-screen dialog (`role="dialog"`, `aria-label="Market selection"`). Desktop: popover anchored below the strip (`.market-selection-desktop`). Both default straight into the flat category list, scoped to the first available category for the current trade type | Both     |
| 1b  | Open picker (replace) | Click the already-active tab                       | Same picker opens; selecting a market here REPLACES the active tab in place instead of adding a new one                                                                                                                                                                      | Both     |

> **Chevron affordance (added 2026-08-17).** The active tab advertises step 1b: a `chevron-down`
> renders inline after the trade-type text on its subtitle row (`[data-testid="dt_market_tab_chevron"]`,
> `aria-hidden="true"` — decorative, the whole tab stays the tap target). Only the ACTIVE tab has it;
> inactive and disabled tabs do not, because their tap does not open the picker. Nor does the active
> tab while the strip is locked by a running automation (Automate view) — there its tap only raises the
> "Tab switching is locked until automation is stopped." snackbar, so the cue is withheld too. The same affordance
> is exposed to assistive tech on the tab root: `aria-haspopup="dialog"` plus an `aria-label` naming
> the action and carrying both values (e.g. `Change market and trade type: EUR/USD, Rise/Fall`).
> Note the `aria-label` overrides the tab's accessible name — locate tabs by `data-testid` /
> `aria-current` / visible text (as `MarketSelectionPage` already does), never by accessible name.
>
> **P/L separator (revised 2026-08-18, issue #1168).** When the active tab has open positions, the
> chevron is divided from the inline P/L amount by a 1×12px vertical rule
> (`[data-testid="dt_market_tab_profit_separator"]`, `aria-hidden="true"`), so the row reads
> `Rise/Fall ⌄ | +$12.98` — matching Figma. It replaces the `•` glyph that shipped originally, and it is
> drawn in CSS, so it adds no text content: the divider never appears in `textContent`/`hasText`
> locators. It renders only alongside the amount — desktop only, and only with a position running, so a
> tab with no open positions shows no orphaned divider.

---

## Section 2 — Per-Flow Sections

### Flow 1 — Add market opens the picker as a new-tab flow

Follows [Open Market Selection Steps](#open-market-selection-steps) step 1.

| #   | Step                         | Action                                                          | Expected Result                                                                                                                                            | Platform |
| --- | ---------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Note current tab count       | Read the number of tabs (`dt_market_tab` elements) on the strip | Baseline count captured                                                                                                                                    | Both     |
| 2   | Open picker via Add market   | Click the "Add market" (+) button                               | Picker opens directly into the flat category list — the first available category for the current trade type is auto-selected, no discovery/Featured screen | Both     |
| 3   | Select a market + trade type | Search for and select a market not already open as a tab        | Picker closes; a NEW tab is appended (tab count = baseline + 1); new tab becomes active; URL `symbol`/`trade_type` query params update                     | Both     |

### Flow 2 — Clicking the active tab replaces it instead of adding a new one

Follows [Open Market Selection Steps](#open-market-selection-steps) step 1b.

| #   | Step                           | Action                                          | Expected Result                                                                                                                               | Platform |
| --- | ------------------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Note current tab count         | Read the number of open tabs                    | Baseline count captured                                                                                                                       | Both     |
| 2   | Click the currently active tab | Click the tab that is already active            | The active tab shows the chevron cue on its trade-type row before the click; picker opens (same picker as Flow 1)                             | Both     |
| 3   | Select a different market      | Search for and select a market not already open | Picker closes; the PREVIOUSLY ACTIVE tab is replaced IN PLACE with the new market — tab count is unchanged (still baseline), not baseline + 1 | Both     |

### Flow 3 — Trade-type navigation lists the same set on both platforms

| #   | Step                          | Action                                                             | Expected Result                                                                                                                                                                                                                                        | Platform |
| --- | ----------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1   | Open the picker               | Follow [Open Market Selection Steps](#open-market-selection-steps) | Picker opens                                                                                                                                                                                                                                           | Both     |
| 2   | Observe trade-type navigation | Read the trade-type controls                                       | Mobile: horizontal `role="tablist"` strip of `role="tab"` buttons, leading with `Favourite ({{count}})`. Desktop: left sidebar grouped under `Directional` / `Growth based` / `Digit based` headers, with `Favourite ({{count}})` pinned at the bottom | Both     |
| 3   | Compare the trade-type set    | Collect the trade-type labels shown on each platform               | Same set of trade types appears on both — no type present on one platform and missing on the other                                                                                                                                                     | Both     |

### Flow 4 — Switching trade type reloads the market list to only tradeable symbols

| #   | Step                                | Action                                                                                                | Expected Result                                                                                                                                | Platform |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Open the picker                     | Follow [Open Market Selection Steps](#open-market-selection-steps)                                    | Picker opens on the default trade type                                                                                                         | Both     |
| 2   | Select "Accumulators"               | Mobile: tap the "Accumulators" tab. Desktop: click "Accumulators" in the sidebar's Growth based group | Market list reloads to show only markets tradeable under Accumulators (server-filtered via `active_symbols` `contract_type`)                   | Both     |
| 3   | Confirm closed markets still render | Observe any Accumulators-tradeable market that is currently outside trading hours                     | It IS shown in the list (not hidden) with a "CLOSED" tag — the filter scopes by trade-type tradeability only, not by open/closed session state | Both     |

### Flow 5 — Asset-class category filter chips scope the list

| #   | Step                        | Action                                                             | Expected Result                                                                                                         | Platform |
| --- | --------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Open the picker             | Follow [Open Market Selection Steps](#open-market-selection-steps) | Picker opens with the first available category (e.g. "Derived") selected by default — no Featured chip exists           | Both     |
| 2   | Select the "Forex" chip     | Click/tap the "Forex" category chip                                | List reloads to show only Forex markets (`symbol.market === 'forex'`); category chips row stays visible                 | Both     |
| 3   | Select a different category | Click/tap another category chip (e.g. "Derived")                   | List reloads again to that category's markets — there is no "reset"/default chip to return to, every category is a peer | Both     |

> Available category chips: `Derived`, `Forex`, `Stocks & indices`, `Cryptocurrencies`, `Commodities` —
> derived from `packages/trader/src/AppV2/Utils/market-selection-utils.ts`. `Featured` no longer exists
> as of master PR #974 (2026-08-06) — the redesign test plan's original list included it, and also
> omitted `Cryptocurrencies`, which does exist as a chip when the trade type offers crypto symbols.

### Flow 6 — Time-window dropdown is always present in the category list

> **Correction 2026-08-06:** since Featured/Discovery no longer exists, EVERY browse view (except the
> Favourites tab) is now the category list — so the "Changes ({window})" dropdown is present as soon as
> the picker opens, not gated behind selecting a "non-Featured" chip as previously documented.

| #   | Step                        | Action                                                             | Expected Result                                                                                                    | Platform |
| --- | --------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | -------- |
| 1   | Open the picker             | Follow [Open Market Selection Steps](#open-market-selection-steps) | Picker opens; first group header already shows a "Changes (5 minutes)" dropdown trigger, with no prior interaction | Both     |
| 2   | Open the dropdown           | Click/tap the "Changes (5 minutes)" trigger                        | Desktop: anchored popover with `role="listbox"` options. Mobile: bottom ActionSheet titled "Change period"         | Both     |
| 3   | Select a longer window      | Select "15 minutes"                                                | Dropdown trigger label updates to "Changes (15 minutes)"; row % changes reload for the new window                  | Both     |
| 4   | Switch to the Favourite tab | Click/tap the "Favourite ({{count}})" tab/sidebar item             | The dropdown is NOT present — `MarketFavouritesView` never wires a window selector, unlike every category list     | Both     |

### Flow 7 — Market Info screen

**Spec:** `market-selection/verify-market-info-screen.spec.ts` — three tests; steps 3–6 map to the first test (descriptions matrix + Trade-on CTA), a dedicated favourite test, and a dedicated Back test.

| #   | Step                       | Action                                                                                                                                                      | Expected Result                                                                                                                                                                                                                       | Platform |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Open the picker            | Follow [Open Market Selection Steps](#open-market-selection-steps)                                                                                          | Picker opens                                                                                                                                                                                                                          | Both     |
| 2   | Tap/click the Info icon    | Click the info icon (`aria-label="Info"`) on any market card or row                                                                                         | Market info screen opens IN PLACE of the browse panel (desktop: same popover footprint; mobile: same full-screen dialog) — market selection is not fully exited                                                                       | Both     |
| 3   | Verify description copy    | Search each market in `market-info-description-cases.ts` (75 symbols); open Info from the **first** matching search row; assert `.market-info__description` | Each symbol's authored copy from `packages/trader/src/AppV2/Utils/market-descriptions.ts` renders (regression for #1029 and the full description sheet). Paced at 800ms between lookups; retries once after a staging rate-limit page | Both     |
| 4   | Verify Trade-on section    | Re-open Info for Volatility 100 Index; read "Trade on"                                                                                                      | Section lists trade types; Multipliers CTA visible for a synthetic index                                                                                                                                                              | Both     |
| 5   | Select a "Trade on" CTA    | Click the Multipliers card under "Trade on"                                                                                                                 | Commits the symbol under that trade type and closes the whole picker — active tab shows Volatility 100 Index + Multipliers                                                                                                            | Both     |
| 6   | Toggle Favourite from Info | Click the Favourite button on the Info screen (`aria-label="Favourite"`/`"Unfavourite"`)                                                                    | Icon and label toggle between star-outline "Favourite" and filled-star "Unfavourite"; toggled back to clean up                                                                                                                        | Both     |
| 7   | Back out of Info           | Click the Back button (`aria-label="Back"`) instead of a Trade-on CTA                                                                                       | Returns to the browse panel/modal; picker stays open; active tab unchanged                                                                                                                                                            | Both     |

### Flow 8 — Search by market name

| #   | Step               | Action                                                                                           | Expected Result                                                                                                                                                                            | Platform |
| --- | ------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1   | Open the picker    | Follow [Open Market Selection Steps](#open-market-selection-steps)                               | Picker opens                                                                                                                                                                               | Both     |
| 2   | Open search        | Desktop: the search field is already inline. Mobile: tap the Search icon (`aria-label="Search"`) | Desktop: nothing further needed. Mobile: dedicated full-screen search page opens with a back "Cancel" control and an autofocused field                                                     | Both     |
| 3   | Type a market name | Type "Volatility" into the search field                                                          | Results render grouped by trade type — each trade type that has a tradeable match gets its own header, split into submarket sections; a symbol can appear under multiple trade-type groups | Both     |
| 4   | Select a result    | Click a row under one of the trade-type groups                                                   | Commits BOTH the symbol and that group's trade type; picker closes                                                                                                                         | Both     |

### Flow 9 — Search with no matches

| #   | Step                  | Action                                               | Expected Result                                                                                                                                     | Platform |
| --- | --------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Open search           | Follow Flow 8 steps 1–2                              | Search field is ready                                                                                                                               | Both     |
| 2   | Type a nonsense query | Type a string matching no market (e.g. "zzznotreal") | Empty-results illustration + "No result found" title + "Check your spelling or try searching for a different market." description — no error thrown | Both     |

### Flow 10 — Favourite toggle from the browse list

| #   | Step                         | Action                                                                       | Expected Result                                                                                                         | Platform |
| --- | ---------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Open the picker              | Follow [Open Market Selection Steps](#open-market-selection-steps)           | Picker opens                                                                                                            | Both     |
| 2   | Reveal the Favourite action  | Desktop: actions are always visible on the row. Mobile: swipe the row left   | Desktop: Info + Favourite (star) buttons visible inline. Mobile: swipe reveals Info + Favourite buttons                 | Both     |
| 3   | Tap/click the Favourite star | Click the Favourite button (`aria-label="Favourite"`)                        | Star fills in (`aria-label` flips to "Unfavourite"); the "Favourite ({{count}})" tab/sidebar-item label increments by 1 | Both     |
| 4   | Open the Favourite tab       | Click "Favourite ({{count}})" (tab strip on mobile, sidebar item on desktop) | The just-favourited market appears, grouped under its trade type and submarket                                          | Both     |
| 5   | Unfavourite                  | Click the star again (now `aria-label="Unfavourite"`)                        | Market disappears from the Favourite tab; count decrements by 1                                                         | Both     |

### Flow 11 — Favourites persist across a page reload

| #   | Step                     | Action                                      | Expected Result                                     | Platform |
| --- | ------------------------ | ------------------------------------------- | --------------------------------------------------- | -------- |
| 1   | Favourite a market       | Follow Flow 10 steps 1–3                    | Market is favourited; count updates                 | Both     |
| 2   | Reload the page          | Reload `https://staging-dtrader.deriv.com/` | Page reloads; API/WebSocket settles                 | Both     |
| 3   | Reopen the Favourite tab | Follow Flow 10 step 4                       | The favourited market is still present after reload | Both     |

### Flow 12 — Guide affordance opens the trade-type description modal

| #   | Step                               | Action                                                                                        | Expected Result                                                                                                                             | Platform |
| --- | ---------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Open the picker                    | Follow [Open Market Selection Steps](#open-market-selection-steps)                            | Picker opens                                                                                                                                | Both     |
| 2   | Tap/click the Guide icon           | Mobile: tap the Guide icon in the header. Desktop: click the Guide icon in the sidebar header | A description modal opens explaining "how to trade" the currently-selected trade type, with chips to switch between trade types             | Both     |
| 3   | Switch trade type inside the Guide | Select a different trade-type chip inside the modal                                           | Modal content updates to that trade type's description — does not close the modal or affect the underlying picker's own selected trade type | Both     |

### Flow 13 — Close without selecting

| #   | Step                    | Action                                                                                      | Expected Result                                                                | Platform |
| --- | ----------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------- |
| 1   | Note the active tab     | Read the currently active tab's market + trade type                                         | Baseline captured                                                              | Both     |
| 2   | Open the picker         | Follow [Open Market Selection Steps](#open-market-selection-steps) step 1                   | Picker opens                                                                   | Both     |
| 3   | Close without selecting | Click the Close (`aria-label="Close"`) icon (mobile) or click outside the popover (desktop) | Picker closes; the previously active tab/market is unchanged from the baseline | Both     |

### Flow 14 — Switch between existing tabs

**Prerequisites:** At least two tabs already open (e.g. via Flow 1 twice with different markets).

| #   | Step                   | Action                              | Expected Result                                                                                                                                         | Platform |
| --- | ---------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Note both tabs' state  | Read each tab's market + trade type | Baseline captured for Tab A (active) and Tab B (inactive)                                                                                               | Both     |
| 2   | Click the inactive tab | Click Tab B                         | Tab B becomes active (`aria-current="true"`); URL `symbol`/`trade_type` query params update to Tab B's pair; trade form/chart reload for Tab B's market | Both     |
| 3   | Click back to Tab A    | Click Tab A                         | Tab A becomes active again; its (symbol, contract_type) pair is exactly as it was at step 1 — no drift from having visited Tab B                        | Both     |

### Flow 15 — Re-selecting an already-open pair focuses the existing tab

**Prerequisites:** A tab for (market, trade type) already open and NOT active.

| #   | Step                         | Action                                                                          | Expected Result                                                                                | Platform |
| --- | ---------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- |
| 1   | Note current tab count       | Read the number of open tabs                                                    | Baseline count captured                                                                        | Both     |
| 2   | Open picker via Add market   | Click "Add market"                                                              | Picker opens                                                                                   | Both     |
| 3   | Select the already-open pair | Search for and select the exact (market, trade type) pair already open as a tab | Picker closes; that existing tab becomes active; tab count is UNCHANGED (no duplicate created) | Both     |

### Flow 16 — Same market, different trade type are independent tabs

| #   | Step                                              | Action                                                                | Expected Result                                                                                                                                   | Platform |
| --- | ------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Open a market under Rise/Fall                     | Follow Flow 1 with e.g. 'Volatility 100 Index' + 'Rise/Fall'          | New tab created and active                                                                                                                        | Both     |
| 2   | Open the SAME market under a different trade type | Follow Flow 1 (Add market) with the SAME market + e.g. 'Accumulators' | A SECOND, independent tab is created (not merged with step 1's tab) — both tabs show the same market icon/name but different trade-type subtitles | Both     |
| 3   | Switch between both                               | Click each tab in turn                                                | Each activates independently; no cross-contamination of trade type between them                                                                   | Both     |

### Flow 17 — Remove a non-active tab

**Prerequisites:** At least two tabs open.

| #   | Step                            | Action                                                                                                                                                                    | Expected Result                                                                              | Platform |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------- |
| 1   | Reveal the close control        | Desktop: hover the non-active tab. Mobile: has no hover state and the non-active tab's × sits behind its own content until activated, so tap the tab first to activate it | Close (×) control (`aria-label="Remove market"`) becomes visible/tappable for the target tab | Both     |
| 2   | Click the × on a non-active tab | Click the Remove button on a tab that is NOT active                                                                                                                       | That tab closes; the active tab and all other tabs are unaffected; tab count decreases by 1  | Both     |

### Flow 18 — Remove the active tab falls back to an adjacent tab

**Prerequisites:** At least two tabs open, one of them active.

| #   | Step                  | Action                                          | Expected Result                                                                                                                                                                                    | Platform |
| --- | --------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Note tab order        | Read the order of open tabs and which is active | Baseline captured                                                                                                                                                                                  | Both     |
| 2   | Remove the active tab | Click the × on the currently active tab         | That tab closes; the tab immediately to its RIGHT becomes active (or, if the closed tab was last, the tab immediately to its LEFT becomes active) — never leaves the trade page with no active tab | Both     |

### Flow 19 — Remove the last remaining tab is blocked

**Prerequisites:** Exactly one tab open.

| #   | Step                     | Action                                            | Expected Result                                                                           | Platform |
| --- | ------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------- |
| 1   | Reduce to a single tab   | Remove tabs (per Flow 17/18) until only 1 remains | One tab remains, active                                                                   | Both     |
| 2   | Look for a close control | Hover (desktop) or inspect (mobile) the sole tab  | NO close (×) control renders at all — removal is fully blocked, even via hover on desktop | Both     |

### Flow 20 — Tab strip scroll and active/inactive tab sizing

**Prerequisites:** Enough tabs open to overflow the visible strip width (e.g. at the platform's max — see Flow 24).

> Viewport split: mobile scrolls the strip horizontally (`overflow-x: auto`); desktop is
> Chrome-style — tabs shrink to fit (`overflow: visible`), no scroll. Steps 2–3 are therefore
> mobile-only; desktop achieves the same "everything visible" goal by shrinking/ellipsising tabs.

| #   | Step                   | Action                                   | Expected Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Platform |
| --- | ---------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Observe collapsed tabs | Look at inactive tabs when many are open | Inactive tabs render compact (icon-first); the ACTIVE tab alone expands to show its full market name + trade-type subtitle — and its chevron cue. As tabs shrink on desktop each line of the label truncates as one text flow, so a shrunken tab keeps its trade-type text (ellipsised only if the text alone overflows) and drops the trailing chevron and inline P/L — matching production, and never showing a one-character trade type beside a whole P/L amount. Nothing on that row paints over the strip or a neighbouring tab past 4 tabs (issue #1175). The active tab never shrinks, so it keeps both cue and amount in full | Both     |
| 2   | Scroll the strip       | Scroll/swipe the tab list horizontally   | Strip scrolls; at the platform's cap it overflows the visible width (`scrollWidth > clientWidth`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Mobile   |
| 3   | Activate an edge tab   | Click a tab near the scrolled-away edge  | Strip auto-scrolls (a tweened `scrollIntoView` driven on activation) to bring the newly-active tab fully into view as it expands                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Mobile   |

### Flow 21 — Tabs persist across page reload

**Prerequisites:** At least two tabs open, e.g. 'Volatility 100 Index' (Rise/Fall) + 'Bull Market Index' (Rise/Fall).

| #   | Step                   | Action                                      | Expected Result                                                                                | Platform |
| --- | ---------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- |
| 1   | Note tabs + active one | Read the open tabs and which is active      | Baseline captured                                                                              | Both     |
| 2   | Reload the page        | Reload `https://staging-dtrader.deriv.com/` | Page reloads; API/WebSocket settles                                                            | Both     |
| 3   | Verify tabs restored   | Read the open tabs and active tab again     | Same tabs (same symbols + trade types, same order) and the same active tab are restored intact | Both     |

### Flow 22 — Buy always targets the active tab's pair

**Prerequisites:** Logged-in account (`TEST_EMAIL_TRADE_TABS` / `TEST_EMAIL_TRADE_TABS_MOBILE` in `playwright/.env.staging`) with sufficient balance.

> The contract type is **Accumulators** (not Rise/Fall) so the contract auto-closes once the
> barrier is hit — no manual close step is needed. `settleAccumulatorContract({ waitForAutoSettle: true })`
> waits for the barrier to close it, falling back to a manual close if it hasn't triggered in time.

| #   | Step                                 | Action                                                                                                         | Expected Result                                                                                                                          | Platform |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Open a distractor tab                | `selectMarketAndTradeType('Bull Market Index', 'Rise/Fall', { openInNewTab: true })`                           | A second tab opens and becomes active; its balance/positions must NOT change                                                             | Both     |
| 2   | Buy an Accumulator on the active tab | `buyAccumulatorOnActiveTabAndVerify({ market: 'Volatility 100 Index', growthRate: '5%', stake: '5.00', ... })` | The active tab's stake is deducted exactly — proving the ACTIVE tab's (symbol, contract_type) pair was purchased, not the distractor tab | Both     |
| 3   | Settle the accumulator               | `settleAccumulatorContract({ waitForAutoSettle: true })`                                                       | The contract closes (barrier auto-close, with manual-close fallback); no open contract is left behind                                    | Both     |

### Flow 23 — Tab icon reflects its own market

**Prerequisites:** At least three tabs open across visibly different symbol categories (e.g. a Volatility index, a Jump index, and a forex pair like 'EUR/USD').

| #   | Step              | Action                                  | Expected Result                                                                                                                                                              | Platform |
| --- | ----------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Compare tab icons | Read the icon rendered on each open tab | Each tab's icon matches its own symbol (e.g. the forex tab shows a flag icon distinct from the two index tabs' icons) — never a shared/generic icon across different symbols | Both     |

### Flow 24 — Max tab limit enforced (4 on mobile, 7 on desktop)

**Prerequisites:** Open tabs up to the platform's cap (4 on mobile, 7 on desktop) via repeated Flow 1.

> **Correction vs the original test plan:** the redesign's caps are 4 (mobile) / 7 (desktop) BY DESIGN
> (`getMaxOpenMarkets`, `packages/trader/src/AppV2/Utils/open-markets-utils.ts` — unchanged since the
> initial redesign PR, with a dedicated Jest test asserting both values). This is the final, intended
> behavior — desktop is not "failing" to enforce a 4-tab cap; it enforces its own, larger cap correctly.

| #   | Step                               | Action                                                               | Expected Result                                                                                                                                                                              | Platform |
| --- | ---------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Reach the cap                      | Open tabs until the platform's cap is reached (4 mobile / 7 desktop) | The "Add market" button becomes disabled: desktop sets the HTML `disabled` attribute (button unclickable, hover reveals a tooltip); mobile sets `aria-disabled` only (button stays tappable) | Both     |
| 2   | Attempt to open one more (desktop) | Hover the disabled Add-market button                                 | Tooltip reads "You can open up to 7 tabs at a time. Close one to add another."                                                                                                               | Desktop  |
| 2   | Attempt to open one more (mobile)  | Tap the Add-market button                                            | A dismissible snackbar reads "You can open up to 4 tabs at a time. Close one to add another." and the modal does NOT open                                                                    | Mobile   |
| 3   | Recover after closing one          | Close any one tab, then click "Add market" again                     | Button is enabled again; the picker opens and a new tab can be added, bringing the count back to the cap                                                                                     | Both     |

---

### Flow 25 — Trade params persist per tab across reload

> Covers feature #1186. Replaces the former G1 backlog (which documented the _pre-#1186_ behaviour that params were **not** tab-scoped).

**Prerequisites:** Trade page loaded. Two distinct always-open markets that support Rise/Fall.
**Spec:** `playwright/tests/market-selection/verify-trade-tabs-param-persistence.spec.ts`

| #   | Step                          | Action                                                                                | Expected Result                                                        | Platform |
| --- | ----------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------- |
| 1   | Set stake + duration on tab A | Volatility 100 Rise/Fall → `setStake('25.00')` → `selectDuration('Minutes', '5 min')` | Collapsed stake shows 25; duration shows `5 min` / `5 minutes`         | Both     |
| 2   | Reload tab A                  | `verifyStakeAndDurationPersistAcrossReload`                                           | Tab A stake/duration restore from `tab_trade_params_v2`                | Both     |
| 3   | Open tab B                    | Add Bull Market Index Rise/Fall                                                       | New tab does **not** inherit tab A's stake/duration                    | Both     |
| 4   | Set stake + duration on tab B | `setStake('35.00')` → `selectDuration('Minutes', '10 min')` → reload                  | Tab B values persist; Bull Market remains the active tab               | Both     |
| 5   | Switch back to tab A          | Activate Volatility 100 Rise/Fall                                                     | Tab A still shows 25 + `5 min` — tab B edits did **not** rewrite tab A | Both     |
| 6   | Switch back to tab B          | Activate Bull Market Index Rise/Fall                                                  | Tab B still shows 35 + `10 min`                                        | Both     |

> **POM:** `setStake` · `selectDuration` · `verifyStakeAndDurationPersistAcrossReload` (reads + sanity-checks + reload restore; returns committed labels) · `expectCommittedStakeAndDuration` (`differs: true` for sibling isolation) · `switchToMarketTab`.

---

### Flow 26 — Active tab's chevron cue marks it as the picker trigger

**Prerequisites:** Two tabs open (any market + trade type). Unauthenticated — pure tab-strip mechanics.
**Spec:** `playwright/tests/market-selection/verify-trade-tabs.spec.ts`

> Promoted from G2 cases 1–4 on 2026-09-23 (automated in `verify-trade-tabs.spec.ts`). Cases 5–6
> (locked strip, P/L divider) remain gap **G2** below — they need a running automation run / an
> open position.

| #   | Step                             | Action                                                              | Expected Result                                                                                                                                  | Platform |
| --- | -------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1   | Active tab carries the cue       | Read the active tab (`[aria-current="true"]`)                       | It contains `dt_market_tab_chevron`, and the tab root has `aria-haspopup="dialog"` and an `aria-label` naming both the market and the trade type | Both     |
| 2   | Inactive tabs lack the cue       | Read every non-`aria-current` tab                                   | None contains `dt_market_tab_chevron`; none has `aria-haspopup` or `aria-label` — their tap only activates them                                  | Both     |
| 3   | The cue moves with activation    | Click an inactive tab to activate it                                | The chevron and affordance leave the previously-active tab and appear on the newly-active one                                                    | Both     |
| 4   | Tapping the cue opens the picker | Click the active tab (the cue's tab — the cue itself is decorative) | The picker opens exactly as any tap on that tab does (Flow 2) — no duplicate action fires from the chevron                                       | Both     |

---

## Gap Flows

> These are test cases for coverage gaps. The proposed spec file for each gap is in [`coverage.md`](./coverage.md).

### G2 — Cue withheld on the locked strip + cue/P/L divider

> The old G2's cases 1–4 (active/inactive cue split, cue movement, tap-opens-picker) were promoted
> to **Flow 26** and automated on 2026-09-23. What remains needs heavier setup: a running
> automation run (case 1) and an open position (case 2).

| #   | Test case                        | Steps                                                                                   | Expected Result                                                                                                                                                                                                           |
| --- | -------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Locked strip withholds the cue   | In the Automate view, start a run, then read the active (running) tab                   | It stays `aria-current="true"` with its highlight and live P/L, but contains no `dt_market_tab_chevron` and has no `aria-haspopup`/`aria-label` — its tap only raises the "locked until automation is stopped" snackbar   |
| 2   | Divider sits between cue and P/L | On desktop, read the active tab with a position running, then close/expire the position | With a position: the tab contains `[data-testid="dt_market_tab_profit_separator"]` between `dt_market_tab_chevron` and the P/L amount, and the tab's text still contains no `•`. Without one: no separator element at all |

> **Framing correction vs the original test plan:** the manual test run (`06-multiple-trade-tabs.md`,
> TABS-03) originally framed param isolation as a "Stake persistence bug." #1186 shipped tab-scoped
> params in `sessionStorage` (`tab_trade_params_v2`) — that journey is now **Flow 25**. G1 is removed.
