---
name: src-to-flow-dtrader
description: Analyses packages/ monorepo source code for a given feature and generates flow.md, catalog.md, and coverage.md in playwright/flows/<module>/. DTrader (derivatives-trader) variant of src-to-flow — reads TSX files from packages/trader/, packages/core/, packages/reports/ instead of src/app/ or src/features/. Also runs the _orchestrator.md sync to update _index.md automatically.
version: 1.2.0
last_updated: 2026-09-15
---

# Src-to-Flow Skill — derivatives-trader (DTrader)

## 🎯 When to Use This Skill

Use this skill when:

- ✅ A module has no flow docs yet and you need to create `flow.md`, `catalog.md`, `coverage.md` from scratch
- ✅ A module's flow docs are stale after significant source changes and need to be refreshed
- ✅ You want to add a new module's flows to the full pipeline (src → flow docs → playwright tests)

**Do NOT use this skill for:**

- ❌ Writing Playwright tests (use `flow-to-playwright` skill after this one)
- ❌ Syncing `_index.md` alone (use `_orchestrator.md` directly)
- ❌ Fixing failing tests (use `playwright` skill)

---

## 🔗 Position in the Full Pipeline

```
packages/ (monorepo source)
     │
     │  [src-to-flow-dtrader skill]  ← YOU ARE HERE
     ▼
playwright/flows/<module>/
  ├── flow.md       — what to verify at each step
  ├── catalog.md    — TypeScript method chains + tags + feature-specific decisions
  └── coverage.md   — status table + gaps + priority list
     │
     │  [flow-to-playwright skill]
     ▼
playwright/tests/<module>/*.spec.ts
```

After this skill completes, run:

```
Follow flow-to-playwright skill and implement flows for module: <module_name>
```

---

## ⚠️ DTrader Monorepo — Key Differences from Next.js home-app

This project is a **React + MobX monorepo**, not a Next.js app. The following rules override anything in the generic `src-to-flow` skill:

| Generic (home-app)                       | DTrader equivalent                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Source in `src/app/`, `src/features/`    | Source in `packages/trader/src/`, `packages/core/src/`, `packages/reports/src/`                                                             |
| File-system routing (`page.tsx` = route) | Config-based routes — arrays in `packages/core/src/App/Constants/routes-config.js` and `packages/trader/src/App/Constants/routes-config.ts` |
| Two surfaces: one per route              | Two surfaces per feature: **desktop** (`packages/trader/src/Modules/`) and **AppV2 mobile** (`packages/trader/src/AppV2/`)                  |
| `useTranslations` / `next-intl`          | `localize()` / `<Localize i18n_default_text="..." />` from `@deriv-com/translations`                                                        |
| `en.json` for copy                       | `i18n_default_text` prop on `<Localize>` or first arg to `localize()` — read directly from TSX source                                       |
| React Query / Zustand state              | MobX 6 stores — `packages/trader/src/Stores/`, accessed via `useStore()`                                                                    |
| `data-testid` in JSX attributes          | `data-testid` in JSX attributes — same pattern, prefix convention is `dt_`                                                                  |

---

## 📚 Always Read These Conventions First

Before reading any source file or generating any output, load the canonical templates:

1. `playwright/flows/_conventions/flow-template.md`
2. `playwright/flows/_conventions/coverage-template.md`
3. `playwright/flows/_conventions/catalog-template.md`
4. `playwright/flows/_conventions/fixtures-reference.md`
5. `playwright/flows/_conventions/utils-reference.md`

---

## 📋 11-Step Protocol (Steps 0–10)

---

## 🚀 Step 0 — Ask for the Module (if not provided)

- If the invocation contains `module: <name>` or names a module explicitly (e.g. "generate flow docs for trade"), extract it and proceed to Step 1.
- **If no module name was provided**, use `AskUserQuestion` to ask:

    > **Which module would you like to generate flow docs for?**
    > (e.g. `trade`, `positions`, `reports`, `notifications`, `auth`)

    Wait for the user's answer before continuing. Do not guess or default to any module.

---

## 🔍 Step 1 — Identify the Module

### Module → Source Path Mapping

Each module has **two source paths** — one for desktop, one for mobile (AppV2). Both must be scanned together and merged into a single set of flow docs. The split is handled at the locator level in the Page Object using `isMobile`, not at the documentation level.

| Module             | Desktop source                                                                                                                                                     | Mobile (AppV2) source                                                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trade`            | `packages/trader/src/AppV2/Containers/Trade/trade-desktop.tsx` + `packages/trader/src/Modules/Contract/` + `packages/trader/src/AppV2/Containers/ContractDetails/` | `packages/trader/src/AppV2/Containers/Trade/trade-mobile.tsx` + `packages/trader/src/AppV2/Components/TradeParameters/` + `packages/trader/src/AppV2/Components/ContractCard/` + `packages/trader/src/AppV2/Containers/ContractDetails/` |
| `positions`        | `packages/trader/src/AppV2/Containers/Positions/`                                                                                                                  | `packages/trader/src/AppV2/Containers/Positions/` (shared)                                                                                                                                                                               |
| `reports`          | `packages/reports/src/`                                                                                                                                            | `packages/reports/src/` (shared)                                                                                                                                                                                                         |
| `notifications`    | `packages/trader/src/AppV2/Containers/Notifications/`                                                                                                              | `packages/trader/src/AppV2/Containers/Notifications/` (shared)                                                                                                                                                                           |
| `auth`             | `packages/core/src/App/Components/Layout/Header/` + `packages/trader/src/AppV2/Components/Layout/Sidebar/`                                                         | `packages/core/src/Modules/Menu/menu.tsx`                                                                                                                                                                                                |
| `trade-automate`   | `packages/trader/src/AppV2/Components/AutomationPanel/` + `packages/trader/src/AppV2/Components/TradePanelTabs/trade-panel-tabs.tsx` (desktop tab)                 | `packages/trader/src/AppV2/Containers/Automate/automate-mobile.tsx` + `packages/trader/src/AppV2/Routes/AutomateSwitch.tsx` (mobile `/automate` route)                                                                                   |
| `feed`             | `packages/trader/src/AppV2/Containers/MarketInfo/` (Market Info price ticks)                                                                                       | same (shared)                                                                                                                                                                                                                            |
| `market-selection` | `packages/trader/src/AppV2/Components/MarketSelector/` + trade tabs in `packages/trader/src/AppV2/Components/TradeTabs/`                                           | same AppV2 components (viewport split via `isMobile`)                                                                                                                                                                                    |

> **Rule:** Contract details is part of the `trade` journey — buying a contract lands on the contract details page, so it is covered implicitly by the trade flow. `positions`, `reports`, and `notifications` share one implementation — no desktop/mobile split needed. `auth` has a genuine desktop/mobile split for logout: desktop uses the sidebar (`AppV2/Components/Layout/Sidebar/account-selector.tsx`), mobile uses the menu page (`core/src/Modules/Menu/menu.tsx`). For `trade`, both desktop and mobile render from `AppV2/Containers/Trade/` — `trade-desktop.tsx` for ≥1024px, `trade-mobile.tsx` for <1024px.

> **`trade-automate`:** read the [**Module annex: `trade-automate`**](#-module-annex-trade-automate) below **before Step 5**. The generic dual-outcome rule (`N.1` / `N.2` = two buttons) is **wrong** for this module — automate lifecycles use **four child IDs per dual-outcome parent** (outcome × demo/real) and a **strategy × trade-type matrix**. Golden reference: `playwright/flows/trade-automate/flow.md`.

If the module is not in the table above, discover it:

```bash
# Search by feature name across all packages
find packages -type d -name "*<module>*" | grep -v node_modules | sort

