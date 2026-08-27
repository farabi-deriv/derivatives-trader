# Proposal: Geo-aware DTrader Help centre routing

Fixes [#1252](https://github.com/deriv-com/derivatives-trader/issues/1252) — "[Bug] DTrader Help always opens EU help-centre URL — Help / public chrome" (P2-High, bughunt, product:dtrader.deriv.com).

## Why

Every Help entry point in DTrader's public chrome opens one fixed URL for every visitor: `getHelpCentreUrl()` (`packages/shared/src/utils/brand/brand.ts:195-200` on `upstream/master`) returns `platform.help_centre_url` from `brand.config.json:18` — `https://trade.deriv.com/help-centre/deriv-trader` — with only TLD substitution (deriv.com → deriv.be/.me) and no market awareness. That URL currently forwards **all** visitors to the EU help centre (`https://deriv.com/eu/helpcentre/deriv-trader`), so a logged-out visitor in Kenya (confirmed via VPN in the bug report, desktop and mobile, always reproducible) sees EU CFD risk copy ("74% of retail investor accounts…") and the EU-restricted information architecture instead of the global help centre. Non-EU users get regulated-market warnings and potentially wrong product guidance; the Help CTA does not honour its definition for the visitor's market.

## What Changes

- The Help destination becomes **market-aware**: visitors in an EU regulatory market reach the EU help centre; all other visitors reach the non-EU (global) help centre, e.g. `https://deriv.com/helpcentre/deriv-trader`.
- When the visitor's market cannot be determined (signal missing, still loading, or errored), the destination **defaults to the non-EU (global) help centre** — fail-safe, so nobody is shown EU-only regulated risk warnings by default.
- All Help entry points resolve their destination through **one shared rule** (a single helper), so desktop sidebar Help (`dt_sidebar_help`, `packages/trader/src/AppV2/Components/Layout/Sidebar/sidebar.tsx`) and mobile Menu → Help centre (`packages/core/src/Modules/Menu/menu.tsx`) can never diverge again. The currently unmounted footer `HelpCentre` component (`packages/core/src/App/Components/Layout/Footer/help-centre.jsx`, `dt_help_centre`) — today pointing at a third, different destination — is aligned to the same rule so it cannot reintroduce the bug if remounted.
- Link mechanics are **unchanged**: Help still opens in a new tab with `noopener,noreferrer`, and keeps its existing label, icon, and `data-testid`s (`dt_sidebar_help`, `dt_help_centre`).
- No visual/UI change — behaviour-only fix (no mockup or visual acceptance artifacts needed).

## Capabilities

### New Capabilities

- `help-centre-geo-routing`: where the DTrader Help entry points send the visitor — the help centre matching the visitor's regulatory market (EU vs non-EU/global), a safe non-EU default when the market is unknown, one shared resolution rule across every Help entry point, and preserved link-opening mechanics.

### Modified Capabilities

_None — `openspec/specs/` has no existing capabilities; this change introduces the first spec for Help routing._

## Impact

- **Code** (paths as on `upstream/master`, the implementation base):
    - `packages/shared/src/utils/brand/brand.ts` — `getHelpCentreUrl()` becomes the single market-aware resolution point.
    - `brand.config.json` — `platform.help_centre_url` (the single static URL that causes the bug) is replaced/augmented with market-appropriate destination(s).
    - `packages/trader/src/AppV2/Components/Layout/Sidebar/sidebar.tsx` (`handleHelpCentreClick`, line 93; `dt_sidebar_help` item, line 158) — consumer, call-site unchanged if the helper keeps its signature.
    - `packages/core/src/Modules/Menu/menu.tsx:50-52` — consumer, same.
    - `packages/core/src/App/Components/Layout/Footer/help-centre.jsx` — unmounted component aligned to the shared rule.
    - Tests: `packages/trader/src/AppV2/Components/Layout/Sidebar/__tests__/sidebar.spec.tsx`, `packages/core/src/Modules/Menu/__tests__/menu.spec.tsx`, plus new unit coverage for the resolution rule.
- **External dependencies**: the final destination lives on the deriv.com content site, whose regional information architecture (`/helpcentre/` vs `/eu/helpcentre/`) this repo does not own; the design records how the market decision is sourced and what must be verified at runtime.
- **No API contract changes**; no new authenticated calls required for the logged-out path.
- **Repo/branch note**: the local checkout (`origin` = akmal-deriv fork) is 629 commits behind `upstream/master` (deriv-com/derivatives-trader) and predates the Sidebar/Menu code entirely; implementation must branch from `upstream/master`.
