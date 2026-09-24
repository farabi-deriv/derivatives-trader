# Finding — bug 3 (ABF-004): the no-filter empty-state branch is LIVE via archived-statement

## Source

- `packages/reports/src/Components/empty-trade-history-message.tsx` — the `!has_selected_date ? localized_message : localized_period_message` ternary.
- `packages/reports/src/Components/placeholder-component.tsx` — the `has_selected_date` pass-through prop.
- Live consumer: `packages/reports/src/Containers/archived-statement.tsx` (L51 `useState(false)`, L200 `setHasSelectedDate(!!(from || to))`, L255/L266 passing it into `PlaceholderComponent` → `EmptyTradeHistoryMessage`).

## Re-verification result (differs from plan)

Task 1.3 of `openspec/changes/c6/tasks.md` asks to remove the ternary in `empty-trade-history-message.tsx` and the `has_selected_date` plumbing in `placeholder-component.tsx` outright, on the premise that the no-filter branch is dead because the reports stores always seed a non-null `date_to`.

That premise holds **only for the store-driven flow** (Statement / Profit-table), whose `has_selected_date` getters are always `true`. It does **not** hold for `archived-statement.tsx`, which owns a genuinely reachable local `has_selected_date` React state: `false` on mount (shows the no-filter message / error), flipped to `true` when the user applies a date range. It also uses the `localized_message` arm to surface fetch errors (L255/L258). Removing the branch and the pass-through prop outright would:

- break the archived-statement empty/error copy (a user-visible behaviour change), and
- fail `build:all` (TypeScript: passing `has_selected_date` to a component that no longer accepts it).

## What was implemented instead (safe subset, behaviour-preserving)

- Removed the genuinely-dead always-`true` `has_selected_date` getters from `statement-store.js` and `profit-store.js` (and their `computed` registrations).
- Dropped the dead `has_selected_date` and no-filter `localized_message` props from the Statement and Profit-table containers (they only ever render the period message).
- Guarded the shared ternary to `!has_selected_date && localized_message ? localized_message : localized_period_message` so the two containers can omit both props while every archived-statement call site keeps byte-identical output (verified against all five live call sites).
- Left `placeholder-component.tsx`'s `has_selected_date` prop in place — archived-statement still passes it.

Net effect matches ABF-004 ("no change to what users see") for every consumer; the shared component is simplified as far as its live archived-statement consumer allows, rather than deleted.

## Follow-up

The archived-statement rewrite is already tracked in #1477; once that container migrates onto the store, the guarded arm and the `has_selected_date` pass-through can be revisited for full removal.