# Search for matching component files
find packages -name "*.tsx" | xargs grep -l "<module>" 2>/dev/null | grep -v node_modules | head -20
```

### Confirm Route Definitions

```bash
# Core routes (app shell)
cat packages/core/src/App/Constants/routes-config.js

# Trader routes
cat packages/trader/src/App/Constants/routes-config.ts

# AppV2 mobile routes
find packages/trader/src/AppV2/Routes -name "*.tsx" | sort
```

Routes are config objects: `{ path, component, getTitle, protected, routes }`. The `path` is the URL the test will navigate to.

### Confirm Desktop vs Mobile Split

The split varies by module:

- **`trade`**: Both desktop and mobile live in `packages/trader/src/AppV2/Containers/Trade/` — `trade-desktop.tsx` renders at ≥1024px, `trade-mobile.tsx` at <1024px. Contract details (`Modules/Contract/` + `AppV2/Containers/ContractDetails/`) is part of this module — it is the page reached after buying.
- **`positions`, `reports`, `notifications`**: Single shared implementation — no split.
- **`auth`**: Genuine desktop/mobile split for logout — desktop uses the sidebar (`AppV2/Components/Layout/Sidebar/account-selector.tsx`), mobile uses the menu page (`core/src/Modules/Menu/menu.tsx`). Still document as one flow with a `Platform` column — same user journey, different entry points.

Check which AppV2 containers exist:

```bash
find packages/trader/src/AppV2/Containers -type d | grep -v node_modules | sort
find packages/trader/src/AppV2/Components -type d | grep -v node_modules | sort
find packages/trader/src/Modules -type d | grep -v node_modules | sort
```

---

## 🔍 Step 2 — Check Existing Flow Docs for Duplicates

**Run this step before any source analysis.** If `playwright/flows/<module>/` already exists, read all three doc files and build a "what we already know" inventory.

### 2a — Read existing docs (if present)

```bash
[ -d "playwright/flows/<module>/" ] && echo "Flow docs exist" || echo "No existing flow docs"
```

If the folder exists, read all three files in full:

```bash
if [ -d "playwright/flows/<module>/" ]; then
  cat "playwright/flows/<module>/flow.md" 2>/dev/null || echo "[flow.md not found]"
  cat "playwright/flows/<module>/catalog.md" 2>/dev/null || echo "[catalog.md not found]"
  cat "playwright/flows/<module>/coverage.md" 2>/dev/null || echo "[coverage.md not found]"
fi
```

### 2b — Build the existing inventory

| Inventory item                      | Where to look                                                      |
| ----------------------------------- | ------------------------------------------------------------------ |
| **Existing flow IDs**               | `flow.md` — every `### Flow N` and `### Flow N.M` heading          |
| **Existing gap IDs**                | `flow.md` — every `### G{n}` heading; `coverage.md` Section 2 rows |
| **Existing coverage rows**          | `coverage.md` Section 1 — the status table                         |
| **Existing `data-testid` locators** | `catalog.md` — every `getByTestId('...')` call                     |
| **Existing POM method names**       | `catalog.md` Section 2 — Flow Details                              |
| **Last flow number used**           | Highest `### Flow N` integer — use `max + 1` for new flows         |
| **Last gap number used**            | Highest `G{n}` integer — use `max + 1` for new gaps                |

---

## 🔍 Step 3 — Analyse the Source Code

Run these searches **in parallel**. Collect all findings before generating any output.

### 3a. Component files

```bash
# Desktop trade form
find packages/trader/src/Modules/<Feature> -name "*.tsx" | grep -v node_modules | sort

# AppV2 mobile
find packages/trader/src/AppV2/Components/<Feature> -name "*.tsx" | grep -v node_modules | sort

# Shared components used by this feature
find packages/components/src -name "*.tsx" | xargs grep -l "<Feature>" 2>/dev/null | grep -v node_modules | head -10
```

### 3b. data-testid attributes — the most important step

**Primary source locations for locators — always start here:**

| Feature area                                         | Where to look first                                     |
| ---------------------------------------------------- | ------------------------------------------------------- |
| Trade form, contract type selector, trade parameters | `packages/trader/src/AppV2/Components/`                 |
| Trade page layout (desktop vs mobile containers)     | `packages/trader/src/AppV2/Containers/Trade/`           |
| Contract details page                                | `packages/trader/src/AppV2/Containers/ContractDetails/` |
| Positions list                                       | `packages/trader/src/AppV2/Containers/Positions/`       |
| Sidebar (desktop nav), account selector              | `packages/trader/src/AppV2/Components/Layout/Sidebar/`  |
| Bottom nav, header (mobile), login button            | `packages/core/src/App/Components/Layout/Header/`       |
| App shell, menu page (mobile)                        | `packages/core/src/`                                    |
| Reports (P&L, statement, portfolio)                  | `packages/reports/src/`                                 |
| Contract type constants, button display names        | `packages/shared/src/utils/constants/contract.ts`       |

