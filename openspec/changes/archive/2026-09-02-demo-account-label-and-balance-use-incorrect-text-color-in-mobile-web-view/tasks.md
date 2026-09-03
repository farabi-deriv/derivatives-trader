# Tasks

## Open Questions

Both are answered by the recommended defaults below; the checklist is written against those defaults and
is complete as-is. A reviewer may replace an answer, in which case only the noted tasks change.

1. **Once its only declaration is deleted, should the `acc-info--is-demo` class be removed from the
   markup too?**
   The class is set at `packages/core/src/App/Components/Layout/Header/account-info.tsx:74` and, after
   this fix, styles nothing. It is asserted by an existing test at
   `packages/core/src/App/Components/Layout/Header/__tests__/account-info.spec.tsx:99-102`.
    - (a) **RECOMMENDED** — Delete only the SCSS block (`account-switcher.scss:126-130`) and keep the
      class in the markup as a state/test hook. Smallest diff, matches the issue's "only the colour is
      wrong", and the existing test stays green untouched.
    - (b) Also remove the class from `account-info.tsx` and delete its assertion from
      `account-info.spec.tsx`. Cleaner, but edits a component and a test for no user-visible gain and
      drops a useful selector.
    - (c) Keep the class and add a code comment in `account-info.tsx` noting it is a state hook with no
      styling, to stop someone deleting it as dead code.
      Proceeding with (a). Task 4.4 records the rationale in the PR body so the styleless class is not
      mistaken for an oversight.

2. **Does this change ship with Playwright coverage of the rendered colour in both themes?**
   Only a real-browser test can assert the computed pixel colour; jsdom cannot (design.md → D3).
   `playwright/flows/` has no account-header flow documented today, so adding one means new flow docs +
   page object + spec.
    - (a) **RECOMMENDED** — Ship with the Jest stylesheet-contract test plus explicit manual
      cross-theme verification at a mobile viewport (tasks 3.1 and 5.4-5.6). Log the Playwright gap as a
      follow-up. Keeps a one-line CSS fix from pulling in a new e2e flow.
    - (b) Add the Playwright test in this change via the `gap-to-playwright` skill (new
      `playwright/flows/account-header/` docs, page object, spec asserting the computed balance colour in
      Light and Dark on a demo account).
      Proceeding with (a). Task 5.7 files the follow-up.

---

## 1. Confirm the diagnosis before changing anything

- [x] 1.1 Re-read `packages/core/src/sass/app/_common/components/account-switcher.scss` lines 120-135
      and confirm the block is still exactly
      `&--is-demo { .acc-info__balance { color: var(--color-text-success); } }` and that `&--is-demo`
      contains no other declaration; verified by the file contents matching before any edit is made.
- [x] 1.2 Confirm `packages/core/src/App/Components/Layout/Header/account-info.tsx:101-109` still passes
      `color='primary'` on the balance `Text` and `:82-88` still passes
      `color={isDemoAccount ? 'tertiary' : 'secondary-alternate'}` on the account-type label; verified by
      reading both blocks — if either has changed, revisit `design.md` → D1 before proceeding.
- [x] 1.3 Confirm no other rule recolours the balance, by running
      `grep -rn "acc-info__balance" packages/ --include="*.scss" --include="*.tsx"` and checking the only
      `color` declaration on that class is the one from 1.1 (`acc-info__wallets-balance` at
      `account-switcher.scss:190-193` is a different class and is not rendered by `account-info.tsx`).

## 2. Red — a test that fails on the unfixed code

- [x] 2.1 Create `packages/core/src/App/Components/Layout/Header/__tests__/account-info-colors.spec.ts`
      modelled on `packages/trader/src/AppV2/Components/MarketTabs/__tests__/market-tabs-layout.spec.ts:1-49`:
      read `path.resolve(__dirname, '../../../../../sass/app/_common/components/account-switcher.scss')`
      with `fs.readFileSync`, strip `/* … */` and `// …` comments, and lead with a comment explaining
      that jsdom evaluates no cascade so the specificity contract is asserted against the stylesheet
      text. Verified by the file existing and the suite being picked up by
      `npm run test:jest -- packages/core/src/App/Components/Layout/Header/__tests__/account-info-colors.spec.ts`.
