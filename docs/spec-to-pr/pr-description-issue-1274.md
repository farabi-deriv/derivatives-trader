# chore: remove dead code from @deriv/core and @deriv/trader (C8b + C8c)

Closes #1274

**Base branch: `akmal/issue-1273-c8-small`** — not `master`. GitHub retargets this PR to `master`
when #1273 merges. `master` was neither rebased onto nor merged in.

373 files changed, 54 insertions, 14,923 deletions. `packages/core/src` non-test LOC 12,935 →
11,458 and SCSS 4,884 → 2,231; `packages/trader/src` non-test LOC 52,533 → 49,549 and SCSS
15,441 → 11,755. Declared `dependencies`: core 53 → 31, trader 38 → 31.

## (a) CI runs only 3 of 11 checks on this PR

`.github/workflows/test.yml` is filtered to `pull_request: branches: [master]`, and this PR
targets a feature branch. **Did not run:** Build Project, TypeScript & Linting, all three Jest
groups, and the SCA scan. Separately, the workflow's "Check TypeScript" step backgrounds its `tsc`
runs behind a bare `wait` and targets the removed `packages/api-v2`, so it always exits 0 and is
not a gate even when it does run (filed by C7 at
`docs/spec-to-pr/deferrals/ci-typescript-gate-is-a-no-op.md`; not re-filed here).

Local results in place of those checks:

