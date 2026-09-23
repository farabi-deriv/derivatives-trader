# \_orchestrator.md — AI Update Instructions for `_index.md`

> **How to invoke:**
>
> ```
> Follow _orchestrator.md and sync _index.md.
> ```
>
> AI will run targeted bash commands to gather only what it needs, compute the diff, and fix `_index.md`. No description needed.
>
> **Targeted re-scan** (single module):
>
> ```
> Follow _orchestrator.md and sync _index.md for module: <module_name>
> ```
>
> AI will re-scan only the specified module's `coverage.md` and spec files, then update that module's section and the Coverage Summary totals.

---

## When to Run

- **First time**: Run once to populate `_index.md` with all flows from every `coverage.md`.
- **After new flows are added**: Re-run when a new `coverage.md` row is written or a new spec file is created.
- **After structural changes**: Re-run when a module folder is renamed, moved, or deleted.
- **Targeted re-scan**: Run with a specific module focus when only one module has changed.

---

## What You Produce

1. **Updated `_index.md`** — Coverage Summary counts recalculated, per-module flow tables corrected.
2. **Module run list** — A prioritised summary of which modules have the most untested flows and should be implemented next.

You do **not** create `coverage.md` files, spec files, or flow docs. Your only output file is `_index.md`.

---

## Step 1 — Fast data collection (use Bash, not Read)

Run these commands in **parallel** — do not read coverage.md files in full.

### 1a. Read `_index.md`

```
playwright/flows/_index.md
```

Use the Read tool once. Note the current `Status` for every flow row and the counts in the Coverage Summary table.

### 1b. Count rows per module (Coverage At a Glance table)

For each module, run:

```bash
# Count data rows in Section 1 only (excludes Sections 2 and 3 which repeat gap IDs)
awk '/^## Section 1/,/^## Section 2/' playwright/flows/<module>/coverage.md | grep -c "^| [0-9G]"
```

This gives **Total Flows** for the Coverage Summary. Do **not** use `grep -c "^| "` on the whole file — Sections 2 and 3 contain duplicate rows that inflate the count.

### 1c. Find which flows are marked covered

```bash
# List flows marked ✅ Covered — these should be `automated` in _index.md
grep "✅ Covered" playwright/flows/<module>/coverage.md
```

Only do a full `Read` of `coverage.md` if:

- A new flow row needs to be added to `_index.md` (need the description and priority), or
- The grep output is ambiguous about which flow number a covered entry maps to.

### 1d. Count ✅ covered rows per module (Section 1 only)

```bash
# Count rows marked ✅ in Section 1 (Coverage At a Glance) only — excludes Sections 2 and 3
awk '/^## Section 1/,/^## Section 2/' playwright/flows/<module>/coverage.md | grep "^| [0-9G]" | grep -c "✅"
```

This gives **Automated** for the Coverage Summary. Do **not** use spec file count, and do **not** grep the whole file — Sections 2 and 3 repeat gap IDs and would inflate the count.

> Run all bash commands in parallel across all modules for maximum speed.

---

## Modules

```
trade · positions · reports · notifications · auth
```

Test folders mirror module names:

```
playwright/tests/trade/
playwright/tests/positions/
playwright/tests/reports/
playwright/tests/notifications/
playwright/tests/auth/
```

---

## Step 2 — Compute the diff

Compare what you found against what `_index.md` currently shows.

### Check A — Missing flow rows

For every flow and gap in `coverage.md`, does `_index.md` have a matching row in that module's table?

- If a row is **missing** → needs to be added with `Status = documented`
- Only read `coverage.md` in full for modules where rows are missing

### Check B — Status upgrades

For every row currently marked `documented`:

- If `grep "✅ Covered"` matched this flow → upgrade to `automated`

For every row currently marked `automated`:

- Status stays `automated` unless user explicitly confirms CI is green → then upgrade to `verified`
- **Never downgrade** a status

### Check C — New modules