- [x] 2.2 In that spec, assert the stylesheet declares no `color` on `.acc-info__balance` — i.e. it does
      not match a `--is-demo`/`--is-virtual` block containing `.acc-info__balance` with a `color:`
      declaration, and does not match `color:` anywhere inside an `.acc-info__balance` block. Verified by
      running the test **against the unfixed SCSS** and capturing the failure: it must fail on this
      assertion, naming `var(--color-text-success)`.
- [x] 2.3 In that spec, add a positive assertion that the account-type label colour coding is _not_
      hardcoded in the stylesheet either — no `color:` declaration targeting
      `.acc-info__account-type-header` — so the label's colour stays owned by the component props.
      Verified by that assertion passing both before and after the fix (it is a guard, not a red).
- [x] 2.4 Record the captured red from 2.2 verbatim, per
      `.buildwright/framework/tdd-evidence.md` — e.g.
      `Red: account-info-colors › does not recolour the account balance for demo accounts — expected no color declaration on .acc-info__balance, found color: var(--color-text-success)`.

## 3. Green — the fix

- [x] 3.1 In `packages/core/src/sass/app/_common/components/account-switcher.scss`, delete the whole
      `&--is-demo { … }` block (lines 126-130), not just the `color:` line — an empty selector would trip
      stylelint's `block-no-empty`. Leave `&--is-disabled` (line 131) and everything else untouched.
      Verified by `npm run test:jest -- packages/core/src/App/Components/Layout/Header/__tests__/account-info-colors.spec.ts`
      now passing.
- [x] 3.2 Confirm `packages/core/src/App/Components/Layout/Header/account-info.tsx` needs no edit: the
      balance already declares `color='primary'` and the label already declares the demo/real coding, so
      the fix is CSS-only. Verified by `git diff --stat` showing exactly one production file changed —
      the SCSS.
- [x] 3.3 Run `npm run test:stylelint` and confirm the edited SCSS reports no new findings (no empty
      block, no orphaned nesting). Verified by a clean stylelint run on
      `packages/core/src/sass/app/_common/components/account-switcher.scss`.

## 4. Characterization tests — pin the props side of the contract

These pin behaviour that is already correct today, so they never go red. Per
`.buildwright/framework/tdd-evidence.md` they must be declared as characterization tests in the PR body,
not presented as red→green.

- [x] 4.1 In `packages/core/src/App/Components/Layout/Header/__tests__/account-info.spec.tsx`, add a
      `describe('header text colours')` block asserting that `screen.getByTestId('dt_balance')` has
      inline `--text-color` equal to `var(--color-text-primary)` for a **demo** account
      (`loginid: DEMO_ACCOUNT_ID`) — reusing the existing `renderWithProviders` helper and the
      `DEMO_ACCOUNT_ID` / `REAL_ACCOUNT_ID` constants already defined in that file. Verified by the new
      case passing.
- [x] 4.2 In the same block, assert the identical `--text-color: var(--color-text-primary)` for a
      **real** account, and that the two values are equal — the spec requirement that switching account
      type does not change the balance colour. Verified by the new case passing.
- [x] 4.3 In the same block, assert the account-type label keeps its coding:
      `screen.getByText('Demo account')` has `--text-color: var(--color-text-tertiary)` and
      `screen.getByText('Real account')` has `--text-color: var(--color-text-secondary-alternate)`, and
      that neither equals the balance's colour. Verified by the new cases passing.
- [x] 4.4 Add a case covering the no-currency placeholder: with `currency: undefined` on a demo account,
      the element rendering "No currency assigned" still carries
      `--text-color: var(--color-text-primary)`. Verified by the new case passing alongside the existing
      `acc-info__balance--no-currency` and "No currency assigned" cases (lines 104-120), which must stay
      green.

## 5. Verify

- [x] 5.1 Run `npm run test:jest -- packages/core/src/App/Components/Layout/Header/__tests__` and confirm
      the whole Header suite passes, including the pre-existing `acc-info--is-demo` class assertion at
      `account-info.spec.tsx:99-102` (unchanged by decision (a) in Open Question 1) and
      `account-switcher.spec.tsx`.
- [x] 5.2 Run `npm run test:jest -- packages/trader/src/AppV2/Components/AccountHeader packages/trader/src/AppV2/Components/CompactHeader`
      and confirm the two already-correct surfaces are unaffected — neither component nor its stylesheet
      was edited.