**Rule: for anything on the trade page or contract details, always start in `packages/trader/src/AppV2/`.** `packages/core/src/` covers only the app shell (header, bottom nav, login button, account info, menu).

Scan **both** desktop and mobile source paths and tag each testid by platform. The same element often has different testids on desktop vs mobile.

```bash
# All AppV2 trade components (primary search — covers both desktop and mobile renders)
grep -r 'data-testid' packages/trader/src/AppV2/Components/<Feature> --include="*.tsx" -n

# AppV2 page-level containers
grep -r 'data-testid' packages/trader/src/AppV2/Containers/<Feature> --include="*.tsx" -n

# Legacy Desktop Modules (if the feature has a non-AppV2 desktop path)
grep -r 'data-testid' packages/trader/src/Modules/<Feature> --include="*.tsx" -n

# Shared components used by both
grep -r 'data-testid' packages/components/src --include="*.tsx" -n | grep -i "<feature>"
```

For each testid found, record which platform it belongs to:

| testid                   | Platform       | Notes               |
| ------------------------ | -------------- | ------------------- |
| `dt_stake_input`         | Mobile (AppV2) | Inside action sheet |
| `dt_stake_input_desktop` | Desktop        | Inline input        |
| `dt_trade_container`     | Both           | Shared wrapper      |

**DTrader `data-testid` naming convention:** prefix is `dt_` — desktop-only variants often have a `_desktop` suffix. Record every testid found with its platform tag — these drive the `isMobile` branching in the Page Object.

### 3b.1 — Purchase button display names — ALWAYS verify from contract constants

**Never guess or infer purchase button labels.** The display name for every contract type button comes from `getContractTypeDisplay()` in `packages/shared/src/utils/constants/contract.ts`. The name in the source may differ from what you expect — e.g. `CONTRACT_TYPES.TURBOS.LONG` maps to display name `'Up'`, not `'Long'`.

```bash
# Read the canonical button name source
grep -A 3 "TURBOS\|VANILLA\|MULTIPLIER\|ACCUMULATOR\|MATCH_DIFF\|EVEN_ODD\|OVER_UNDER\|CALL\|PUT\|HIGHER\|LOWER\|TOUCH\|NO_TOUCH" \
  packages/shared/src/utils/constants/contract.ts | head -80
```

Key mappings confirmed from source (do not guess — always re-verify):

| Contract type                   | Button 1  | Button 2                    |
| ------------------------------- | --------- | --------------------------- |
| Rise/Fall (`CALL`/`PUT`)        | `Rise`    | `Fall`                      |
| Higher/Lower (`HIGHER`/`LOWER`) | `Higher`  | `Lower`                     |
| Touch/No Touch                  | `Touch`   | `No Touch`                  |
| Matches/Differs                 | `Matches` | `Differs`                   |
| Over/Under                      | `Over`    | `Under`                     |
| Even/Odd                        | `Even`    | `Odd`                       |
| Multipliers                     | `Up`      | `Down`                      |
| Turbos (`.LONG`/`.SHORT`)       | `Up`      | `Down` ← NOT "Long"/"Short" |
| Vanillas                        | `Call`    | `Put`                       |
| Accumulators                    | `Buy`     | — (single button)           |

### 3c. UI copy — read directly from i18n_default_text

DTrader does NOT have a central `en.json`. Extract copy from TSX source directly:

```bash
# Localize component
grep -r 'i18n_default_text' packages/trader/src/AppV2/Components/<Feature> --include="*.tsx" -n | head -30
grep -r 'i18n_default_text' packages/trader/src/Modules/<Feature> --include="*.tsx" -n | head -30

# localize() function calls
grep -r "localize('" packages/trader/src/AppV2/Components/<Feature> --include="*.tsx" -n | head -30
```

When copy cannot be determined from source: write `[verify on staging]` — never invent UI text.

### 3d. MobX store — understand state driving the UI

```bash
# Find the store(s) for this feature
find packages/trader/src/Stores -name "*.ts" | grep -i "<feature>" | grep -v node_modules

# Read the trade store (most features connect here)
# Note: this file is 103KB — grep for the relevant section only
grep -n "<feature>\|<Feature>" packages/trader/src/Stores/Modules/Trading/trade-store.ts | head -30

# Find observables and computed properties used by the feature's components
grep -r "useStore\b" packages/trader/src/AppV2/Components/<Feature> --include="*.tsx" -n | head -20
```

MobX observables that drive conditional rendering = separate flows or sub-flows.

### 3e. Conditional rendering — discover state-dependent flows

```bash
# Boolean conditions in JSX — scan both desktop and mobile paths
grep -rn "is_mobile\|isMobile\|is_open\|is_loading\|is_disabled\|is_market_closed\|is_virtual" \
  packages/trader/src/AppV2/Components/<Feature> \
  packages/trader/src/Modules/<Feature> \
  --include="*.tsx" | head -40

# Ternary / conditional JSX
grep -rn "? <\|&& <\||| <" \
  packages/trader/src/AppV2/Components/<Feature> \
  packages/trader/src/Modules/<Feature> \
  --include="*.tsx" | head -30
```

### 3f. Navigation

```bash
# Route pushes
grep -rn "history\.push\|useHistory\|routes\." packages/trader/src --include="*.tsx" | grep -i "<feature>" | head -20

# Route constants from @deriv/shared
grep -rn "routes\." packages/trader/src/AppV2/Components/<Feature> --include="*.tsx" | head -10
```

### 3i. `trade-automate` — mandatory source reads (when module = `trade-automate`)

Run these **in addition to** Step 3a–3h. Do not infer the flow matrix from UI screenshots alone.

