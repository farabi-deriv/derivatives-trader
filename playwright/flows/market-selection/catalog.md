# 🗺️ Market Selection & Trade Tabs Journey Catalog — Technical Reference

> Source of truth: `playwright/pages/MarketSelectionPage.ts` (picker + tab strip; composed into
> `playwright/pages/TradeParametersPage.ts` via `tradeParametersPage.marketSelectionPage` — see Section 4)
> Source components: `packages/trader/src/AppV2/Components/MarketSelection/`, `packages/trader/src/AppV2/Components/MarketTabs/`
> Last updated: 2026-09-15

---

## Section 1 — Journey Index

| Journey ID | Spec File | Tags |
| --- | --- | --- |
| Flow 1–6, 12, 13 | `market-selection/verify-market-browse-and-discovery.spec.ts` | `@market-selection @desktop @mobile` |
| Flow 7 | `market-selection/verify-market-info-screen.spec.ts` | `@market-selection @desktop @mobile` |
| Flow 8, 9 | `market-selection/verify-market-search.spec.ts` | `@market-selection @smoke @production @desktop @mobile` |
| Flow 10 | `market-selection/verify-market-favourites.spec.ts` | `@market-selection @desktop @mobile` |
| Flow 11 | `market-selection/verify-market-favourites.spec.ts` | `@market-selection @desktop @mobile` |
| Flow 14–20, 23, 26 | `market-selection/verify-trade-tabs.spec.ts` | `@market-selection @smoke @desktop @mobile` |
| Flow 21 | `market-selection/verify-trade-tabs-persistence.spec.ts` | `@market-selection @desktop @mobile` |
| Flow 22 | `market-selection/verify-trade-tabs-buy.spec.ts` | `@market-selection @trade @regression @desktop @mobile` |
| Flow 24 | `market-selection/verify-trade-tabs-max-limit.spec.ts` | `@market-selection @smoke @production @desktop @mobile` |
| Flow 25 | `market-selection/verify-trade-tabs-param-persistence.spec.ts` | `@market-selection @desktop @mobile` |
| G2 | Not automated — see [`coverage.md`](./coverage.md) | — |

---

## Section 2 — Flow Details

> Spec `verify-market-browse-and-discovery.spec.ts` uses `test.describe.configure({ mode: 'serial' })`
> so its tests run one after another (avoids parallel picker launches stampeding staging).

### Flows 1, 2, 13 — Open picker (new tab vs. replace), close without selecting

> **Combined 2026-08-06** into one `test()` block (`'VERIFY market commit mechanics — new tab, replace
active tab, and close without selecting'`) as three sequential parts, each continuing from the
> previous part's resulting tab state.

**Test pattern:**

```typescript
// Flow 1 — Add market → new tab
const tabCountBefore = await tradeParametersPage.marketTabs.count();
await tradeParametersPage.addMarketButton.click();
await expect(tradeParametersPage.marketSelectionPanel, 'Picker should open').toBeVisible();
await tradeParametersPage.selectMarketAndTradeType('Jump 75 Index', 'Rise/Fall'); // reuses existing method
await expect(tradeParametersPage.marketTabs, 'A new tab should be appended').toHaveCount(tabCountBefore + 1);
await expect(tradeParametersPage.activeMarketTab, 'New tab should be active').toContainText('Jump 75 Index');

// Flow 2 — click active tab → replace
const tabCountBefore2 = await tradeParametersPage.marketTabs.count();
await tradeParametersPage.activeMarketTab.click(); // NOT addMarketButton
await expect(tradeParametersPage.marketSelectionPanel, 'Picker should open').toBeVisible();
await tradeParametersPage.selectMarketAndTradeType('EUR/USD', 'Rise/Fall');
await expect(tradeParametersPage.marketTabs, 'Tab count should be unchanged (replaced, not added)').toHaveCount(
    tabCountBefore2
);
```

### Flows 3–4 — Trade-type navigation and switching