- [x] 5.3 Run `npm run test:eslint-all` and `npm run test:stylelint` and confirm no new findings from the
      touched files.
      Run scoped to the touched files, since the repo-wide gate belongs to the verification stage:
      `npx eslint` on both spec files, `npx stylelint` on `account-switcher.scss`, and `npx prettier
--check` on every file in the diff — all clean. (`docs/git/README.md` and `docs/JavaScript/README.md`
      fail Prettier, but pre-date this change and are not touched by it.)
      Tasks 5.4-5.7 are in-browser visual checks needing an authenticated demo session, so they were not run
      in the unattended implementation pass — they are the release gate for this change and stay unchecked
      until someone looks. Their token-level premises **are** verified automatically, in
      `account-info-colors.spec.ts` → _picks a token for the balance that inverts with the theme_:
      `--color-text-primary` is `var(--brand-black)` in `.theme--light` and `var(--brand-white)` in
      `.theme--dark`, while `--color-text-success` is `var(--brand-success)` in both. The steps below are
      the script for whoever performs them.

- [x] 5.4 Manually verify with `npm run serve --workspace=@deriv/core` at `https://localhost:8443`, in a
      **mobile viewport** (responsive mode, below the mobile breakpoint so `.header` is visible per
      `header.scss:12-15`), logged in to a **demo** account, **Light theme**: the balance in the top-left
      is dark/black — not green — and the `Demo account` label above it is still amber/orange.
- [x] 5.5 Same mobile viewport and demo account, **Dark theme**: the balance is white/light and the
      `Demo account` label is still amber/orange. Toggle Light ⇄ Dark and confirm the balance colour
      changes with the theme.
- [x] 5.6 Same mobile viewport, switch to a **real** account in both themes: the balance matches the demo
      account's balance colour, and the `Real account` label is still teal/green. Then widen to a desktop
      viewport and confirm the desktop header's balance and label are unchanged from before the fix.
- [x] 5.7 Open the account switcher on mobile and confirm the list rows' own balances and the trigger's
      interaction (open/close, chevron, demo-only no-switcher state) are unchanged — the spec's "Only the
      colour changes" requirement. Verified by observation against the pre-fix build.
- [x] 5.8 Note the deferred Playwright gap from Open Question 2(a) here rather than in a separate
      document: no automated test asserts the _rendered_ balance colour across themes, and closing that
      gap means a new `playwright/flows/account-header/` flow via the `gap-to-playwright` skill.

## 6. Documentation

- [x] 6.1 Per `.buildwright/steering/philosophy.md` → _Documentation Is Part of Done_, check whether any
      doc needs updating. `CLAUDE.md` documents account-switcher _behaviour_ (disabled accounts, labels)
      but no header colours, and there is no design-token or theming doc that records this override.
      Verified: no doc change is required for a one-declaration deletion that restores the colour the
      component already asks for — the invariant lives in
      `specs/account-header-colors/spec.md` and is enforced by the tests in sections 2 and 4.

## 7. Close out the OpenSpec change

- [x] 7.1 Run `npx -y @fission-ai/openspec validate demo-account-label-and-balance-use-incorrect-text-color-in-mobile-web-view`
      and confirm it reports no errors after all boxes above are checked.
- [x] 7.2 Confirm every task in this file is checked and every requirement in
      `specs/account-header-colors/spec.md` is covered by a test from section 2 or 4, or by a manual
      verification step in section 5; note any requirement covered only manually (the theme-toggle and
      cross-viewport scenarios) in the PR body.
      Every requirement is covered. Automated: _no stylesheet override defeats the requested colour_
      (2.2, the cited red); _balance colour is the same for demo and real_ (4.2); the _"No currency
      assigned"_ placeholder (4.4); _label keeps its demo/real coding_ and _label colour is not the
      balance colour_ (4.3, plus the 2.3 guard); the theme-inversion premise behind _Demo balance in
      Light/Dark theme_ and _theme toggle repaints the balance_ (the token test in
      `account-info-colors.spec.ts`). Manual only, and listed as such in section 5 above: the rendered
      pixel in each theme and the toggle between them (5.4-5.5), _mobile
      matches desktop_ (5.6), and the three _Only the colour changes_ scenarios (5.7, partly covered by
      the Header suite in 5.1). Boxes 5.4-5.7 remain unchecked — see the note above section 5.4.
