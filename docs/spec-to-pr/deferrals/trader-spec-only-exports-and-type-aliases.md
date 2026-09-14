# Trader exports and type aliases whose only reference is a barrel line or a spec

## What was deferred

Task 11.5 asks for "the dead re-exports and type aliases — each after a repository-wide
word-bounded grep returns zero". The subset whose grep genuinely returns zero was removed in this
change. The following did **not** return zero and were kept:

**Barrel re-exports whose only importers are the module's own specs**
`AppV2/Components/Filter/index.ts` `TRADE_MODE`; `AppV2/Components/InputPopover/index.ts`
`VerticalTabSelector`, `usePopoverPosition`; `AppV2/Components/TradeParameters/Barrier/index.ts`
`BarrierContentDesktop`, `BarrierDesktop`, `BarrierTypeSelector`;
`AppV2/Components/TradeParameters/TakeProfit/index.ts` `TakeProfitDesktop`,
`TakeProfitInputDesktop`; `AppV2/Components/TradeTypeList/index.ts` `TradeTypeListItem`;
`AppV2/Components/TradeParameters/Shared/TradeParameterPopover.tsx`
`TradeParameterPopoverContext`; `Modules/SmartChart/index.js` `Views`; `Stores/index.ts`
`TraderStoreProvider`.

**Duplicate default + named exports of the same symbol**
`AppV2/Components/Layout/PositionsDrawer/positions-drawer-content.tsx`,
`AppV2/Hooks/useBlockSheetSwipe.ts`, `AppV2/Hooks/useRiskDisclosure.tsx`,
`AppV2/Components/TradeParameters/Duration/early-close-dot.tsx`,
`Modules/SmartChart/Hooks/useSmartChartsAdapter.ts`, `Stores/Providers/modules-providers.tsx`,
`trader-providers.tsx`, `AppV2/Utils/open-markets-utils.ts`.

**The ~30 type aliases** knip reports for `packages/trader`, most of them a type declared in a
module and re-exported from its barrel (`TProfitAmountProps`, `TSelectionOption`, `TTradeMode`,
`TFavouriteMarket`, …), plus the standalone ones in `AppV2/Utils/market-availability-utils.ts`,
`market-discovery-utils.ts`, `Stores/Modules/Trading/trade-store.ts` and
`Types/common-prop.type.ts`.

## Why

Three separate reasons, none of which the change is allowed to override:

1. A symbol whose only importer is its own spec cannot be de-exported without deleting the spec,
   and deleting a spec for code that still ships is a coverage loss, not a cleanup. Which of these
   components are genuinely unreachable is a per-component reachability question the sweep did not
   measure, and the plan enumerated none of them.
2. `useRiskDisclosure` is on the DCR-049 KEEP list (regulatory gating, Spain) and
   `early-close-dot.tsx` is documented in `CLAUDE.md` as the live market-indicator component. Both
   appear in knip's report only as _duplicate_ default+named exports.
3. A duplicate default+named export is a style choice, not dead code — knip classifies it under
   `duplicates`, not `unused`. Collapsing them changes every import site for no behavioural gain.

Per DCR-044 and task 12.5, anything not positively proven dead is kept and recorded rather than
deleted on the absence of a hit.

## Follow-up required

Take the barrel re-export group first, since it is the only one with a mechanical answer: for each
symbol, establish whether any surviving surface renders it. Where nothing does, delete the
component and its spec together; where something does, keep the barrel line. Then decide, once and
repo-wide, whether the codebase wants default-plus-named exports at all — and if not, do that as a
single mechanical change rather than eight scattered ones. The type aliases are `knip --fix`
territory and should ride along with whichever change adopts that tool as a gate rather than a
baseline.

**Tracked:** https://github.com/deriv-com/derivatives-trader/issues/1392