> **Combined 2026-08-06**, along with Flow 5, Flow 6, and Flow 12 below, into one `test()` block
> (`'VERIFY picker browsing — trade types, category chips, time window, and Guide'`) as five sequential
> parts, run in the non-numeric order 3 → 5 → 6 → 4 → 12 — Flow 5's category-chip check assumes
> Rise/Fall's default category, so it must run before Flow 4 switches the trade type away from
> Rise/Fall.

```typescript
await tradeParametersPage.addMarketButton.click();
await expect(tradeParametersPage.marketSelectionPanel, 'Picker should open').toBeVisible();

// Flow 3: same set both platforms — desktop sidebar groups, mobile tab strip
const tradeTypeLabels = await tradeParametersPage.tradeTypeNavItems.allTextContents();
expect(tradeTypeLabels, 'Trade-type list should include Accumulators').toContain('Accumulators');

// Flow 4: switching reloads the list to only tradeable symbols
await tradeParametersPage.selectTradeTypeInPicker('Accumulators');
await expect(tradeParametersPage.marketSelectionResultsList, 'List should reload for Accumulators').toBeVisible();
```

### Flow 5 — Asset-class category filter

> Combined 2026-08-06 into the same test as Flows 3, 6, 4, 12 — see the note above.
> Extended for #994 — after returning to Derived, assert curated submarket heading order.

```typescript
await marketSelectionPage.selectMarketCategory('Forex');
// Confirmed live: Quill's Chip.Selectable exposes `data-state="selected"`, not `aria-selected`.
await expect(marketSelectionPage.marketCategoryChip('Forex'), 'Forex chip should be selected').toHaveAttribute(
    'data-state',
    'selected'
);
await marketSelectionPage.selectMarketCategory('Derived');
await marketSelectionPage.verifyDerivedSubmarketOrder(); // Volatility → Step → Jump → Crash/Boom → Daily reset
```

### Flow 6 — Time-window dropdown is always present

> Combined 2026-08-06 into the same test as Flows 3, 5, 4, 12 — see the note above.

```typescript
// No prior category click needed — the dropdown is present as soon as the picker opens, because
// the picker now ALWAYS lands in the category list view.
await expect(
    tradeParametersPage.marketChangesDropdownTrigger,
    'Changes dropdown should be visible by default'
).toBeVisible();
await tradeParametersPage.marketChangesDropdownTrigger.click();
await tradeParametersPage.marketChangesDropdownOption('15 minutes').click();
await expect(tradeParametersPage.marketChangesDropdownTrigger, 'Trigger should show the new window').toContainText(
    '15 minutes'
);

// The dropdown is absent only on the Favourite tab.
await tradeParametersPage.favouritesTab.click();
await expect(
    tradeParametersPage.marketChangesDropdownTrigger,
    'Changes dropdown should not appear on Favourites'
).not.toBeVisible();
```

### `verify-market-info-screen.spec.ts` — Flow 7

**Tags:** `@market-selection @desktop @mobile` — unauthenticated (public trade page).

| Test | Flow steps |
| --- | --- |
| `VERIFY Info screen shows market details and a Trade-on CTA commits the market` | 3–5 (description matrix + Trade-on CTA) |
| `VERIFY the Favourite toggle on the Info screen updates independently of the row` | 6 |
| `VERIFY the Back button returns to the previous browse view without committing` | 7 |

**Description matrix** — spec loops `MARKET_INFO_DESCRIPTION_CASES` (75 rows mirroring `market-descriptions.ts`) with one `test.step` per symbol. `MarketSelectionPage.verifyMarketInfoDescription(market, description)` opens Info via `openMarketInfoFromSearch` (first matching row; trade-type group is irrelevant) and retries once after `recoverFromRateLimitIfNeeded()` on lookup failure. Paced at 800ms via `paceMarketInfoLookup()` between symbols.

