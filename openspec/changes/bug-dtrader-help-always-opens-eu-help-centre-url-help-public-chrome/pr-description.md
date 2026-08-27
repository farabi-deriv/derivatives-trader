# PR description — geo-aware DTrader Help centre routing

> Prepared PR body for the shipping stage. Base: `upstream/master` (deriv-com/derivatives-trader).

Closes deriv-com/derivatives-trader#1252

## Why

Every DTrader Help entry point resolved through `platform.help_centre_url` =
`https://trade.deriv.com/help-centre/deriv-trader`. That hop is a property outside this repo, and at
the time of the report it forwarded **all** visitors — Spain and Kenya alike — to
`https://deriv.com/eu/helpcentre/deriv-trader`, so non-EU visitors got the EU help centre and
EU-only CFD risk copy.

## What changed

One shared resolution rule, delegated to the party that owns the regional help-centre IA:

- `brand.config.json`: `platform.help_centre_url` → `https://deriv.com/helpcentre/deriv-trader`.
  The deriv.com content site owns `/help-centre/` (global) vs `/eu/helpcentre/` (EU) and geo-routes
  its own visitors; the app no longer routes Help through an intermediate hop that discards that
  decision.
- `packages/shared/src/utils/brand/brand.ts`: `getHelpCentreUrl()` JSDoc documents the new
  destination and the delegation; the `substituteDerivDomain()` pass-through is untouched, so
  deriv.be / deriv.me deployments keep linking within their own TLD.
- `packages/core/src/App/Components/Layout/Footer/help-centre.jsx` (exported but currently
  unmounted): switched from `StaticUrl href='/help-centre/'` — which built a third, divergent
  destination via `getStaticUrl` — to an anchor fed by the same `getHelpCentreUrl()`, keeping
  `id='dt_help_centre'`, the aria-label, `target='_blank'` and `rel='noopener noreferrer'`.
- Live call sites (`sidebar.tsx`, `menu.tsx`) are untouched — same synchronous
  `window.open(getHelpCentreUrl(), '_blank', 'noopener,noreferrer')` contract.

**For product sign-off:** this deliberately drops the `trade.deriv.com` hop. Issue #1252's
_Expected_ names `https://deriv.com/helpcentre/deriv-trader` as the correct destination, so the
change routes straight to the content site. If the hop was intentional (funnelling into a trade-hub
help experience), flag it here. Note the content site 301s the configured URL to its canonical
hyphenated path `https://deriv.com/help-centre/deriv-trader`; the config keeps the exact URL the
issue names, and the 301 is the content site's own canonicalisation.

## Verification gate (task 1.2) — runtime evidence, 2026-08-26

Observed from real non-EU egress (Malaysia, `curl` + served-HTML inspection; browser automation was
not permitted in the implementation environment):

- `https://deriv.com/helpcentre/deriv-trader` → single 301 → `https://deriv.com/help-centre/deriv-trader`
  → HTTP 200. Final URL has **no `/eu/`**; the page is the global Derivatives Trader help centre
  (`hreflang x-default` = the global URL). **Non-EU half: PASS.**
- EU IA exists and is canonical: `https://deriv.com/eu/helpcentre/deriv-trader` → HTTP 200
  (`/eu/help-centre/…` 301s to it).
- The content site runs country-driven client-side routing: its pages initialise GrowthBook with a
  `country` attribute read from the `clients_country`/`website_status` cookies and
  `navigate: url => window.location.replace(url)` — the machinery that lifts EU visitors.
- **EU half: could not be executed from this environment** (no EU egress available). Recorded as a
  before-production manual check in `docs/spec-to-pr/findings/before-production.md`; the manual test
  steps below cover it. The bounded failure mode if EU lift were absent is the spec's own safe
  default (EU visitor sees the global centre) — never the reported misrouting. If EU egress is not
  lifted, the plan's group 4 contingency (in-app market resolver + `help_centre_url_eu`) is
  pre-broken-down in `tasks.md`.
- Bonus observation: `https://trade.deriv.com/help-centre/deriv-trader` now 301s to the **global**
  page from MY egress — the hop's EU-pinning is geo-conditional or partially fixed since June; the
  hop is escalated regardless (below).

## Tests (TDD evidence)

Red → green, both new suites run against the unfixed code first:

- Red: `getHelpCentreUrl › should return the content-site help centre URL on a deriv.com hostname` —
  expected `https://deriv.com/helpcentre/deriv-trader`, received
  `https://trade.deriv.com/help-centre/deriv-trader` (all 4 tests in
  `packages/shared/src/utils/brand/__tests__/brand.spec.ts` failed on the old config).
