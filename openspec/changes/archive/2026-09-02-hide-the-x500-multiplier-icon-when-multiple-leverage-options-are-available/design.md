## Context

The trade-type selector renders its list from a single source of truth: the `AVAILABLE_CONTRACTS` array in `packages/trader/src/AppV2/Utils/trade-types-utils.tsx`. Each entry is a `TAvailableContract`, which includes an optional `badge?: string` field. Two components render the list and both guard the badge on `contract.badge`:

- `packages/trader/src/AppV2/Components/MarketSelection/market-selection-sidebar.tsx` (desktop) — `{contract.badge && <span className='market-selection-sidebar__badge'>{contract.badge}</span>}`
- `packages/trader/src/AppV2/Components/MarketSelection/trade-type-tabs.tsx` (mobile) — `{contract.badge && <span className='market-selection__trade-type-tab-badge'>{contract.badge}</span>}`

Today only the Multipliers entry sets `badge: 'x500'`. No test asserts on the `x500` string (the only `packages/*/src` matches are the badge value and two explanatory comments), and no other consumer reads `.badge`.

The issue explicitly frames this as a **temporary** hide, so the fix should be trivially reversible.

## Goals / Non-Goals

**Goals:**

- Stop rendering the fixed `x500` badge for Multipliers on every selector surface.
- Keep the change reversible in one line and leave the generic badge mechanism ready for a future dynamic value.

**Non-Goals:**

- Introducing a dynamic/real leverage value for Multipliers (out of scope; the issue asks to hide, not to compute).
- Removing the `badge` field, the render guards, or the badge SCSS.
- Changing any other trade type, ordering, tooltips, or the `is_popular`/`show_fire_icon` indicators.

## Decisions

- **Remove `badge: 'x500'` from the Multipliers entry, rather than editing the render sites.**
  The badge is data-driven from `AVAILABLE_CONTRACTS`, and both render sites already guard on `contract.badge`. Deleting the single data line hides the badge everywhere with zero component changes. Alternatives considered:
    - _Conditionally hide in each component_ — rejected: duplicates logic across two files and leaves stale data in the source array.
    - _Feature-flag the badge_ — rejected as YAGNI: the issue asks for a simple temporary hide; a flag adds config surface for a one-line data removal. Re-adding the line later is just as easy.

- **Keep the `badge?` field, guarded renders, and SCSS.**
  They are generic and already correct for an absent badge. Retaining them makes restoring a (correct, dynamic) badge a one-line change and avoids churn in the components and stylesheet.

## Risks / Trade-offs

- [A snapshot/E2E test hard-codes the visible `x500` text] → Mitigation: `grep` confirms no `packages/*/src` test references `x500`; run the trader Jest suite for the affected components and the Playwright trade flow to confirm nothing asserts the badge's presence.
- [Leaving an unused-looking `badge` field reads as dead code] → Mitigation: the field stays exercised by the render guards and is documented in code; the proposal/design record why it is retained (temporary hide).

## Migration Plan

- Single data-only edit; no migration, no data backfill, no rollback tooling needed.
- Rollback: re-add `badge: 'x500'` (or a corrected value) to the Multipliers entry.

## Open Questions

- None blocking. Whether to eventually show a _dynamic_ max-leverage badge is a separate follow-up, deliberately out of scope here.