```typescript
// Step 3 — all authored descriptions
await marketSelectionPage.verifyMarketInfoDescription(market, description);

// Steps 4–5 — Trade-on CTA commits market + trade type
await marketSelectionPage.openMarketInfoFromSearch('Volatility 100 Index');
await expect(marketSelectionPage.marketInfoTradeOnCard('Multipliers')).toBeVisible();
await marketSelectionPage.marketInfoTradeOnCard('Multipliers').click();
await expect(tradeParametersPage.activeMarketTab).toContainText('Volatility 100 Index');
await expect(tradeParametersPage.activeMarketTab).toContainText('Multipliers');
```

```typescript
// Step 6 — Favourite toggle on Info screen (cleans up after)
await marketSelectionPage.openMarketInfo('Volatility 100 Index');
await marketSelectionPage.marketInfoFavouriteButton.click();
await expect(marketSelectionPage.marketInfoFavouriteButton).toContainText('Unfavourite');
await marketSelectionPage.marketInfoFavouriteButton.click(); // cleanup
```

```typescript
// Step 7 — Back does not commit
await marketSelectionPage.openMarketInfo('Volatility 100 Index');
await marketSelectionPage.marketInfoBackButton.click();
await expect(marketSelectionPage.marketSelectionPanel).toBeVisible();
await expect(tradeParametersPage.activeMarketTab).toHaveText(activeTabTextBefore);
```

### Flows 8–9 — Search and empty results

```typescript
// Flow 8
if (isMobileViewport) await tradeParametersPage.marketSelectionSearchButton.click();
await tradeParametersPage.marketSearchInput.fill('Volatility');
await tradeParametersPage.marketSearchResultRow('Volatility 100 Index', 'Rise/Fall').click();

// Flow 9
await tradeParametersPage.marketSearchInput.fill('zzznotreal');
await expect(tradeParametersPage.marketEmptyStateTitle, 'Empty state should show "No result found"').toHaveText(
    'No result found'
);
```

### Flows 10–11 — Favourites and persistence

```typescript
// Flow 10 — note: the Favourite tab renders rows under `.market-favourites__group`, NOT
// `.market-search-results__group` — use favouriteMarketRow(), not marketSearchResultRow().
await tradeParametersPage.favouriteButton('Volatility 100 Index').click();
await expect(tradeParametersPage.favouriteButton('Volatility 100 Index'), 'Should flip to Unfavourite').toHaveAttribute(
    'aria-label',
    'Unfavourite'
);
await tradeParametersPage.favouritesTab.click();
await expect(
    tradeParametersPage.favouriteMarketRow('Volatility 100 Index'),
    'Favourited market should appear in the Favourite tab'
).toBeVisible();

// Flow 11 — no login required, favourite_markets_v2 is plain localStorage
await page.reload();
await NavigationUtils.waitForDerivApiSettled(page);
await tradeParametersPage.addMarketButton.click();
await tradeParametersPage.favouritesTab.click();
await expect(
    tradeParametersPage.favouriteMarketRow('Volatility 100 Index'),
    'Favourite should survive reload'
).toBeVisible();
```

### Flows 14–20, 23 — Core tab mechanics

**Account setup:** none — all browsable without login. Flow 22 (Buy) is the only tab-strip flow needing an account.

> Spec `verify-trade-tabs.spec.ts` uses `test.describe.configure({ mode: 'serial' })` so its tests
> run one after another.

> **Combined 2026-08-11** into three `test()` blocks in `verify-trade-tabs.spec.ts`: Flow 14 (switch
> tabs) + Flow 15 (reselect dedup) + Flow 16 (independent trade type) share
> `'VERIFY selecting markets manages tabs correctly...'`; Flow 17 (remove non-active) + Flow 18
> (remove active falls back) + Flow 19 (remove last blocked) share
> `'VERIFY tab removal mechanics...'`; Flow 23 (icons) + Flow 20 (scroll/expand) share
> `'VERIFY tab strip visuals...'`. Two real bugs were fixed during this pass — see the
> 2026-08-11 note in `coverage.md` for details (an already-active-tab click side effect, and an
> Accumulators-incompatible market swapped for Volatility 100 Index).