- Red: `<HelpCentre /> › should link to the shared help centre URL with protected new-tab attributes` —
  expected `href="https://help.deriv.com"` (the mocked `getHelpCentreUrl`), received
  `href="https://deriv.com/help-centre"` (the divergent `getStaticUrl` URL), in
  `packages/core/src/App/Components/Layout/Footer/__tests__/help-centre.spec.jsx`.
- Green: `npx jest packages/shared/src/utils/brand packages/trader/src/AppV2/Components/Layout/Sidebar
packages/core/src/Modules/Menu packages/core/src/App/Components/Layout/Footer --config jest.config.js`
  → 8 suites, 101 tests, all passing.
- Contract preserved: `packages/core/src/Modules/Menu/__tests__/menu.spec.tsx` passes **unchanged**
  (opaque `getHelpCentreUrl` mock + `window.open(..., '_blank', 'noopener,noreferrer')` assertion).
  `sidebar.spec.tsx` only swaps the mocked URL; the `window.open` assertion shape is unchanged.
- Characterisation note: the second footer test (attributes with the tooltip popover) and the
  attribute assertions pin behaviour that must not change; the href assertions are the red→green
  pair.

## Type-check sanity (task 3.2)

- `npx tsc -p packages/trader/tsconfig.json`: 4 errors, all in
  `packages/components/src/components/inline-message/inline-message.tsx` — the known pre-existing
  master baseline; none in changed files.
- `npx tsc -p packages/shared/tsconfig.json`: this tsconfig type-checks spec files without jest
  globals, so every existing spec errors on `describe`/`it`/`expect` on master (e.g. 244 in
  `contract.spec.ts`, 110 in `config.spec.ts`). The only delta vs master is the new
  `brand.spec.ts`, whose 12 errors are the same pre-existing classes (TS2582/TS2304 jest globals,
  plus one TS2322 from the `mockLocation` pattern — identical to master's `config.spec.ts:57`).
  Production sources changed here (`brand.ts`) type-check clean.

## Manual test steps (previous vs expected)

All steps logged out, once from non-EU egress (e.g. Kenya, as in the report) and once from EU egress
(e.g. Spain).

**(a) Desktop sidebar Help — viewport ≥ 1280 px**

1. Open DTrader (trade page), stay logged out.
2. Click the Help item in the left sidebar (`data-testid="dt_sidebar_help"`; life-ring icon).
3. Previous: a new tab finally landed on `https://deriv.com/eu/helpcentre/deriv-trader` (EU help
   centre + CFD risk copy) regardless of egress.
4. Expected now: a new tab opens (opener severed — `noopener,noreferrer`); non-EU egress finally
   renders the global help centre `https://deriv.com/help-centre/deriv-trader` with no `/eu/` in the
   URL and no EU-only CFD risk copy; EU egress finally renders
   `https://deriv.com/eu/helpcentre/deriv-trader`. Label, icon and `dt_sidebar_help` test id are
   unchanged.

**(b) Mobile Menu → Help centre**

1. Open DTrader in a mobile viewport, stay logged out; open the Menu page and find “Help centre”
   under Support.
2. Tap “Help centre”.
3. Previous: as above — always the EU help centre.
4. Expected now: identical destination rule as the desktop sidebar for the same visitor — global
   help centre for non-EU egress, EU help centre for EU egress, opened in a new tab with
   `noopener,noreferrer`. Label and icon unchanged.

**(c) Footer Help centre link (`dt_help_centre`) — not currently mounted**

No visible surface to test today; covered by unit tests asserting it resolves through the same
`getHelpCentreUrl()` rule with `target='_blank'` and `rel='noopener noreferrer'`, so it cannot drift
if remounted.

## Escalation of the root external defect (task 3.4)

`trade.deriv.com/help-centre/deriv-trader` forwarding visitors to `/eu/` misroutes anything that
links there. Escalated for routing to the trade.deriv.com owners, with the 2026-08-26 observations:
https://github.com/deriv-com/derivatives-trader/issues/1252#issuecomment-5421268546
(also recorded in `docs/spec-to-pr/findings/trade-deriv-com-help-centre-redirect-discards-market.md`).

## Documentation

No doc updates needed — the link destination is config-internal (`brand.config.json` +
`getHelpCentreUrl()` JSDoc, both updated in this PR); no README or user docs in this repo describe
the Help URL.