If `playwright/flows/<module>/coverage.md` exists for a module that has **no section** in `_index.md` → a new module section needs to be created (see New Module template below)

### Check D — Coverage Summary table counts

After all row changes are determined, recount:

- **Total Flows** = row count from Step 1b
- **Documented** = same as Total Flows (every row is at minimum documented)
- **Automated** = ✅ covered row count from Step 1d — **never spec file count**; one spec file can cover multiple flows so spec count will not tally with `coverage.md`

---

## Step 3 — Apply edits to `_index.md`

Make all changes discovered in Step 2. Rules:

1. **Surgical edits only** — never rewrite the whole file; change only affected rows/lines
2. **Status only moves forward**: `documented` → `automated` → `verified` — never skip, never reverse
3. **Named flows come before gap rows** within each module table (Flow 1, Flow 2 … then `—` rows)
4. **Gap rows use `—`** in the Flow column — never a flow number
5. **Update the Coverage Summary table** after all per-module edits are done (see Check D counts)
6. **Update `Last updated`** date at the top of `_index.md` to today's date

### Adding a missing named flow row

```
| Flow N | P? | <description from coverage.md> | <user state> | `documented` |
```

Insert in flow-number order, before any `—` gap rows.

### Adding a missing gap row

```
| — | P? | <description from coverage.md> (GN) | <user state> | `documented` |
```

Append after existing gap rows in that module section.

### Updating the Coverage Summary table

Edit the row for the affected module in-place:

```
| `<module>` | <total> | <documented> | <automated> |
```

Where `<automated>` = ✅ covered row count from `coverage.md` (Step 1d). Then recalculate and update the `**Total**` row.

### New Module template

Add after the last `## Module:` section, before `## Implementation Priority Order`:

```markdown
## Module: `<module>` — <Short Title>

**Flow docs:** `playwright/flows/<module>/` · **Test folder:** `playwright/tests/<module>/`

| Flow | Priority | Description | User State | Status |
| --- | --- | --- | --- | --- |
| Flow 1 | P? | ... | ... | `documented` |

---
```

Also add the module to:

- **Coverage Summary table** (new row above `**Total**`)
- **File Reference table** at the bottom of `_index.md`

---

## Step 4 — Output a Module Run List

After all edits are applied, output a summary of which modules have the most untested flows and should be prioritised for implementation next.

Output format:

```markdown
## Module Run List

| Module | Automated | Total | Gap | Suggested Priority |
| --- | --- | --- | --- | --- |
| `trade` | 0 | 8 | 8 | High — P0 trade form untested |
| `contract` | 0 | 5 | 5 | High — P0 contract details untested |
| `reports` | 0 | 4 | 4 | Medium — P1 positions/statements untested |
| ... |  |  |  |  |

To implement flows for a module, say:
"Follow flow-to-playwright skill and implement flows for module: <module_name>"
```

---

## Output Format

When you finish a sync, provide:

1. **Changes made** — list every row added, status upgraded, or count corrected
2. **No-change confirmation** — list any modules that were already in sync (no edit needed)
3. **Coverage Summary delta** — show old vs new totals for Automated/Verified if they changed
4. **Module Run List** — as per Step 4 above

If no changes were needed, say: "✅ `_index.md` is already in sync. No edits made."

---

## File Map

| File | Purpose |
| --- | --- |
| `playwright/flows/_index.md` | Master tracking file — AI edits everything here |
| `playwright/flows/<module>/coverage.md` | Source of truth for flows, gaps, priorities, coverage status |
| `playwright/tests/<module>/` | Spec files — existence of a real `.spec.ts` means `automated` |

---

## Status Reference

| Status | Meaning |
| --- | --- |
| `documented` | Flow/gap exists in `coverage.md`; no spec written yet |
| `automated` | Real `.spec.ts` exists in `playwright/tests/<module>/` and runs in CI |
| `verified` | Spec passes on staging in CI (only set when explicitly confirmed) |