```typescript
// Flow 14 — switch tabs
await tradeParametersPage.selectMarketAndTradeType('Bull Market Index', 'Rise/Fall', { openInNewTab: true });
await tradeParametersPage.marketTab('Volatility 100 Index', 'Rise/Fall').click();
await expect(tradeParametersPage.activeMarketTab, 'Should switch back to Volatility 100').toContainText(
    'Volatility 100 Index'
);

// Flow 15 — reselect an already-open pair (no duplicate)
const tabCount = await tradeParametersPage.marketTabs.count();
await tradeParametersPage.selectMarketAndTradeType('Bull Market Index', 'Rise/Fall', { openInNewTab: true });
await expect(tradeParametersPage.marketTabs, 'No duplicate tab should be created').toHaveCount(tabCount);

// Flow 16 — same market, different trade type = independent tabs
await tradeParametersPage.selectMarketAndTradeType('Volatility 100 Index', 'Accumulators', { openInNewTab: true });
await expect(tradeParametersPage.marketTabs, 'A second, independent tab should exist').toHaveCount(tabCount + 1);

// Flow 17 — remove a non-active tab (desktop hover)
await tradeParametersPage.marketTab('Bull Market Index', 'Rise/Fall').hover();
await tradeParametersPage.removeMarketTabButton('Bull Market Index', 'Rise/Fall').click();

// Flow 18 — remove the active tab, falls back to adjacent
await tradeParametersPage.activeMarketTab.locator('..').getByRole('button', { name: 'Remove market' }).click();
// Assert fallback via activeMarketTab content — see flow.md for exact left/right rule

// Flow 19 — remove the last tab is blocked
await expect(
    tradeParametersPage.activeMarketTab.getByRole('button', { name: 'Remove market' }),
    'Close control should not render with only one tab'
).not.toBeVisible();

// Flow 20 — scroll + active/inactive sizing. Mobile-only scroll: assert overflow at the cap,
// then click a scrolled-away edge tab and assert the activation-driven auto-scroll brings it into view.
// Desktop: Chrome-style shrinking tabs (no scroll) — assert the active (expanded) tab stays in view.
// Flow 23 — tab icon — assert distinct <svg> presence per tab, or a stable data attribute if one is added
```

### Flow 21 — Tabs persist across reload

```typescript
await tradeParametersPage.selectMarketAndTradeType('Bull Market Index', 'Rise/Fall', { openInNewTab: true });
await page.reload();
await NavigationUtils.waitForDerivApiSettled(page);
await expect(tradeParametersPage.marketTabs, 'Both tabs should be restored').toHaveCount(2);
```

### Flow 22 — Buy targets the active tab

**Account setup:** env-login (no account creation) — uses `TEST_EMAIL_TRADE_TABS` / `TEST_EMAIL_TRADE_TABS_MOBILE` from `playwright/.env.staging`:

```typescript
const isMobile = testInfo.project.name.includes('mobile');
const emailVar = isMobile ? 'TEST_EMAIL_TRADE_TABS_MOBILE' : 'TEST_EMAIL_TRADE_TABS';
const email = process.env[emailVar];
// ...
await loginPage.login(email); // password falls back to process.env.TEST_PASSWORD
```

```typescript
// Buy an Accumulator on the active tab — auto-closes when the barrier is hit (no manual close needed).
await tradeAccumulatorsPage.buyAccumulatorOnActiveTabAndVerify({
    accountType: 'demo', // or 'real'
    market: 'Volatility 100 Index',
    growthRate: '5%',
    stake: '5.00',
    currency: 'USD',
});
// Internally: opens a 'Bull Market Index' (Rise/Fall) distractor tab, then buys the Accumulator on the
// active tab and asserts the balance dropped by exactly the stake — proving the ACTIVE pair was bought.
// settleAccumulatorContract({ waitForAutoSettle: true }) lets the barrier auto-close it (manual fallback).
```

### Flow 24 — Max tab limit (4 mobile / 7 desktop)

