# Catalog Template — Standard Structure for AI-Driven Test Writing

> **Purpose:** Defines the canonical 4-section structure every `catalog.md` must follow.
> The AI loads `catalog.md` when converting `flow.md` steps into a Playwright spec. It must answer three questions: which method to call and what to pass it, which tags and file name to use, and what non-obvious rules apply.
>
> **Rule:** Every section that IS present must have real content. If a section is not applicable for a simple feature, omit it entirely.

---

## Mandatory Header

```markdown
# 🗺️ {Feature} Journey Catalog — Technical Reference

> Source of truth: `playwright/pages/{Name}Page.ts`
> Created: YYYY-MM-DD | Last updated: YYYY-MM-DD
```

---

## Section 1 — Journey Index _(required)_

One row per flow. Gives the AI the spec file path and tags without it having to guess either.

```markdown
| Journey ID | Spec File | Tags |
| --- | --- | --- |
| Flow 1 | `feature/create-account.spec.ts` | `@desktop @mobile @feature` |
| G1 | `feature/validation.spec.ts` | `@desktop @feature` |
```

**Rules:**

- Include gap flows (G1, G2…) so the AI knows what files already exist before creating new ones
- Tags must be the exact strings used in `test.describe({ tag: [...] })` — no invented tags

---

## Section 2 — Flow Details _(required)_

The `beforeAll` setup and method chain for each flow. Specific enough that the AI produces working code on the first attempt.

````markdown
### Flow 1 — {Description}

**Account setup:**

```typescript
account = await createAccountV2('real', 'al', { currency: 'USD' });
```
````

**Test pattern:**

```typescript
await loginPage.login(account.email, account.password);
await NavigationUtils.waitForDerivApiSettled(page);
await featurePage.gotoFeaturePage();
await featurePage.doSomething('param');
await expect(featurePage.successHeading, 'Success heading should be visible').toBeVisible();
```

````

**Rules:**
- Always show the `beforeAll` account creation or env var reference — this is the most common source of AI errors
- Show the method chain, not pseudocode
- If a flow shares a pattern with other flows, show the pattern once and list the per-flow parameters in a table (e.g. display names, amounts, env vars)
- Cross-reference `flow.md` for step-by-step verification tables — don't duplicate them here

---

## Section 3 — Tags Reference *(required)*

```markdown
| Tag | When to apply |
| --- | --- |
| `@feature` | All tests in this feature area |
| `@smoke` | Critical path only |
| `@production` | Tests safe to run on production (no account creation, no mutations) |
````

---

## Section 4 — Feature-Specific Decisions _(required when non-obvious logic affects generated code)_

Records decisions that would cause naive AI-generated code to be wrong. Not boilerplate — only add entries where the rule is surprising or not derivable from the code.

```markdown
### {Decision name}

One or two sentences: what the rule is and why it exists.

**Impact on generated code:** what the AI must do differently because of this rule.
```

**Examples of what belongs here:**

- A UI label that differs from the internal type key (e.g. `standard` → "CFDs")
- Balance assertion strategy (exact vs direction-only for cross-currency)
- When shared browser context is required instead of fixtures
- A method that cannot be a fixture (must be instantiated manually)
- A flow where a particular step is intentionally skipped
- A precision or format rule that affects input values (e.g. stablecoins use 2dp not 8dp)

---

## What does NOT belong in catalog.md

| Content | Where it belongs |
| --- | --- |
| Step-by-step verification tables | `flow.md` |
| Coverage gaps and gap descriptions | `coverage.md` |
| Route/URL tree and data-testid map | `flow.md` (orientation for humans) |
| How to add a new variant / maintenance guide | `coverage.md` or a contributing doc |
| How to debug / triage map | Not needed — the POM reference and decisions sections already point the AI to the right place |
| Project-wide Playwright rules | `playwright/AGENTS.md` |
| Shared utility docs | `playwright/flows/_conventions/utils-reference.md` |
