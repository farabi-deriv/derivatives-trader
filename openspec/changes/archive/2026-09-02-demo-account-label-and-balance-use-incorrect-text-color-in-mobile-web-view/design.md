# Design

## Context

See `proposal.md` → _Why_ for the root cause and its evidence. The design-relevant facts:

1. The mobile shell header's balance element already **asks** for the right colour.
   `packages/components/src/components/text/text.tsx:26-32` writes the requested colour into an inline
   custom property (`--text-color: var(--color-text-primary)`), and
   `packages/components/src/components/text/text.scss:1-3` consumes it via `.dc-text { color: var(--text-color) }`.
   The `color` prop is therefore a `(0,1,0)` rule, not an inline `color` declaration — it loses to any
   two-class selector.
2. `packages/core/src/sass/app/_common/components/account-switcher.scss:126-130` is such a selector:
   `.acc-info--is-demo .acc-info__balance` at `(0,2,0)`.
3. The three account-header surfaces are separate components. Only the mobile one is affected:

    | Surface                                 | Component                                                                   | Balance colour                        | Correct today |
    | --------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------- | ------------- |
    | Mobile web header                       | `packages/core/src/App/Components/Layout/Header/account-info.tsx:101-109`   | `color='primary'`, overridden by SCSS | ✗             |
    | Desktop header                          | `packages/trader/src/AppV2/Components/AccountHeader/account-header.tsx:157` | `Text` default, which is `primary`    | ✓             |
    | Mobile compact header (chart maximized) | `packages/trader/src/AppV2/Components/CompactHeader/compact-header.tsx:69`  | explicit `color='primary'`            | ✓             |

    `packages/core/src/sass/app/_common/layout/header.scss:12-15` hides the shell header above the mobile
    breakpoint, which is why the bug is mobile-only.

4. Constraint from the issue: **only the colour is wrong.** No layout, markup, structure or behaviour
   change, and the account-type label's demo/real colour coding stays.
5. Constraint from the toolchain: Jest runs in jsdom, which parses no stylesheets and performs no
   cascade. A `render()` test can see the _requested_ colour but is blind to the SCSS override that
   defeats it. This shapes the test strategy below more than anything else.

## Goals / Non-Goals

**Goals:**

- Delete the override so the requested `primary` colour reaches the pixel on mobile.
- Leave the two already-correct surfaces untouched, and pin all three surfaces' expected colours in the
  spec so they cannot silently diverge again.
- Produce a test that can actually fail on this bug, and be honest about which added tests are
  regression guards rather than red→green evidence.

**Non-Goals:**

- Reworking how `Text` applies colour (e.g. switching from a CSS custom property to a direct
  declaration, or raising `.dc-text` specificity). That is a shared-component change affecting every
  `Text` in the app — far beyond this issue, and a much larger regression surface.
- Unifying the three header components into one. Real duplication, but a separate refactor.
- Auditing every other `.dc-text` colour override in the codebase.
- Changing any design token value.

## Decisions

### D1 — Fix in SCSS by deleting the override, not in TSX by escalating specificity

**Chosen:** remove the `&--is-demo { .acc-info__balance { color: … } }` block from
`account-switcher.scss` entirely.

The component's `color='primary'` is already the correct declaration of intent; the stylesheet is the
thing that is wrong. Deleting it makes the component's prop authoritative, which is how every other
`Text` in the header already works — including the two surfaces that are already correct.

_Alternatives considered:_

- **Change the override's value to `var(--color-text-primary)`.** Works, but leaves a rule whose only
  job is to restate what the component already says — and which will silently defeat any future colour
  prop on that element. Rejected as the same trap re-armed.
- **Add `!important` or a higher-specificity rule in TSX / a new class.** Escalating a specificity war
  inside one component. Rejected outright.
- **Set the colour via an inline `style` prop on `Text`.** Inline styles beat the override, so the bug
  would go away, but the dead override would remain and the component would stop using the design-system
  colour API. Rejected.

### D2 — Keep the `acc-info--is-demo` class on the trigger element

The class becomes styleless once its only declaration is deleted. Keep it anyway: it is an existing
state hook asserted by
`packages/core/src/App/Components/Layout/Header/__tests__/account-info.spec.tsx:99-102`, and it is a
useful selector for tests and future demo-specific styling. Removing it would mean editing that test for
no user-visible gain, widening the diff beyond "only the colour".

Empty SCSS blocks are a stylelint concern, so the whole `&--is-demo { … }` selector goes — not just the
`color:` line inside it. Leaving `&--is-demo {}` behind would trip `block-no-empty`.

Recorded as Open Question 1 in `tasks.md` with this as the recommended default.

### D3 — Test at the stylesheet level, because jsdom cannot see the cascade