```typescript
const max = isMobileViewport ? 4 : 7;
for (let i = 0; i < max - 1; i++) {
    await tradeParametersPage.selectMarketAndTradeType(SOME_UNIQUE_MARKET[i], 'Rise/Fall', { openInNewTab: true });
}
await expect(
    tradeParametersPage.addMarketButton,
    'Add button should be disabled/aria-disabled at the cap'
).toHaveAttribute('aria-disabled', 'true');
if (!isMobileViewport) {
    await expect(tradeParametersPage.addMarketButton, 'Desktop should set the HTML disabled attribute').toBeDisabled();
    await tradeParametersPage.addMarketButton.hover();
    await expect(page.getByText('You can open up to 7 tabs at a time. Close one to add another.')).toBeVisible();
} else {
    await tradeParametersPage.addMarketButton.click(); // still tappable — aria-disabled only
    await expect(page.getByText('You can open up to 4 tabs at a time. Close one to add another.')).toBeVisible();
}
```

---

## Section 3 — Tags Reference

| Tag | When to apply |
| --- | --- |
| `@market-selection` | All tests in this feature area (picker + tab strip) |
| `@trade` | Additionally applied when a flow also exercises Buy (Flow 22) |
| `@smoke` | Critical path — search, core tab mechanics, and max-tab limit (Flows 8–9, 14–20, 23, 24) |
| `@production` | Safe on production — no login, no balance mutation (Flows 8–9, 24 only) |
| `@regression` | Flow 22 only (`verify-trade-tabs-buy.spec.ts` — mutates balance/positions) |
| `@desktop` | Desktop viewport (chromium project) |
| `@mobile` | Mobile viewport (chromium-mobile project) |

> Only search (Flows 8–9) and max-tab limit (Flow 24) carry `@production`. Core tab mechanics (Flows 14–20, 23) are staging smoke only — no `@production` on `verify-trade-tabs.spec.ts`. Flow 22 mutates a real account's balance/positions; discovery/favourites/persistence flows depend on live data that isn't safe to assert deterministically on production.

---

## Section 4 — Feature-Specific Decisions

### `MarketSelectionPage` — composed into `TradeParametersPage`, not inherited

**Updated 2026-08-11** — superseded the original "extend `TradeParametersPage`, no new Page Object"
decision below. The market-selection picker and tab-strip locators/actions grew large enough (30
locators, 8 actions) to warrant their own file, `playwright/pages/MarketSelectionPage.ts`, following
the same composition pattern already used by `TradeRiseFallPage` (which composes `PositionsPage`,
`ReportsPage`, `ContractDetailsPage` rather than inheriting from them). `TradeParametersPage` composes
it via `this.marketSelectionPage = new MarketSelectionPage(page)` in its constructor, and a matching
`marketSelectionPage` fixture is registered in `fixtures.ts`.

`selectMarketAndTradeType()` stays on `TradeParametersPage` despite reaching into the composed page,
because it also asserts trade-_parameter_ locators (`riseButton`, `verifyParamsForTradeType`, etc.)
that belong to that class, not to market selection.

**Impact on generated code:** market-selection/tab-strip interactions go through the
`marketSelectionPage` fixture (e.g. `marketSelectionPage.addMarketButton`,
`marketSelectionPage.removeMarketTab(...)`); trade-parameter interactions and
`selectMarketAndTradeType()` stay on `tradeParametersPage`. Most existing specs destructure both
fixtures side by side.

### (Superseded) No new Page Object — extend `TradeParametersPage`

The market-selection picker and tab strip are both sub-panels of the trade page, and `TradeParametersPage`
(→ `TradeBasePage`) already owns `marketSelectionPanel`, `marketSearchInput`, `marketSearchResultRow`,
`addMarketButton`, and `activeMarketTab`. Per the "one Page Object per route" rule this is still the
trade route — add the new locators/methods below to `TradeParametersPage.ts` rather than creating a
`MarketSelectionPage.ts`.

**Impact on generated code:** all method chains above assume `tradeParametersPage` — do not create or
register a new fixture.

### Featured/Discovery view was removed (master PR #974, 2026-08-06)

