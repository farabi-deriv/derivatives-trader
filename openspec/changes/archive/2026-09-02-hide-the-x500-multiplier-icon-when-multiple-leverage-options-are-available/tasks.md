## 1. Hide the badge

- [x] 1.1 In `packages/trader/src/AppV2/Utils/trade-types-utils.tsx`, remove the `badge: 'x500',` line from the Multipliers entry in `AVAILABLE_CONTRACTS` (leave `is_popular`, `category`, `tooltip`, and all other fields unchanged).
- [x] 1.2 Leave the `badge?: string` field on `TAvailableContract` and its doc comment intact so the mechanism can be re-enabled later; do not touch the render guards in `market-selection-sidebar.tsx` / `trade-type-tabs.tsx` or the badge SCSS.

## 2. Verify

- [x] 2.1 Confirm no source references to the removed value remain: `grep -rn "x500" packages/*/src` should return only comment lines (or none), not a `badge:` value.
- [x] 2.2 Run the affected trader unit tests to confirm nothing asserts the badge: `npm run test:jest -- packages/trader/src/AppV2/Components/MarketSelection`.
- [x] 2.3 Manually verify in the app that the Multipliers trade type shows no `x500` badge in the desktop market-selection sidebar and the mobile market-selection tabs, and that other trade types (fire icon, labels, ordering) are unchanged.
- [x] 2.4 Run `openspec validate hide-the-x500-multiplier-icon-when-multiple-leverage-options-are-available --strict` and fix any structural errors.
