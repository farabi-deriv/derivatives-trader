# Flow Template — Standard Structure for Journey Spec Files

> **Purpose:** Defines the canonical structure every `flow.md` must follow.
> Flow files tell an AI _what_ to verify at every step. They are the source of truth for step tables and gap test cases.
>
> **Rule:** Implementation details (method names, account setup code, tags, file paths) belong in `catalog.md`. Coverage status and priorities belong in `coverage.md`. Only step-level verification lives here.

---

## Mandatory Header

```markdown
# 📋 {Feature} Journey Spec — What to Test

> **Purpose:** Describes the {Feature} on `staging-dtrader.deriv.com`. Defines _what_ to verify at each step.
>
> **Feature location:** {Location in the trading terminal}
> **URL:** `https://staging-dtrader.deriv.com/{path}`
> **Authentication:** Required — all tests start from a logged-in state
> **Staging only:** {include if tests use createAccountV2 / QA Script Runner}
```

---

## Section 1 — Shared Step Pattern _(optional — include only when 2+ flows share a common sequence)_

When multiple flows share the same step sequence (e.g. all MT5 transfers, all crypto wallet transfers), define the pattern once and reference it from each flow section.

```markdown
### {Pattern Name} Steps

> Referenced by Flows N–M. Substitute `[Placeholder]` with the value listed in each flow section.

**Prerequisites:** {Account setup, env vars, or shared state required}

| # | Step | Action | Expected Result | Test Data |
| --- | --- | --- | --- | --- |
| 1 | ... | ... | ... | ... |
```

**Rules:**

- Keep placeholder names consistent (`[MT5DisplayName]`, `[Currency]`, etc.)
- If a flow deviates from the pattern at one step, note it in that flow section — do not fork the pattern table

---

## Section 2 — Per-Flow Sections _(required)_

One section per flow. Use a compact header that identifies the spec file, env vars, and test data at a glance.

```markdown
### Flow N — {spec-file-name}.spec.ts

**Display name:** `{UI label}` _(for flows that substitute a placeholder)_

| Direction | From | To | Amount | Env var |
| --- | --- | --- | --- | --- |
| N.1 | Account A | Account B | `1.00` | `ENV_VAR_NAME` |
| N.2 | Account B | Account A | `1.00` | `ENV_VAR_NAME` |

> Follows [{Pattern Name} Steps](#{anchor}) — substitute `{UI label}` for `[Placeholder]`.
```

For flows that do NOT share a pattern, include the full step table directly:

```markdown
### Flow N — {spec-file-name}.spec.ts

**Prerequisites:** {Account setup}

| # | Step | Action | Expected Result | Test Data |
| --- | --- | --- | --- | --- |
| 1 | ... | ... | ... | ... |
```

**Rules:**

- Step table columns: `#`, `Step` (short label), `Action` (what the user does), `Expected Result` (what to assert), `Test Data` (values or env vars)
- Keep `Expected Result` cells assertable — list the exact text, URL, or state to verify
- For flows with Real + Demo variants, use two sub-tables under `#### Real Account` / `#### Demo Account`
- For flows with Desktop/Mobile differences, add a `Platform` column with values `Desktop`, `Mobile`, or `Both`. Omit the column entirely when all steps are identical across platforms — locator differences alone do not require a `Platform` column.

```markdown
| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Open input | Click Stake field | Stake input activates inline | Desktop |
| 1 | Open input | Tap Stake chip | Action sheet opens | Mobile |
| 2 | Enter value | Type "10" | Input shows "10.00" | Both |
```

---

## Section 3 — Gap Flows _(required when gaps exist)_

One subsection per gap from `coverage.md`. Each gap gets the same step table format as regular flows.

```markdown
## Gap Flows

> These are test cases for coverage gaps. The proposed spec file for each gap is in [`coverage.md`](./coverage.md).

### G{n} — {Gap description}

| # | Test case | Steps | Expected Result |
| --- | --- | --- | --- |
| 1 | {Short label} | {What to do} | {What to assert} |
```

**Rules:**

- Gap IDs here must match the gap IDs in `coverage.md`
- Each row is one test case (one `test()` block in the eventual spec)
- Keep step descriptions terse — the AI will expand them into code using `catalog.md`

---

## What does NOT belong in flow.md

| Content | Where it belongs |
| --- | --- |
| POM method names, fixture names, import paths | `playwright/pages/` — read the POM directly |
| `beforeAll` account setup code snippets | `catalog.md` — Section 2 (Flow Details) |
| Test tags, spec file paths | `catalog.md` — Sections 1 and 3 |
| Feature description / "What is X?" prose | Drop — not actionable |
| Known quirks / edge cases about implementation | `catalog.md` — Section 4 (Feature-Specific Decisions) |
| Coverage status and priority list | `coverage.md` |
| Gap descriptions (one-sentence) | `coverage.md` — Section 2 (Gaps) |