The "Featured" category chip and the Trending/Gainers/Losers discovery cards no longer exist —
`show_discovery` is hardcoded `false` in `useMarketSelection.ts`, and `getMarketCategories()` no longer
returns a Featured entry. The picker now ALWAYS opens directly into the flat category list, scoped to
`categories[0]` (the first available category for the current trade type — typically "Derived" for
synthetic-heavy trade types like Rise/Fall). `DiscoveryView`/`DiscoverySection`/`MarketCard` still exist
in source but are permanently unreachable. **Impact on generated code:** never assert a "Featured" chip
or Trending/Gainers/Losers sections exist — this was previously guarded by a dedicated regression test,
which was removed on 2026-08-06 (see `flow.md`). The `discoverySection`/`discoveryCard`/
`discoverySectionScrollEndButton` POM locators that previously targeted these were removed — do not
re-add them without re-confirming the feature has actually come back.

### The "Changes ({window})" dropdown is now always present (except on Favourites)

Before the Featured removal, the dropdown only appeared once a non-Featured category was selected.
Since every browse view is now the category list, the dropdown is present as soon as the picker opens —
no prior chip click needed. The one remaining exception is the Favourites tab: `MarketFavouritesView`
never receives `window`/`onSelectWindow` props, so it still renders no dropdown. **Impact on generated
code:** Flow 6's test asserts the dropdown is visible immediately, not after a category click.

### Closed markets are shown, not hidden

`useTradeTypeSymbols` retains closed markets in the list (tagged "CLOSED") — the `active_symbols`
`contract_type` filter only excludes symbols NOT tradeable under the selected trade type, it does not
exclude symbols outside current trading hours. **Impact on generated code:** never assert "closed
markets are absent" — assert "closed markets show a CLOSED tag" instead.

### Favourites are keyed by `(symbol, trade_type)`, not by symbol alone

`toggleFavourite(symbol, trade_type, source)` — a market can be favourited under one trade type and not
another. **Impact on generated code:** always pass the trade-type context when asserting favourite state.

### Desktop vs. mobile disabled-state pattern for "Add market" at the cap

Desktop sets the real HTML `disabled` attribute (Playwright's `toBeDisabled()` applies; button is not
clickable). Mobile keeps the button enabled and only sets `aria-disabled="true"`, showing a snackbar on
tap instead of a tooltip. **Impact on generated code:** never use `toBeDisabled()` for the mobile
assertion — check `aria-disabled` and the snackbar text instead.

### Max tab cap differs by platform — 4 mobile / 7 desktop, both intentional

Do not parametrize a single "expected max = 4" constant across both viewports. Use
`isMobileViewport ? 4 : 7` (or an equivalent constant if added to the POM) everywhere a cap is asserted.

### Selecting a market always commits BOTH symbol and trade type together

`selectMarketAndTradeType` (existing method) already encodes this — every new flow that ends in
"a market is selected" (Info screen Trade-on CTA, Favourites, Search) should reuse the existing
assertions inside it (`verifyParamsForTradeType`) rather than re-asserting trade-form params from
scratch.

### `open_markets` persistence keys (for Flow 21)

Tabs persist via `localStorage` keys `open_markets_v2` (manual trading) and
`open_markets_automation_v2` (Automate) — confirmed in `open-markets-utils.ts`. No test should read
these keys directly; assert via the rendered tab strip after reload, not via localStorage inspection.

### Flow 7 — Market Info description matrix (75 symbols)

Copy lives in `packages/trader/src/AppV2/Utils/market-descriptions.ts`; the Playwright matrix is
`playwright/pages/market-info-description-cases.ts` (display names from `getMarketNamesMap()`).
Open Info via `openMarketInfoFromSearch(market)` — always the **first** search row for that market
(description is symbol-scoped; e.g. BTC/USD appears under Multipliers, not Rise/Fall). The matrix
paces at 800ms between lookups and calls `recoverFromRateLimitIfNeeded()` when staging rate-limits
the session. Regenerating the cases file after adding symbols to `market-descriptions.ts` is
mechanical — keep display-name mapping in sync with `contract.ts`.
