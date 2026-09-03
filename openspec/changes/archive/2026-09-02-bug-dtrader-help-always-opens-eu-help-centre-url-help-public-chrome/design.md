# Design: Geo-aware DTrader Help centre routing

## Context

See `proposal.md` — Why. Current state on `upstream/master` (the implementation base — the local `origin` fork master is 629 commits behind and predates all of this code):

- `getHelpCentreUrl()` (`packages/shared/src/utils/brand/brand.ts:195-200`) returns `config_data.platform.help_centre_url` verbatim, passed through `substituteDerivDomain()` (rewrites `deriv.com` → `deriv.be`/`deriv.me` when the app runs on those TLDs). No market/geo input exists.
- `brand.config.json:18`: `"help_centre_url": "https://trade.deriv.com/help-centre/deriv-trader"`. `trade.deriv.com` is not this app and not this repo; the bug report shows that hop forwarding every visitor (Spain and Kenya alike) to `https://deriv.com/eu/helpcentre/deriv-trader`.
- Live consumers, both `window.open(getHelpCentreUrl(), '_blank', 'noopener,noreferrer')` inside a click handler:
    - `packages/trader/src/AppV2/Components/Layout/Sidebar/sidebar.tsx:93-96` (`handleHelpCentreClick`; item `dt_sidebar_help` at line 152-159) — desktop sidebar.
    - `packages/core/src/Modules/Menu/menu.tsx:50-52` — mobile Menu → Help centre (Support section, hidden inside the mobile-bridge app).