```bash
# Supported UI trade types + guide copy (FE allowlist — intersected at runtime with BE strategy.supported_contract_types)
cat packages/trader/src/AppV2/Components/AutomationPanel/automation-guide-config.ts

# Strategy list, params, supported_contract_types, validation on Run
grep -n "supported_contract_types\|available_strategies\|validate\|strategy" \
  packages/trader/src/Stores/Modules/Trading/automation-store.ts | head -40

# Runtime trade-type filter (Martingale / D'Alembert × contract type)
cat packages/trader/src/AppV2/Hooks/useAutomationSupportedTradeTypes.ts

# Run / Pause / Stop / resync / already-running guard
cat packages/trader/src/AppV2/Hooks/useRunControls.ts

# Existing POM orchestration methods + param shapes (do not re-invent lifecycle order)
grep -n "async run\|AndVerify\|verifyAutomate" playwright/pages/TradeAutomatePage.ts | head -40

# Existing spec layout + @id headers (canonical child-flow mapping)
find playwright/tests/trade-automate -name '*.spec.ts' | sort
grep -rh '@id\|/\*\* Flow' playwright/tests/trade-automate --include='*.spec.ts' | head -60
```

### 3g. Read every component file — THIS IS MANDATORY

**Grep results alone are not sufficient.** You MUST open and read the full source of every non-trivial component found in 3a. Look for:

| Pattern in TSX                                         | What it means for flow docs                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `observer()` HOC wrapping                              | MobX-reactive component — check which store observables it reads                                                                                                                                                                                                                                                                        |
| `const { store_prop } = useStore()`                    | Store dependency — a store state change triggers a re-render and a new flow                                                                                                                                                                                                                                                             |
| `is_market_closed` / `trading_disabled`                | Market state gates — separate flows for open vs closed                                                                                                                                                                                                                                                                                  |
| Modal / ActionSheet components                         | Sub-flows for open/close states                                                                                                                                                                                                                                                                                                         |
| `onSubmit` / `onClick` handlers                        | Actions that drive assertions                                                                                                                                                                                                                                                                                                           |
| Error boundary / validation_errors                     | Negative path flows                                                                                                                                                                                                                                                                                                                     |
| `screen-large.tsx` / `screen-small.tsx` split          | Desktop and mobile render different components — document both                                                                                                                                                                                                                                                                          |
| `if (!isMobile) return <Redirect .../>` in a component | **Does NOT mean the feature is mobile-only.** It means THIS component is mobile-only. The same feature may exist elsewhere for desktop (e.g. a sidebar, a header dropdown, a flyout). Always search broadly before concluding "no desktop equivalent" — grep for the action verb (`logout`, `language`, etc.) across all of `packages/` |

### 3h. Existing Page Object (if updating an existing module)

```bash
cat "playwright/pages/<Module>Page.ts" 2>/dev/null || echo "No existing POM"
```

---

## 🔍 Step 4 — Classify Discoveries and Check for Duplicates

Run this step immediately after Step 3. Use the inventory built in Step 2b to classify every flow and locator.

### 4a — Classify incoming changes

| Classification             | Rule                                                     | Action                                  |
| -------------------------- | -------------------------------------------------------- | --------------------------------------- |
| **New flow**               | No matching flow ID or flow name exists in `flow.md`     | Add as `max(existing IDs) + 1`          |
| **Updated flow**           | Flow name exists but steps/assertions differ from source | Surgically update only changed rows     |
| **Unchanged flow**         | Flow name and steps match what is already documented     | Skip                                    |
| **New locator**            | `data-testid` not present in `catalog.md`                | Add to the relevant flow's method chain |
| **Duplicate locator**      | `data-testid` already listed in `catalog.md`             | Skip                                    |
| **New coverage row**       | Flow name not present in `coverage.md` Section 1         | Add a new row                           |
| **Duplicate coverage row** | Flow name already present in `coverage.md` Section 1     | Skip                                    |
| **New gap**                | Gap description not present in `coverage.md` Section 2   | Add as `max(existing gap IDs) + 1`      |
| **Duplicate gap**          | Gap with same description already in Section 2           | Skip                                    |

### 4b — Cross-module duplicate check

```bash
MODULE=trade  # ← substitute the actual module name here
grep "### Flow" playwright/flows/*/flow.md \
  | grep -v -F "playwright/flows/${MODULE}/flow.md" \
  | sort
```

### 4c — Report the diff summary before writing

```
Duplicate check complete for module: <module>

Within-module:
  Existing: <N> flows, <M> gaps, <K> locators
  Incoming: <X> new flows, <Y> updated flows, <Z> unchanged flows
            <A> new locators, <B> duplicate locators (skipped)
            <C> new coverage rows, <D> duplicate rows (skipped)
            <E> new gaps, <F> duplicate gaps (skipped)

Cross-module:
  <flow name> → duplicate / distinct / unique

Will write:
  flow.md    — [add / update / no change]
  catalog.md — [add / update / no change]
  coverage.md — [add / update / no change]
```

---

## 📦 Module annex: `trade-automate`

**When:** `module: trade-automate` (or refreshing stale automate flow docs).

**Why this annex exists:** An earlier pass produced ~10 parent flows (one per trade type × strategy) with no demo/real split, no dual-outcome `.3`/`.4` IDs, and Accumulators D'Alembert as a separate parent flow. The implemented suite has **44 Section-1 rows** — mostly **one child flow ID per test case**.

### Flow inventory — two layers

| Layer                     | Parent flows                 | What they cover                                                                                                                     |
| ------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Panel / control**       | 1, 2.1–2.2, 3, 4, 14, 15, G2 | Pause/resume (embedded), thresholds, account resync, EU gating, already-running snackbar, param validation, unsupported type on Run |
| **Trade-type lifecycles** | 5–13                         | Martingale (5–9) and D'Alembert (10–13) × five UI trade types                                                                       |

**Do not stop after panel flows.** The bulk of coverage is the **strategy × trade-type matrix** below.

### Child flow ID convention — one ID per test

| Shape                                               | Child IDs                                                                             | Example                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Dual-outcome trade type**                         | `.1` outcome A demo · `.2` outcome A real · `.3` outcome B demo · `.4` outcome B real | Rise/Fall Martingale parent **5** → **5.1** Rise demo … **5.4** Fall real |
| **Accumulators (both strategies under one parent)** | Martingale **6.1** demo · **6.2** real · D'Alembert **6.3** demo · **6.4** real       | Do **not** give D'Alembert Accumulators a separate parent Flow 11         |
| **Panel spec with two tests**                       | **2.1** / **2.2**, **15.1** / **15.2**                                                | Threshold loss vs profit; validation Martingale vs D'Alembert increment   |
| **Embedded (no dedicated spec)**                    | **Flow 1** only                                                                       | `verifyPauseAndResumeWhileRunning()` inside every trade-type lifecycle    |

