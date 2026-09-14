# `recent-trade-info` is kept — the branch the issue calls dead is the one that always runs

## What was deferred

Issue #1274 (C8c) lists `packages/trader/src/Modules/SmartChart/Components/recent-trade-info.tsx`
as runtime-dead, to be removed together with the `!is_digits_widget_active` branch that renders it
at `packages/trader/src/Modules/SmartChart/Components/top-widgets.tsx:50`. Neither was removed, and
the now-unused `is_digits_widget_active` prop on `TTopWidgets` was left in place.

(The `InfoBox` half of this deferral is **resolved**: the tree, `InfoBoxWidget`, the `InfoBox?`
prop, the commented-out slot, the two spec blocks, `sass/app/modules/contract.scss` and the
`.info-box*` selectors in `trader-layouts.scss` were all deleted in this change.)

## Why

Task 11.6 admits the deletion only on a proof that the guard is always false at HEAD. The proof
runs the other way:

`is_digits_widget_active` is a **prop** of `TopWidgets`, and the only production call site —
`ChartTopWidgets` in `Modules/Contract/Containers/contract-replay-widget.tsx` — never passes it.
The prop is therefore `undefined`, `!undefined` is `true`, and `<RecentTradeInfo />` **renders**
inside the mobile portal. The component is live and the issue's "runtime-dead" claim is wrong.

Deleting it would remove a rendered surface; leaving the prop is the smaller wrong, and which of
the two the product wants is not a question this sweep can answer.

## Follow-up required

Decide whether the mobile chart should keep showing `RecentTradeInfo`.

- If it should **not**: delete `recent-trade-info.tsx` and its spec, the `!is_digits_widget_active`
  branch, the `is_digits_widget_active` entry in `TTopWidgets` and its destructure, the
  `jest.mock('../recent-trade-info.tsx', …)` and the two `is_digits_widget_active` cases in
  `Modules/SmartChart/Components/__tests__/top-widgets.spec.tsx`, and the `.recent-trade-info` rule
  in `sass/app/modules/smart-chart.scss`.
- If it **should**: drop the `is_digits_widget_active` prop and render the component
  unconditionally, so the guard stops reading as dead code. `TradeStore.is_digits_widget_active`
  (`trade-store.ts:588`) is a separate observable with its own setter and is not affected either
  way.

**Tracked:** https://github.com/deriv-com/derivatives-trader/issues/1393