| Gate                                                 | Result                                                                                                                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run bootstrap`                                  | exit 0                                                                                                                                                                                     |
| `npm run build:all`                                  | exit 0, 0 `ERROR` (88 pre-existing "Conflicting order" CSS warnings)                                                                                                                       |
| `npm run test:jest -- packages/core`                 | 38/38 suites, 340/340 tests                                                                                                                                                                |
| `npm run test:jest -- packages/trader`               | 288/288 suites, 2872/2872 tests                                                                                                                                                            |
| `npx tsc -p packages/trader/tsconfig.json --noEmit`  | **0** errors (unchanged)                                                                                                                                                                   |
| `npx tsc -p packages/core/tsconfig.json --noEmit`    | 234 total `error TS` lines, **26** non-test, of which exactly **1** is under `packages/core` — still `login-button.tsx(34,13) TS2339` (pre-change: 277 total / 26 non-test / 1 core-owned) |
| `npm run test:eslint --workspace=@deriv/core`        | 0 errors                                                                                                                                                                                   |
| `npm run test:eslint --workspace=@deriv/trader`      | 0 errors                                                                                                                                                                                   |
| `npm run test:stylelint`                             | exit 0                                                                                                                                                                                     |
| `npm run check-imports`                              | exit 0                                                                                                                                                                                     |
| `npm run knip:check`                                 | exit 0 — 306 findings, matching the regenerated baseline (was 380)                                                                                                                         |
| `npm run baseline:check`                             | exit 0                                                                                                                                                                                     |
| `npx @fission-ai/openspec@1.7.0 validate … --strict` | valid                                                                                                                                                                                      |

Emitted CSS: `packages/core/dist` 4,973,509 → **4,767,107 B** (−206,402 B) against the committed
baseline. The trader CSS byte figure is **not** comparable to the committed `1,375,909 B` — that
number predates intervening `master` merges, and `docs/baselines/README.md` treats bundle bytes as
informational, never a gate. The SCSS source deltas above are the reliable measure.

## (b) Corrected issue claims

Everything below was re-measured at HEAD `6da4e254dd`; where the issue body and the measurement
disagreed, the measurement won.

1. **The alias map is not in "3 copies (tsconfig + jest + webpack)".** `packages/trader` declared
   `Fonts`/`Images`/`Translations` in **`tsconfig.json` only** — `build/constants.js`'s `ALIASES`
   (7 roots) and `jest.config.js`'s `moduleNameMapper` never carried them, and `knip.json` declares
   no `paths` for trader. `packages/core` declared them in **`build/constants.js`** and the
   repo-root **`knip.json`**, and in neither its `tsconfig.json` nor its `jest.config.js`.
2. **Only the core removal moves `alias-usage.json`.** `roots.core` lost `Fonts` and `Translations`
   and kept `Images`; `roots.trader` is byte-identical.
3. **`Images` is kept on the core side.** `packages/core/src/public/images/` is live — favicons,
   `logos/platform_logos/` and `static_images/` are copied by `build/config.js` and read through
   `getUrlBase`.
4. **Core's `BinaryLink` is live** and stays exported — `menu-link.tsx:9` and
   `notification.jsx:12`. (`endpoint-note.jsx` and `notification-order.jsx`, the other two
   consumers, are deleted here.) It is a different module from `packages/reports`' namesake, which
   #1273 deleted.
5. **`LiveChat` does not exist** under `packages/core` at HEAD. Marked already-satisfied; nothing
   was deleted in its place.
6. **`Routes/helpers.ts` is _not_ dead in full, and not a "trio" either.** `getContractPath` is
   shadowed (every consumer imports `@deriv/shared`'s), and `getPath` fed only it, so both go with
   `isRouteVisible`. But `normalizePath` and `findRouteByPath` are **live**:
   `App/Components/Routes/binary-link.tsx:4` imports them directly and calls them at `:23-24`, and
   `binary-link.tsx` is on the DCR-049 KEEP list. The file is therefore pruned to those two exports
   rather than deleted, its spec is pruned to match, and the `export * from './helpers';` barrel
   line is dropped. Deleting the file as the plan asked would have broken a KEEP-set member.
   **DCR-036, `design.md`'s correction table and task 6.1 were amended to the measured truth**, so
   the requirement that gets archived matches the code.
7. **`logout.js` had one dead export, not three.** `requestLogout` (test-only) and the
   now-unreachable `doLogout` are gone; `requestRestLogout` is live at `client-store.js:22`.
   Nothing reachable lost behaviour — `client-store.cleanUp()` is the live logout cleanup and never
   went through `doLogout`.
8. **Core's dead dependency count is 15, not 16.** `@deriv/trader`, `@deriv/reports` and `core-js`
   look dead to a source grep and are live (lazy `import()` in `routes-config.js` plus a path
   resolve in `build/config.js`; `useBuiltIns: "usage"` with `corejs: 3` in `babel.config.json`).
9. **`Constants/index.js` was already correct** — a single `export * from './ui';`, so the barrel
   half of that bullet needed no change. Only `Constants/currency.js` was deleted.
10. **`RecentTradeInfo` is live, not runtime-dead.** `is_digits_widget_active` is a _prop_ of
    `TopWidgets`, and the only production call site — `ChartTopWidgets` in
    `contract-replay-widget.tsx` — never passes it, so `!undefined` is `true` and the component
    renders. Kept, with a deferral.
11. **`trader` type baseline is 0, not "non-zero for both".** Core's 277 lines are mostly test-file
    matcher errors; only **1** non-test error is core's own.
12. **`AccumulatorStats` (singular) is a live AppV2 component**, distinct from the deleted
    `Modules/Contract/Components/AccumulatorsStats/` (plural).
13. **`icon-trade-categories.tsx` stays importable at its current path** — `market-info-screen.tsx:28`.
14. **`AppV2/Components/Guide/Description/` is a different, live tree** from the deleted
    `Assets/Trading/Categories/Description/`.
15. **`.trade-container` is live** — `contract-replay.tsx:97` renders `trade-container__replay`
    (styled in `trader-layouts.scss`), and `@deriv/components` emits `trade-container__popover` and
    `__tooltip`. Only the v1 form block inside `sass/app/modules/trading.scss` went; the
    `&__popover` rule stayed.
16. **`accumulators-stats.scss` could not be deleted, only pruned.** Its `@keyframes
spot-emphasizer` is consumed by `smart-chart.scss:645` for the live
    `.sc-current-spot-emphasizer` marker, and an undefined animation name is legal CSS — sass-loader
    would not have failed, the animation would just have stopped. Its `.cq-bottom-ui-widgets` rule
    is chart-library-facing and protected by rule.
17. **`purchase-button.scss` is not wholly dead.** `core/src/Stores/ui-store.js:553-560` still
    writes `btn-purchase`, `--swoosh` and `--disabled`, so those interlocking rules stayed; the 14
    standalone dead blocks (430 → 172 LOC) went.
18. **Three trader SCSS partials were never imported at all** and are not in the issue's list:
    `modules/trading-mobile.scss` (565), `_common/mobile-widget.scss` (221) and
    `_common/components/positions-toggle.scss` (122). `app.scss` never referenced them and the
    trader sass tree has no nested `@import`, so they emitted zero CSS.

## (c) The KEEP set, and why each member is live

- **`packages/core/src/_common/base/socket_cache.js` — `getByMsgType` first.** Zero in-repo call
  sites _by design_: `@deriv/deriv-api`'s `DerivAPIBasic` duck-type-calls it as
  `storage.getByMsgType`. It is invisible to every static tool in this repo.
  `git diff packages/core/src/_common/base/socket_cache.js` is **empty**.
- **`socket_base.sendKeepAlive`** — defined `:113`, consumed at `network_monitor_base.js:63`/`:87`,
  wired to `setInterval` at `:135`, exported at `:406`. **`socket_base.waitForAuth`** — gates the
  authorized proxy, client-store boot and gtm-store. Neither appears in the diff. Only three
  proven-dead exports were trimmed from that module: `blockRequest`, `getSocket`,
  `removeOnDisconnect` (zero references anywhere, no internal caller).
- **`binary-link.tsx` / `BinaryLink`** — two live consumers; see (b)(4) and (b)(6).
- **`language-link.tsx`** — kept; `packages/shared/src/__tests__/dead-code-sweep.spec.ts:54` reads
  it with `fs.readFileSync`. Only its named export was dropped from the barrel.
- **`trading_disabled`/`inactive` gating and `redirectToLogin`/`redirectToSignUp`** — `initStore.js:140`,
  `account-switcher.tsx:114`, `login-button.tsx:19`.
- **The external cross-app redirects**, including the insufficient-balance **Deposit now** in
  `service-error-sheet.tsx:62`.
- **`.reset-password*`** — live via `RedirectToLoginModal`, which applies
  `reset-password__password-selection`, `__heading` and `__subtext`. Those three rules are exactly
  what survived the 338 → 18 LOC prune.
- **`symbol-categories-utils.ts` / `categorizeSymbols`** — the module has five live production
  consumers; kept verbatim, not de-exported.
- **`icon-trade-categories.tsx`** and **`AppV2/Config/trade-parameter-presets.ts` as a module**
  (six importers).
- **`useRiskDisclosure` gating in `purchase-button.tsx`** — regulatory (Spain).
- **The four `commission` copy sites** — `contract-description-utils.tsx:74`,
  `multipliers-trade-description.tsx:55` and `:61`, and the `PayoutPerPoint`/`Strike`/`GrowthRate`
  SCSS comments. PR #1107 removed the commission _mechanism_; these document it, which is a product
  decision.
- **Chart-library classes `cq-*`/`stx-*`/`sc-*`/`ciq-*`** and dynamically-composed classes. The
  SCSS diff contains no deletion of such a selector in either package.
- **A live `packages/components` override reached from core SCSS:**
  `side-menu.scss` was pruned to its `.dc-vertical-tab__tab .dc-vertical-tab__header` block rather
  than deleted, because that rule restyles `@deriv/components`' `VerticalTab`, live on desktop
  Reports (`reports.tsx:222`). `.side-menu` itself had zero references and went.

`git diff --name-only` contains no path under `packages/shared/`, `packages/components/`,
`packages/reports/`, `packages/api/`, `packages/stores/` or `packages/utils/`.

## (d) Deferrals

Filed under `docs/spec-to-pr/deferrals/`:

1. `core-language-link-guarded-by-shared-spec.md` — deleting `language-link.tsx` turns a
   `packages/shared` spec red, and that package is off-limits here.
2. `core-front-channel-oidc-registration.md` — the only thing that could reference
   `front-channel.html` is an external IdP's `frontchannel_logout_uri`, which cannot be settled
   from this tree. A gate that cannot be discharged is not a gate that passes.
3. `core-migration-onboarding-orphan-images.md` — 26 orphaned `migration-onboarding-*.png` (2.0 MB,
   10× the asset bullet's stated scope, and the KEEP list names MigrationOnboarding).
4. `core-missing-notification-banner-images.md` — `notification-store.js:368`/`:436` read
   `trustpilot_banner.png` and `derivgo_banner.png`, neither of which exists. Pre-existing defect.
5. `trader-top-widgets-runtime-dead-branch.md` — `RecentTradeInfo` proven **reachable**: the
   `is_digits_widget_active` prop is never passed at the only call site, so `!undefined` is `true`
   and the component renders. Kept, with the unused prop, because which of the two the product
   wants is not a question this sweep can answer. (The `InfoBox` half of this deferral was
   **resolved** — see §(i).)
6. `trader-contract-type-dialog-scss-guarded-by-components-spec.md` — every class in it is dead, but
   `packages/components/src/__tests__/dead-code-sweep.spec.ts:91` reads the file by path. Same
   coupling as (1), different package.
7. `trader-spec-only-exports-and-type-aliases.md` — the barrel re-exports whose only importers are
   their own specs, the duplicate default+named exports, and the ~30 type aliases. None returns zero
   on a repository-wide grep, so none met the evidence bar; the subset that did was removed.

## (e) `pinned_trade_types` is left orphaned in `localStorage`

The TradeTypes deletion removes its only readers and writers. No cleanup shim is written: the key
is inert, costs bytes, and a migration would outlive its purpose.

## (f) Commission copy and `trade-parameter-presets.ts` were retained

See (c). Both are product decisions, not cleanup ones.

## (g) Test story — characterization only, no cited red

Per `.buildwright/framework/tdd-evidence.md`: **no test in this change went red first, because no
behaviour changes.** The two new specs —
`packages/core/src/__tests__/dead-code-sweep.spec.ts` (39 assertions) and
`packages/trader/src/__tests__/dead-code-sweep.spec.ts` (37 assertions) — are **characterization
guards**, declared as such. They pin structure that already holds and were written after the
deletions they guard, following the pattern already used by `packages/shared`,
`packages/components`, `packages/reports`, `packages/api`, `packages/stores` and `packages/utils`.
Their point is to encode the KEEP set as executable assertions so the next sweep cannot delete
`getByMsgType` on a clean grep.

Every other test change is the deletion of a spec whose only subject is deleted in the same commit,
plus two prunes: `Routes/__tests__/helpers.spec.ts` lost the cases for the three removed exports and
kept the two live ones, and `NotificationMessage/__tests__/notification.spec.tsx` lost the
`type: 'news'` case with the branch it tested. One stale `jest.mock('../../PositionsDrawer', …)` in
`Sidebar/__tests__/sidebar.spec.tsx` was removed with the barrel it mocked — the component under
test imports `positions-drawer-tabs` directly, mocked separately, so the removal is inert.

`packages/shared/src/__tests__/dead-code-sweep.spec.ts` is byte-identical.

## (h) Playwright was not run

The suite has no `pull_request` trigger and needs staging plus encrypted secrets; no run was
attempted. The specs covering the touched trade flows are:

`playwright/tests/trade/` — `verify-trade-form-loads.spec.ts`,
`rise-fall/verify-rise-fall.spec.ts`, `rise-fall/verify-rise-fall-allow-equals.spec.ts`,
`higher-lower/verify-higher-lower.spec.ts`, `touch-no-touch/verify-touch-no-touch.spec.ts`,
`even-odd/verify-even-odd.spec.ts`, `over-under/verify-over-under.spec.ts`,
`matches-differs/verify-matches-differs.spec.ts`,
`accumulators/verify-accumulators-no-tp.spec.ts`, `accumulators/verify-accumulators-with-tp.spec.ts`,
`multipliers/verify-multipliers-no-tpsl.spec.ts`, `multipliers/verify-multipliers-with-tp.spec.ts`,
`multipliers/verify-multipliers-with-sl.spec.ts`,
`multipliers/verify-multipliers-deal-cancellation.spec.ts`, `turbos/verify-turbos.spec.ts`,
`turbos/verify-turbos-tp.spec.ts`, `vanillas/verify-vanillas.spec.ts`.

`playwright/tests/trade-automate/` — `verify-account-switch-resync.spec.ts`,
`verify-threshold-stop.spec.ts`, and the martingale/d'Alembert pairs under `rise-fall/`,
`even-odd/`, `over-under/`, `matches-differs/` and `accumulators/`.

## (i) The InfoBox tree was deleted after all

DCR-044 lists `Modules/Contract/Components/InfoBox/` under "SHALL be deleted", and it is now gone
in full. `contract-replay-widget.tsx` instantiated it, but `TopWidgets` never rendered the element
— the slot was commented out behind `// TODO: enable or delete when decision is made` — so nothing
reachable lost behaviour. Removed as one unit: the 5 files (`info-box.tsx`,
`info-box-longcode.tsx`, `index.ts`, 2 specs), `InfoBoxWidget`, the `InfoBox?` entry in
`TTopWidgets` and its destructure, the commented slot, the `<InfoBoxWidget />` prop on
`ChartTopWidgets`, the `<InfoBoxWidget />` describe block and its `jest.mock`, the `InfoBox` mocked
prop and the commented-out desktop case in `top-widgets.spec.tsx`.

The SCSS went with it: `sass/app/modules/contract.scss` (208 LOC) turned out to be _entirely_
`.info-box-container` plus `.dc-modal__container_info-box-longcode--modal` and the
`$CONTRACT_INFO_BOX_PADDING` variable only it used, so the whole file and its `@import` were
removed; and the four `.info-box` selectors in `_common/layout/trader-layouts.scss` were dropped
from their comma groups, leaving every `.cq-top-ui-widgets` sibling and nested `cq-*`/`ciq-*` rule
intact.

`Modules/Contract/Components/contract-error.tsx` and its spec were deleted with them:
`info-box.tsx` was its sole importer, so the deletion orphaned it, and leaving it would have banked
fresh dead code into the knip baseline.

## Expected CI behaviour

`package-lock.json` changed (`npm run bootstrap` is `npm ci`, which never updates it, so the lock
was synced with `npm install --package-lock-only`; `npm ci --dry-run` then exits 0). The first
`test` run is expected to time out — `timeout-minutes: 12` against a cold npm cache; `gh pr checks`
reports "fail" while the API reports "cancelled" with zero failed steps. Re-run once the cache is
warm. No test code was changed to work around it.