> **Override:** Step 5’s generic rule “dual-outcome = `N.1` / `N.2` for two buttons” applies to **`trade`** manual buys only. For **`trade-automate`**, dual-outcome parents always emit **four** child IDs (outcome × demo/real).

### Parent flow × strategy matrix (coverage Section 1 order)

| Parent | UI trade type   | Martingale IDs | D'Alembert IDs | Spec folder        |
| ------ | --------------- | -------------- | -------------- | ------------------ |
| 5      | Rise/Fall       | 5.1–5.4        | 10.1–10.4      | `rise-fall/`       |
| 6      | Accumulators    | 6.1–6.2        | 6.3–6.4        | `accumulators/`    |
| 7      | Matches/Differs | 7.1–7.4        | 11.1–11.4      | `matches-differs/` |
| 8      | Over/Under      | 8.1–8.4        | 12.1–12.4      | `over-under/`      |
| 9      | Even/Odd        | 9.1–9.4        | 13.1–13.4      | `even-odd/`        |

Each **dual-outcome** trade type → **four spec files** per strategy (`verify-{outcome}-{strategy}.spec.ts`), each file **two serial tests** (demo + real). Each **Accumulators** strategy → **one spec file**, **two tests** (demo + real).

### Account model (differs from manual `trade`)

- `beforeAll`: always `createAccountV2viaJS('real', { backupAccount: TEST_EMAIL_AUTOMATE_<TRADE_TYPE> })` — one funded real staging account per spec file group.
- Each test: `run*AndVerify({ accountType: 'demo' | 'real', ... })` switches in-app via `switchToAccountType()` — **demo and real are separate child flow IDs**, not separate parent flows.
- **Distinct inline params** per test (stake, thresholds, digit, duration) so closed-position lookup does not collide on the same backup account.

### Lifecycle steps (every trade-type `run*AndVerify`)

Document this shared sequence once in `flow.md` (see existing `playwright/flows/trade-automate/flow.md`):

1. `goToAutomatedTrading()` → `switchToAccountType(accountType)`
2. `selectMarketAndTradeType(market, '<Category>', { mode: 'automate' })`
3. `selectTradeTypeOption(...)` — dual-outcome only
4. `openAndVerifyAutomateGuide(...)` → `verifyAutomationPanelFieldsVisible()`
5. Trade-form params + automation panel (`selectStrategy`, multiplier **or** increment, thresholds)
6. `startAutomateRun()` → running checks → (tick types) `verifyAutomateSequentialContractPurchase()` → open-position details → **`verifyPauseAndResumeWhileRunning()` (Flow 1)** → `stopAutomateRun()` → closed contract

**Accumulators:** omit sequential purchase; pause/resume after first running contract.

**D'Alembert:** `strategy: "D'Alembert"`, `stakeIncrement` (not `stakeMultiplier`); use different thresholds than Martingale on the same backup account.

### `coverage.md` rules for this module