The bug lives in specificity, which jsdom does not evaluate. So the test that goes **red** on the
unfixed code reads the stylesheet as text and asserts the contract:

> no rule in `account-switcher.scss` sets `color` on `.acc-info__balance`

This is an established pattern in this repo, not a new invention:
`packages/trader/src/AppV2/Components/MarketTabs/__tests__/market-tabs-layout.spec.ts:1-49` reads
`market-tabs.scss` with `fs.readFileSync`, strips comments, and asserts declarations per selector for
exactly this reason ("jsdom does no layout … lives in the stylesheet and is asserted here").
`packages/trader/src/AppV2/Utils/__tests__/guide-animation-assets.spec.ts` uses the same file-reading
approach for asset contracts.

_Alternatives considered:_

- **A `render()` assertion on the computed colour.** jsdom's `getComputedStyle` returns nothing useful
  here — the stylesheet is never loaded, so the assertion passes on broken code. Useless as red
  evidence.
- **A Playwright test asserting the computed colour in both themes.** This is the only test that
  verifies the _rendered_ pixel end to end, and it is the right long-term home. But it needs an
  authenticated demo session and a theme toggle in the mobile header flow; `playwright/flows/` has no
  account-header flow documented today, so adding one is its own piece of work with its own skill
  (`gap-to-playwright`). Deferred — see Open Question 2 in `tasks.md` — with manual cross-theme
  verification as the gate for this change.
- **Stylelint rule banning `color` overrides on `.dc-text` descendants.** Would catch the whole class of
  bug, but a repo-wide rule needs an audit of every existing violation first. Out of scope.

### D4 — Also add render assertions for the prop side of the contract

The stylesheet test guards the CSS. A `render()` test guards the component: assert that
`dt_balance` carries `--text-color: var(--color-text-primary)` for both a demo and a real account, and
that the account-type label carries `--text-color: var(--color-text-tertiary)` (demo) /
`var(--color-text-secondary-alternate)` (real).

These are readable in jsdom because `Text` writes them as inline custom properties
(`text.tsx:26-32`), and `element.style.getPropertyValue('--text-color')` works on inline custom
properties in jsdom.

Per `.buildwright/framework/tdd-evidence.md`, these are **characterization tests**: they pin behaviour
that already works (the props are already correct today) and never go red. They must be declared as such
in the PR body — only the stylesheet test carries the cited red.

### D5 — Pin all three surfaces in the spec, but edit only one

The spec's "All account header surfaces agree on these colours" requirement covers desktop and the
compact header too, even though neither is edited. The two already satisfy it, so the requirement is
documentation of a currently-true invariant — which is precisely what stops the next change from
diverging one surface from the others, the way this bug came about.

## Risks / Trade-offs

- **The override was deliberate and someone wants demo balances green** → The issue is explicit that it
  is not wanted, and the desktop and compact headers — both newer, both showing the same demo balance —
  already render it primary. Deleting the mobile override converges on the majority behaviour rather
  than inventing a new one. If the decision is reversed, the correct fix is a theme-aware token on all
  three surfaces, not a mobile-only brand colour.
- **Demo and real balances become visually indistinguishable** → They were never distinguished by the
  balance alone: the account-type label directly above it stays colour-coded (amber for demo, teal for
  real) and is the intended signal. Requirement "Account-type label keeps its demo/real colour coding"
  locks that in.
- **The stylesheet test is coupled to file text, so a refactor that moves the rules breaks it** →
  Accepted, and consistent with the existing precedent in `market-tabs-layout.spec.ts`. The failure mode
  is a loud, obvious test failure pointing at the file that moved, not a silent pass. Comment the test
  with _why_ it reads the file so the next reader does not delete it as odd.
- **`--color-text-success` is used for the balance elsewhere and this looks inconsistent** → It is not:
  a grep of `--color-text-success` shows profit/loss and status usages (contract cards, reports amounts,
  portfolio) where a success colour is semantically right. The account balance is not a profit figure.
- **No automated coverage of the rendered pixel across themes** → Real gap, stated plainly. Mitigated by
  (a) the stylesheet contract test, (b) explicit manual verification of both themes at a mobile viewport
  in the task list, and (c) a deferred Playwright task.

## Migration Plan

None needed. A CSS-only change with no data, API, storage, or feature-flag dimension; it takes effect on
the next deploy for every user. Rollback is reverting the commit.

## Open Questions

None at the design level. Two implementation-scope questions — whether to also strip the now-styleless
`acc-info--is-demo` class, and whether to add Playwright coverage in this change — are recorded with
recommended defaults in `tasks.md` → _Open Questions_. Both are answered by the defaults there; neither
changes the specs or this approach.
