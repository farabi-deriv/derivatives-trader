# Coverage Template — Standard Structure for Journey Coverage Tracking

> **Purpose:** Defines the canonical 3-section structure every `coverage.md` must follow.
> Coverage is read by humans tracking what's done and what's next, and by an AI that needs to know the proposed spec file name and gap ID before implementing a gap flow.
>
> **Rule:** The test case detail for each gap lives in `flow.md` (as a Gap Flow section), not here. Coverage tracks status and priority — flow.md specifies what to verify.

---

## Section 1 — Coverage at a Glance _(required)_

One row per flow including gaps. The single fastest way to see what's done.

```markdown
| # | Journey | Desktop | Mobile | Notes |
| --- | --- | --- | --- | --- |
| Flow 1 | Short description | ✅ | ✅ |  |
| Flow 2 | Short description | ✅ | ❌ |  |
| G1 | Gap description | ❌ | ❌ |  |
| G2 | Gap description | ❌ | N/A | Covered by `some-other.spec.ts` |
```

**Status values:**

- `✅` — spec file exists and passes in CI
- `❌` — not covered
- `🟡` — partially covered (e.g. desktop only, or happy path only)
- `N/A` — not applicable (e.g. web terminal redirects are not viewport-specific)

**Rules:**

- Include every gap from `flow.md` so the table is the single source of coverage truth
- Mobile column: default `❌` unless a spec is explicitly tagged `@mobile` and runs under `chromium-mobile`

---

## Section 2 — Gaps _(required)_

One row per gap. Enough for an AI to know what file to create and where to find the test cases.

```markdown
| Gap | Description | Proposed spec file |
| --- | --- | --- |
| G1 | One-sentence description of what's missing | `feature/proposed-name.spec.ts` |
| G2 | One-sentence description | `feature/proposed-name.spec.ts` |
```

**Rules:**

- Description is one sentence — what behaviour is missing, not why it matters
- Proposed spec file is the exact path relative to `playwright/tests/`
- Step-by-step test cases live in `flow.md` under a matching `### G{n}` section — add a pointer:

```markdown
> Step-by-step test cases for each gap: [`flow.md — Gap Flows`](./flow.md#gap-flows)
```

---

## Section 3 — Priority List _(required)_

Ordered by implementation priority. Used by humans to pick the next gap to implement.

```markdown
| Priority | Spec file | Gap | Reason |
| --- | --- | --- | --- |
| P0 | `feature/critical.spec.ts` | G1 | One sentence on why this is highest priority |
| P1 | `feature/next.spec.ts` | G2 | One sentence |
| P2 | `feature/later.spec.ts` | G3 | One sentence |
```

**Priority values:**

- `P0` — blocking; must pass before any release
- `P1` — high; implement next sprint
- `P2` — medium; important but not blocking
- `P3` — low; nice-to-have or edge case

---

## What does NOT belong in coverage.md

| Content | Where it belongs |
| --- | --- |
| Step-by-step test cases for gaps (what to verify at each step) | `flow.md` — as `### G{n}` gap flow sections |
| POM method names, account setup code | `catalog.md` |
| How to add a new variant / maintenance guide | `coverage.md` can have a brief note, but not a multi-step guide |
| Coverage strategy rationale (why one file per pair, why positive-only) | Drop — not actionable |