- Dead consumer: `packages/core/src/App/Components/Layout/Footer/help-centre.jsx` (`dt_help_centre`) is exported but mounted nowhere (`packages/core/src/App/Containers/Layout/` contains only `app-contents.jsx`, `bottom-nav/`, `header/`); it builds a _third_ destination via `StaticUrl href='/help-centre/'` → `getStaticUrl()` → `https://deriv.com/{lang}/help-centre/`.
- Market signals available in this app today:
    - Logged-in: derivatives account `group === 'DIEL Default Group'` ⇒ EU (`packages/trader/src/AppV2/Hooks/useIsEuAccount.ts`; mirrored in `packages/core/src/App/Containers/Layout/bottom-nav/bottom-nav.tsx:41-47`; `client.is_eu` is documented there as unreliable).
    - Logged-out (the bug's auth state): **none** — no `website_status`/`clients_country`, no geolocation fetch anywhere in `packages/**` (verified by search).
- Constraint: `window.open` must stay synchronous inside the click handler (user-gesture requirement; an `await` before `window.open` gets popup-blocked). Any market signal must therefore be resolved _before_ the click and read synchronously.

## Goals / Non-Goals

**Goals:**

- Satisfy `specs/help-centre-geo-routing/spec.md` with the smallest change that keeps every Help entry point on one resolution rule.
- Keep the click path synchronous and fail-safe (unknown ⇒ non-EU/global).

**Non-Goals:**

- Fixing the `trade.deriv.com/help-centre/deriv-trader` redirect itself (different property, not this repo — flagged to its owners instead).
- Appending interface language to the help-centre URL (the live entry points do not do this today; changing it is separate scope).
- Making the _logged-in_ Help destination follow account regulation (DIEL group) rather than visitor geo. The issue defines the expectation in terms of the visitor's market/egress; account-based override can be layered on later without changing this spec.
- Any UI/visual change.

## Decisions

### D1 — Route Help straight to the content site and let it geo-route (primary), with an in-app resolver as the verified fallback

**Chosen:** Point `platform.help_centre_url` at the content site's region-neutral help centre, `https://deriv.com/helpcentre/deriv-trader`, removing the `trade.deriv.com` hop that pins everyone to `/eu/`. The deriv.com content site owns the regional information architecture (`/helpcentre/` vs `/eu/helpcentre/`) and geo-routes its own visitors; delegating the EU/non-EU decision to the party that owns the regulated IA avoids duplicating an EU-country list and a geolocation dependency inside this app (KISS / boring technology).

**Verification gate (task 1.x):** this only holds if `https://deriv.com/helpcentre/deriv-trader` actually lifts EU egress to the EU help centre and keeps non-EU egress on the global one. That is runtime behaviour of an external property and cannot be confirmed statically from this repo (`needs_runtime_verification: true`). It MUST be checked from EU and non-EU egress (mirroring the bug report's Spain/Kenya method) before the config-only fix is accepted.

**Fallback (only if the gate fails):** resolve the market in-app and open the final URL directly:

- Add `platform.help_centre_url_eu` (`https://deriv.com/eu/helpcentre/deriv-trader`) beside the non-EU URL in `brand.config.json`.
- Add a market resolver in `@deriv/shared` that caches an EU/non-EU verdict at app bootstrap (so click-time reads are synchronous): logged-out visitors resolved by a lightweight geo country lookup mapped against an EU-country set; any failure/timeout ⇒ non-EU. `getHelpCentreUrl()` reads the cached verdict and picks the URL.
- Rejected variant of the fallback: resolving geo lazily at click time — breaks the synchronous `window.open` constraint.

**Alternatives considered:**

- _Fix the redirect on trade.deriv.com_ — correct long-term for that property, but outside this repo and leaves DTrader's Help pinned to a hop it does not control. Escalate in parallel; do not depend on it.
- _Always non-EU URL with no EU branch at all_ — simplest, but fails the spec's EU scenario and risks under-warning EU visitors; rejected.
- _Use the logged-in DIEL group signal for routing_ — does not exist for the logged-out public chrome where the bug lives; kept as a later enhancement (see Non-Goals).

### D2 — Single resolution point stays `getHelpCentreUrl()` in `@deriv/shared`

Both live call sites already funnel through `getHelpCentreUrl()`; keep them untouched (same signature, same synchronous return) and change only the helper + config. The unmounted footer `HelpCentre` component is switched from its divergent `StaticUrl href='/help-centre/'` to an anchor fed by the same helper (keeping `rel='noopener noreferrer'`, `target='_blank'`, `id='dt_help_centre'`), so the spec's one-rule requirement holds even if it is remounted.

### D3 — Fail-safe default is the non-EU (global) help centre

Regulatory rationale from the issue: showing EU-only risk copy and restricted-product IA to non-EU visitors misinforms them; a missing signal must therefore land on the global centre, never `/eu/`. Under the primary decision this is automatic (the content site's default IA is the global one); under the fallback it is the resolver's error/timeout branch.

### D4 — `substituteDerivDomain` behaviour is preserved

The helper keeps passing its result through `substituteDerivDomain()` so deriv.be / deriv.me deployments keep linking within their own TLD, exactly as today.

## Risks / Trade-offs

- [deriv.com may not geo-route `/helpcentre/deriv-trader` for EU egress] → the verification gate in tasks runs before implementation is accepted; on failure, switch to the in-app resolver fallback (D1) whose tasks are pre-broken-down.
- [The `trade.deriv.com` hop may have been intentional (funnel users into the trade-hub help experience)] → the issue's _Expected_ explicitly names `https://deriv.com/helpcentre/deriv-trader`; link the spec PR to issue #1252 and surface the removal of the hop for product sign-off in review. Escalate the always-EU redirect to the trade.deriv.com owners regardless, since it affects any other property linking there.
- [Fallback path adds a geolocation dependency the repo has never had] → only taken if the gate fails; resolver is bootstrap-time, cached, timeout-guarded, and defaults non-EU, so Help clicks never wait on the network.
- [VPN/proxy visitors get the market of their egress, not their residence] → accepted; matches how the issue itself defines expected behaviour (egress-based) and how the content site geo-routes everywhere else.
- [EU help-centre path (`/eu/helpcentre/deriv-trader`) is content-site IA this repo does not own and could move] → primary decision avoids hardcoding it entirely; only the fallback pins it in config, where it is a one-line change.

## Migration Plan

- Ship as a normal PR to `upstream/master` (branch from `upstream/master` — the local fork lineage must not be the base; per repo flow, push the branch to `upstream` and open an intra-repo PR).
- No data, API, or dependency migration. Rollback = revert the commit (config + helper + tests are self-contained).
- Production check after deploy mirrors the bug report: Kenya and Spain egress, desktop `dt_sidebar_help` and mobile Menu → Help centre, logged out.

## Open Questions

- None blocking. Two deferrable items recorded in `tasks.md` Open Questions: (a) product confirmation that dropping the `trade.deriv.com` hop is acceptable, and (b) whether logged-in EU accounts should later override geo — both can be answered without changing this spec's requirements.