- Section 1 row count ≈ **44** (43 named child/parent rows + G2) — sorted **numerically** (e.g. **6.1–6.4** before **7.1**, not Accumulators D'Alembert after Flow 10).
- Child-flow note at top: document Accumulators **6.1/6.2/6.3/6.4** and dual-outcome **.1–.4** pattern.
- Promoted panel journeys (e.g. already-running snackbar) are **named flows** (Flow 14), not permanent G1 gaps.

### Common generation mistakes — reject before writing

| Mistake                                              | Correct                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| One parent flow per trade type only (10 flows)       | **10 parent flows per strategy** (5–9 Martingale, 10–13 D'Alembert) + panel flows                |
| Demo + real merged into one coverage row             | **Two rows** (`.1` demo, `.2` real) or four for dual-outcome                                     |
| Rise + Fall in one spec / one flow ID                | **Separate files** `verify-rise-*.spec.ts` / `verify-fall-*.spec.ts`; IDs `.1–.2` vs `.3–.4`     |
| Accumulators D'Alembert as Flow 11                   | **6.3 / 6.4** under parent **Flow 6**                                                            |
| Missing `@martingale` / `@dalembert` tags in catalog | Tag per strategy; `@production` only on agreed smoke path (e.g. Flow 12.2 Over D'Alembert real)  |
| Skipping Flow 1                                      | Document as embedded; every lifecycle step table references `verifyPauseAndResumeWhileRunning()` |

---

## 🧠 Step 5 — Identify User Journeys

From the source analysis, enumerate distinct user journeys. DTrader-specific rules:

- **Desktop and mobile are ALWAYS the same flow** — document them together in one step table using a `Platform` column. Never split into separate flows just because the locators or entry points differ. The test spec handles the branch via `testInfo.project.name.includes('mobile')`.
- **When to use `Platform` column:** when the same step has a different interaction on desktop vs mobile (e.g. mobile opens an action sheet, desktop edits inline), add a `Platform` column with values `Desktop`, `Mobile`, or `Both`.
- **When to split into separate flows:** only when the feature literally does not exist on one platform at all (e.g. a mobile-exclusive screen with zero desktop equivalent). This is rare — when in doubt, merge into one flow with a Platform column.
- **MobX store states = separate flows** — a UI that differs based on `is_market_closed`, `is_virtual`, `trading_disabled`, or any MobX observable each generates its own flow or sub-flow.
- **Account type branches** — real vs demo account rendering differences are separate flows. In **`trade-automate`**, demo/real are **child flow IDs** (`.1`/`.2` or `.1–.4`), not separate parent flows — see the module annex.
- **Happy path first** — number these Flow 1, Flow 2, etc.
- **Sub-flow numbering for dual-outcome trade types (`trade` module only)** — when a trade type has two distinct purchase buttons (e.g. Rise/Fall, Higher/Lower, Up/Down), each button outcome is its own sub-flow: `Flow N.1` for the first button, `Flow N.2` for the second. Never merge both directions into a single flow — they produce different contracts and need independent verification. **`trade-automate` overrides this** — see [Module annex: `trade-automate`](#-module-annex-trade-automate) (four child IDs: outcome × demo/real).
- **Optional parameters → separate sub-flow pairs** — when a trade type supports an optional parameter that creates a meaningfully different contract (Take Profit, Stop Loss, Deal Cancellation), each optional-param variant gets its own sub-flow pair (Up + Down). Example: Multipliers without TP/SL = Flows 10.1/10.2; Multipliers with TP = Flows 11.1/11.2; Multipliers with SL = Flows 12.1/12.2. This ensures each risk control path is independently covered.
- **Negative/validation paths** — Flow N.1, Flow N.2, etc. (outside the dual-outcome convention above, which uses N.1/N.2 for buttons).
- **Merge postconditions into their parent flow** — if a flow's final steps already assert the state a subsequent flow would verify, do not create that subsequent flow. Example: "logged-in state: account info visible" is the final assertion of every login flow — it must not be a separate flow. Ask: "is this flow's entire content already verified as the tail of another flow?" If yes, drop it.
- **Only create a gap when something is genuinely missing or not automatable** — do not document investigation findings ("we checked X and found nothing") as gaps. A gap row must represent either: (a) a user journey not yet automated, or (b) a journey that cannot be automated with a clear reason. "Covered by Flow N" is not a gap — just omit it entirely.

### ⚠️ "Feature absent on desktop" — verify before classifying as gap

Before classifying a feature as "not present on desktop" (and marking the desktop coverage column `N/A`), you MUST verify by searching all of `packages/` — not just the single component you are reading. DTrader has multiple desktop surfaces:

| Surface                             | Path                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| Left sidebar                        | `packages/trader/src/AppV2/Components/Layout/Sidebar/`                                  |
| Header (account info, login button) | `packages/core/src/App/Components/Layout/Header/`                                       |
| Flyout / drawer                     | `packages/trader/src/AppV2/Components/Layout/Sidebar/` (Flyout rendered inside Sidebar) |
| Desktop trade form                  | `packages/trader/src/AppV2/Containers/Trade/trade-desktop.tsx`                          |
| Desktop modals                      | `packages/core/src/App/Containers/Modals/`                                              |

**Rule:** `if (!isMobile) return <Redirect .../>` in one component only means that component is mobile-only — it says nothing about whether the same action exists in a different desktop surface. Run a broad grep before concluding:

```bash
# Example: verifying whether "logout" exists anywhere on desktop
grep -r "logout\|Log out" packages/ --include="*.tsx" -l | grep -v node_modules | grep -v __tests__
```

---

### ❌ Non-Automatable Patterns — classify as N/A gap immediately

| Pattern                               | Code signatures                                                          | Why N/A                                                               |
| ------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| **Real OAuth / Deriv login redirect** | Login redirects to external `oauth.deriv.com`                            | External origin — Playwright cannot drive it                          |
| **WebSocket-only flows**              | Flows that only produce output via WebSocket messages with no DOM change | No assertable DOM state                                               |
| **Real money trades**                 | Actual `buy` contract API calls against production                       | Financial risk — never automate on production                         |
| **CAPTCHA**                           | Any captcha widget                                                       | Blocks automation by design                                           |
| **Third-party payment iframes**       | Cashier iframes at external origins                                      | Cross-origin iframe restriction                                       |
| **Biometric / device auth**           | `navigator.credentials`, passkey flows                                   | Requires OS-level hardware                                            |
| **SmartCharts canvas interaction**    | Direct canvas clicks on the chart                                        | Canvas has no accessible DOM — chart interactions are not automatable |

### ✅ Implicitly Covered Pages

Pages only reachable as a step inside a parent flow (e.g. a contract details page after a trade is placed) are implicitly covered by the parent flow. Do not create a standalone gap row — mark `✅` with `Covered implicitly by Flow N`.

---

## ✍️ Step 6 — Generate `flow.md`

Follow `flow-template.md` exactly. DTrader-specific rules:

- **URLs**: use route constants from `@deriv/shared` routes object (e.g. `/`) or the path from `routes-config.ts`
- **Base URL**: `https://staging-dtrader.deriv.com` (staging) — tests point to this by default via `playwright.config.ts`
- **Expected Results**: reference `data-testid` values found in Step 3b, not guessed element names
- **User State column**: always note account type (real/demo) and market state (open/closed) where relevant
- Use `[verify on staging]` for any copy you cannot confirm from `i18n_default_text` in source

### flow.md table formatting rules

All step tables must use **single-space cell padding** and **`| --- |` separator rows** — no wide column separators, no trailing spaces:

```markdown
| #   | Step     | Action                         | Expected Result                       | Platform |
| --- | -------- | ------------------------------ | ------------------------------------- | -------- |
| 1   | Login    | `loginPage.login()`            | Redirected to trade page; API settled | Both     |
| 2   | Buy Rise | `tradePage.buyRiseAndVerify()` | Contract purchased, positions updated | Both     |
```

- `#` column values are **unpadded integers** — `| 1 |` not `| 1   |`
- Separator rows always `| --- |` — never `|---|`, `|:---:|`, or longer dashes
- No trailing spaces after the last cell: line ends at the final `|`

### Desktop/Mobile split in step tables

When desktop and mobile share the same flow but interact differently, use a `Platform` column:

```markdown
| #   | Step         | Action            | Expected Result                  | Platform |
| --- | ------------ | ----------------- | -------------------------------- | -------- |
| 1   | Open stake   | Click Stake input | Stake input activates inline     | Desktop  |
| 1   | Open stake   | Tap Stake chip    | Stake action sheet opens         | Mobile   |
| 2   | Enter amount | Type "10"         | Input shows "10.00"              | Both     |
| 3   | Confirm      | Click Buy         | Contract purchased toast appears | Both     |
```

**Rules for the `Platform` column:**

- Use `Both` when the step and assertion are identical on desktop and mobile
- Use `Desktop` / `Mobile` only when the interaction or expected result differs
- If ALL steps are identical across platforms, omit the `Platform` column entirely
- Never create a duplicate flow just because locators differ — that is handled in the Page Object

---

## ✍️ Step 7 — Generate `catalog.md`

Follow `catalog-template.md` exactly.

### Section 1 — Journey Index

Tag rules:

- Feature tag: `@trade`, `@positions`, `@reports`, `@notifications`, `@auth`
- `@smoke` — happy path only
- `@production` — safe on prod (no account mutation, read-only assertions)
- `@staging` — uses account creation (`createAccountV1`/`createAccountV2`) or Mailisk
- `@desktop` and/or `@mobile` — always include at least one

### Section 2 — Flow Details

**Use real `data-testid` locators from Step 3b** wherever found:

```typescript
// ✅ testid found in source
await tradePage.tradeContainer.isVisible();
await page.getByTestId('dt_stake_input').fill('10');

// 🟡 no testid, role fallback
await page.getByRole('button', { name: 'Buy' }).click();

// 🔍 testid not confirmed in source — verify on staging
await page.getByTestId('???').click();
```

**DTrader-specific patterns to note:**

- MobX `observer()` components re-render on store changes — assertions should use `expect(...).toBeVisible()` not just URL checks
- After navigation, always call `NavigationUtils.waitForDerivApiSettled(page)` before asserting — the WebSocket must settle
- For market-state-gated UI, note the required account/market state in the `beforeAll` setup block

### Catalog Section 2 — one section heading per spec file, one test per sub-flow

When a spec file covers multiple sub-flows (e.g. `verify-rise-fall.spec.ts` covers Flow 2.1 and Flow 2.2):

- Use **one `### Flow N.1` section heading** for the first sub-flow — this anchors the whole group
- Write a single `test.describe` block for the spec file
- Write **one `test()` per sub-flow** inside that describe block
- Add a comment line after the code block naming which sub-flow each test corresponds to

```typescript
test.describe('Trade — Rise/Fall', { tag: [...] }, () => {
    test.beforeAll(async ({ loginPage, tradePage, page }) => { /* shared setup */ });

    test('VERIFY buy Rise contract and close', async ({ tradePage, positionsPage, reportsPage, contractDetailsPage, page }) => {
        // Flow 2.1 — orchestrated via high-level method
        await tradePage.buyRiseAndVerify(positionsPage, reportsPage, contractDetailsPage);
    });

    test('VERIFY buy Fall contract and close', async ({ tradePage, positionsPage, reportsPage, contractDetailsPage, page }) => {
        // Flow 2.2 — same describe, separate test
        await tradePage.buyFallAndVerify(positionsPage, reportsPage, contractDetailsPage);
    });
});
```

> **Flow 2.1** = `VERIFY buy Rise contract and close` · **Flow 2.2** = `VERIFY buy Fall contract and close`

The `buyRiseAndVerify` / `buyFallAndVerify` orchestration methods each span the full buy→positions→reports→contract-details→close→statement sequence:

1. `selectMarket` — set symbol + trade type
2. `buyRise` / `buyFall` — click Buy, dismiss toast
3. `verifyOpenPositionsVisible` — position card visible in Positions tab
4. `verifyOpenPositionsInReports` — entry in Reports > Positions
5. `verifyContractDetailsPage` — open contract details, assert key fields
6. `closeFirstContract` — close the contract from Positions
7. `verifyClosedPositionsTab` — closed contract appears in Positions > Closed
8. `verifyClosedContractDetailsPage` — verify closed state in Contract Details
9. `verifyBalanceAfterContractClose` — balance updated
10. `verifyClosedContractInReports` — entry in Reports > Statement

These methods live on `TradeRiseFallPage` (which inherits `TradeParametersPage → TradeBasePage`) and take the other page-object instances as arguments.

**Rules:**

- The first test in the describe block verifies the unique params for this trade type (Duration visible, Allow equals visible, etc.) — subsequent sub-flows can skip those param assertions since they are already covered
- Never put both directions in a single test — they must be independently runnable
- Use `test.describe.configure({ mode: 'serial' })` when tests share cumulative state (e.g. buying then checking positions) — serial mode prevents parallel teardown races
- `beforeAll` (not `beforeEach`) handles login + navigation when the whole describe block shares a single session; each test picks up from the already-loaded trade page

---

### Desktop/Mobile split in catalog method chains

For each flow that has platform differences, show two method chains under a single flow section:

### Flow 1 — Trade Form — Stake Input

**Desktop:**

```typescript
await loginPage.login();
await NavigationUtils.waitForDerivApiSettled(page);
await tradePage.stakeInput.fill('10');
await expect(tradePage.stakeInput, 'Stake input should show 10').toHaveValue('10.00');
```

**Mobile:**

```typescript
await loginPage.login();
await NavigationUtils.waitForDerivApiSettled(page);
await tradePage.stakeChip.click(); // opens action sheet
await tradePage.stakeInput.fill('10'); // same getter, different testid resolved via isMobile
await expect(tradePage.stakeInput, 'Stake input should show 10').toHaveValue('10.00');
```

**Page Object locator pattern (for reference — do not generate POM code here):**

```typescript
// isMobile branches to the correct testid automatically
get stakeInput(): Locator {
    const isMobile = (this.page.viewportSize()?.width ?? 1024) < 1024;
    return isMobile
        ? this.page.getByTestId('dt_stake_input')
        : this.page.getByTestId('dt_stake_input_desktop');
}
```

**Rules:**

- If both platforms use the same testid and interaction, show a single method chain (no Desktop/Mobile split)
- The Page Object locator pattern note is for the `flow-to-playwright` skill — include it so the POM is generated correctly
- Always show `isMobile` as `(this.page.viewportSize()?.width ?? 1024) < 1024`

### Section 3 — Tags Reference

```markdown
| Tag              | When to apply                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `@auth`          | Login, logout, session handling                                                                 |
| `@trade`         | Trade form + contract details (desktop and mobile — use with `@desktop` or `@mobile` to filter) |
| `@positions`     | Open positions list                                                                             |
| `@reports`       | Positions tab, P&L, statement                                                                   |
| `@notifications` | Notification centre                                                                             |
| `@smoke`         | Critical path — must pass on every run                                                          |
| `@staging`       | Uses account creation or Mailisk                                                                |
| `@production`    | Safe to run on production (read-only)                                                           |
| `@desktop`       | Desktop viewport (chromium project)                                                             |
| `@mobile`        | Mobile viewport (chromium-mobile project)                                                       |
```

### Section 4 — Feature-Specific Decisions

Record DTrader-specific non-obvious rules, e.g.:

- Which MobX store observables drive the feature's conditional UI
- Whether the feature requires a funded real account vs demo
- Desktop (`Modules/`) vs mobile (`AppV2/`) component split and how tests handle both
- Any `waitForDerivApiSettled` call required after a specific action
- Known testids set dynamically (e.g. `data-testid={item.dataTestId}`) — these need MCP verification

### Page Object section ordering convention

When documenting or sketching a Page Object class in catalog Section 4 or flow notes, always follow this order:

1. **LOCATORS** — all `get` accessors (public, then private if any)
2. **ACTIONS** — public methods first, private helpers last
3. **VERIFICATIONS** — public assertion methods first, private helpers last

```typescript
class TradeRiseFallPage extends TradeParametersPage {
    // ── LOCATORS ──────────────────────────────────
    get riseButton() { return this.page.getByTestId('dt_purchase_call_button'); }
    get fallButton() { return this.page.getByTestId('dt_purchase_put_button'); }

    // ── ACTIONS (public) ──────────────────────────
    async buyRise() { await this.riseButton.click(); }
    async buyFall() { await this.fallButton.click(); }
    async buyRiseAndVerify(...) { /* orchestrated */ }
    async buyFallAndVerify(...) { /* orchestrated */ }

    // ── ACTIONS (private) ─────────────────────────
    private async dismissToast() { ... }

    // ── VERIFICATIONS (public) ────────────────────
    async verifyOpenPositionsVisible(...) { ... }
    async verifyContractDetailsPage(...) { ... }

    // ── VERIFICATIONS (private) ───────────────────
    private async assertBalanceUpdated() { ... }
}
```

This ordering applies to the catalog note and is the convention the `flow-to-playwright` skill uses when generating the actual POM file.

---

## ✍️ Step 8 — Generate `coverage.md`

Follow `coverage-template.md` exactly.

```markdown
# <Feature> Journey Coverage

**Analysis date:** <today's date YYYY-MM-DD>
```

Check for existing specs:

```bash
find "playwright/tests/<module>" -name "*.spec.ts" 2>/dev/null
```

For each existing spec, mark `✅` in the corresponding coverage row.

**Priority assignment:**

| Priority | When to assign                                               |
| -------- | ------------------------------------------------------------ |
| `P0`     | Core trading flow — gates release                            |
| `P1`     | Key user path — high traffic, financially sensitive          |
| `P2`     | Important but non-blocking — validation, secondary UI states |
| `P3`     | Edge case — mobile-only variant, rarely-hit error state      |
| `N/A`    | Not automatable — see N/A patterns above                     |

---

## 📁 Step 9 — Write Output Files

```
playwright/flows/<module>/flow.md
playwright/flows/<module>/catalog.md
playwright/flows/<module>/coverage.md
```

For existing files, apply surgical edits only — never rewrite wholesale.

---

## 🔄 Step 10 — Sync `_index.md`

After writing flow docs, immediately run:

```
Follow _orchestrator.md and sync _index.md.
```

---

## ✅ Post-Generation Checklist

- [ ] **All Markdown tables use `| --- |` separator rows** — no wide dashes, no `|:---:|`, no `|---|`
- [ ] **All table cells have single-space padding** — `| value |` not `| value   |` or `|value|`
- [ ] **`#` column values are unpadded integers** — `| 1 |` not `| 1   |`
- [ ] No trailing whitespace on any table row
- [ ] Module source paths confirmed — used `packages/` paths, not `src/app/` or `src/features/`
- [ ] Both desktop (`Modules/`) and mobile (`AppV2/`) source paths scanned for every feature
- [ ] Each testid tagged by platform (Desktop / Mobile / Both) in working notes from Step 3b
- [ ] Desktop/mobile differences handled via `Platform` column in `flow.md` step tables — not as separate flows
- [ ] No redundant flows — every flow's steps are not already fully covered as postconditions of another flow
- [ ] No investigation-note gaps — every gap row is either "not yet automated" or "not automatable"; rows that say "covered by Flow N" have been removed entirely
- [ ] Catalog shows separate Desktop/Mobile method chains only where interactions differ
- [ ] `isMobile` locator pattern noted in catalog for all testids that differ by platform
- [ ] All `data-testid` values sourced from actual TSX files — none guessed
- [ ] **Purchase button display names verified from `packages/shared/src/utils/constants/contract.ts`** — never guessed (Turbos = "Up"/"Down" NOT "Long"/"Short")
- [ ] **Dual-outcome trade types split into sub-flows** (N.1 / N.2) — one sub-flow per button direction, never merged
- [ ] **Optional param variants (TP, SL, DC) each get their own sub-flow pair** — one pair per optional param combination
- [ ] **Catalog Section 2 has one `describe` per spec file with one `test()` per sub-flow** — no sub-flows merged into a single test
- [ ] Copy sourced from `i18n_default_text` or `localize()` — never invented
- [ ] MobX store observables checked for conditional rendering — all state branches documented as flows
- [ ] Step 2 inventory built and Step 4 classification run — no duplicates added
- [ ] Step 4b cross-module duplicate check run
- [ ] Diff summary (Step 4c) printed before any file written
- [ ] `flow.md` follows mandatory header + section structure from `flow-template.md`
- [ ] `catalog.md` has all 4 sections
- [ ] `coverage.md` has today's date in `**Analysis date:**`
- [ ] Every gap has a matching `### G{n}` section in `flow.md` and a row in `coverage.md` Section 2
- [ ] N/A flows marked in both files with explanation
- [ ] **`trade-automate`:** module annex applied — strategy × trade-type matrix, demo/real child IDs, Accumulators **6.1–6.4**, dual-outcome **N.1–N.4**, panel flows **1–4 / 14–15**, embedded Flow 1 noted
- [ ] **`trade-automate`:** `coverage.md` Section 1 sorted numerically; row count matches matrix (~44 incl. G2)
- [ ] `_orchestrator.md` run to sync `_index.md`

---

## 🗂️ Invocation Examples

```
/src-to-flow-dtrader                                                              ← prompts for module name
Follow src-to-flow-dtrader skill and generate flow docs for module: trade
Follow src-to-flow-dtrader skill and generate flow docs for module: positions
Follow src-to-flow-dtrader skill and generate flow docs for module: reports
Follow src-to-flow-dtrader skill and generate flow docs for module: notifications
Follow src-to-flow-dtrader skill and generate flow docs for module: auth
Follow src-to-flow-dtrader skill and generate flow docs for module: trade-automate
```

After this skill completes, the next step is:

```
Follow flow-to-playwright skill and implement flows for module: <module_name>
```
