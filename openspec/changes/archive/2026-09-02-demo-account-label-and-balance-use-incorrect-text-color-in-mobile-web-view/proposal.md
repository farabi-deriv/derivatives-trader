# Demo account balance uses a non-themed brand colour in the mobile web header

Issue: [#1087](https://github.com/deriv-com/derivatives-trader/issues/1087)

## Why

In the mobile web header, the balance of a **demo** account is painted with the brand success colour
instead of the theme's primary text colour, so it does not adapt when the user switches between Light
and Dark themes.

The cause is a stylesheet override that defeats the colour the component already asks for:

- `packages/core/src/App/Components/Layout/Header/account-info.tsx:101-109` renders the balance as
  `<Text ... className='acc-info__balance' size='s' color='primary' weight='bold'>`, which resolves to
  `--text-color: var(--color-text-primary)` on the element's inline style
  (`packages/components/src/components/text/text.tsx:26-32`).
- `packages/core/src/sass/app/_common/components/account-switcher.scss:126-130` then declares
  `.acc-info--is-demo { .acc-info__balance { color: var(--color-text-success); } }`. That selector has
  specificity `(0,2,0)`; the rule that consumes the component's colour token,
  `.dc-text { color: var(--text-color) }`
  (`packages/components/src/components/text/text.scss:1-3`), has `(0,1,0)`. The override wins, so
  `color='primary'` never reaches the pixel for a demo account.

The override is not theme-aware, which is exactly the reported symptom.
`packages/shared/src/styles/tokens/semantic.scss` defines `--color-text-success: var(--brand-success)`
identically in both themes (line 29 light, line 82 dark), whereas
`--color-text-primary` flips from `var(--brand-black)` (line 21) to `var(--brand-white)` (line 73).

**Why it is mobile-only.** The shell header that renders `AccountInfo` is hidden above the mobile
breakpoint — `packages/core/src/sass/app/_common/layout/header.scss:12-15` sets
`.header { @include tablet-or-desktop-screen { display: none; } }`. Desktop renders the AppV2
`AccountHeader` instead (`packages/trader/src/AppV2/Containers/Trade/trade-desktop.tsx:145`), whose
balance `Text` (`packages/trader/src/AppV2/Components/AccountHeader/account-header.tsx:157`) carries no
such override and therefore already shows the correct themed primary colour. The AppV2 mobile
`CompactHeader` also already sets `color='primary'` explicitly and documents primary as the intended
balance colour (`packages/trader/src/AppV2/Components/CompactHeader/compact-header.tsx:59-71`). So two
of the three account-header surfaces are already correct and serve as the reference.

The override is a leftover: commit `4fc135d045` (2025-09-29, "Farabi/grwt-7094/fix-account-header")
renamed the block's selector from `&--is-virtual` to `&--is-demo` and carried the success colour with
it, after the balance had been given an explicit `color='primary'` prop.

The `Demo account` / `Real account` **label** above the balance is _intentionally_ colour-coded
(`tertiary` for demo, `secondary-alternate` for real) and is identical on all three surfaces
(`account-info.tsx:82-88`, `account-header.tsx:144-146`, `compact-header.tsx:62`). Per the issue's own
correction, it is **not** a bug and must not change.

## What Changes

- Remove the demo-only balance colour override from
  `packages/core/src/sass/app/_common/components/account-switcher.scss` so the balance in the mobile
  shell header renders with the `color='primary'` the component already declares — dark text in Light
  theme, light text in Dark theme, for demo and real accounts alike.
- Keep the `acc-info--is-demo` class on the trigger element. It is a state hook asserted by an existing
  test (`packages/core/src/App/Components/Layout/Header/__tests__/account-info.spec.tsx:99-102`);
  only the colour declaration inside it is wrong. See Open Questions in `tasks.md`.
- Keep the account-type label colour-coding exactly as it is (demo → `tertiary`,
  real → `secondary-alternate`) on all three account-header surfaces, and pin it with a requirement so a
  future "consistency" pass does not flatten it.
- Add a stylesheet-contract Jest test that asserts no rule in `account-switcher.scss` recolours
  `.acc-info__balance`, following the existing precedent in
  `packages/trader/src/AppV2/Components/MarketTabs/__tests__/market-tabs-layout.spec.ts`. jsdom performs
  no cascade, so a rendering test cannot see this bug; reading the stylesheet can.
- Add a render assertion that the balance element carries `--text-color: var(--color-text-primary)` for
  both a demo and a real account, so the prop side of the contract is guarded too.

No layout, structure, markup, or behaviour changes. No breaking changes.

## Capabilities

### New Capabilities

- `account-header-colors`: the text colours of the account header **trigger** — the account-type label
  and the balance — across themes, account types (demo / real), and the mobile shell header vs. the
  desktop AppV2 header vs. the mobile compact header.

### Modified Capabilities

None. `openspec/specs/` currently holds `allow-equals-toggle`, `barrier-input`, `barrier-range-errors`,
`contract-details-chart`, `duration-end-time-fields`, `market-descriptions`, `market-info-sync`,
`positions-drawer`, and `themed-scrollbars`. None of them covers header text colour. The in-flight change
`account-balance-action-sheet-does-not-show-the-latest-balance` introduces an `account-switcher`
capability, but that one scopes the account **list** surface (which balance each row shows, refresh,
loading and error states) — not the trigger's colours — so the two do not overlap.

## Impact

- **Styles**
    - `packages/core/src/sass/app/_common/components/account-switcher.scss` — delete the
      `&--is-demo { .acc-info__balance { color: var(--color-text-success); } }` block (lines 126-130).
      This is the entire production fix.
- **Components**
    - None. `packages/core/src/App/Components/Layout/Header/account-info.tsx` already passes
      `color='primary'` and the correct label colours; it is read for verification, not edited.
- **Tests**
    - `packages/core/src/App/Components/Layout/Header/__tests__/account-info.spec.tsx` — add the
      balance-colour and label-colour render assertions. Existing cases (including the
      `acc-info--is-demo` class assertion at lines 99-102) stay green.
    - New `packages/core/src/App/Components/Layout/Header/__tests__/account-info-colors.spec.ts` —
      stylesheet contract over `account-switcher.scss`.
- **Not affected**
    - The account switcher list rows: `AccountSwitcher` is rendered as a sibling of the `.acc-info`
      element inside `.acc-info__wrapper` (`account-info.tsx:122-133`), so it was never inside the
      `.acc-info--is-demo` subtree and its own row styling
      (`account-switcher.scss:190-193`, `acc-info__wallets-balance`) is untouched.
    - Desktop AppV2 `AccountHeader` and mobile `CompactHeader` — already correct, no edits.
    - Design tokens: no token values change; the fix only stops overriding one of them.
- **Dependencies / APIs / stores**: none.
