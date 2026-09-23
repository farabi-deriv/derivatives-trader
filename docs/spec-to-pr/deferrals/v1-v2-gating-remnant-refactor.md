# Deferral: V1/V2 gating remnant refactor (bug 6 refactor · ABF-007 · CUTTABLE)

**What was deferred:** The dead-code cleanup half of bug 6 (c6 tasks §12) — removing the always-`true`
`is_dtrader_v2` getter (`packages/trader/src/Stores/Modules/Trading/trade-store.ts` ~L2750–2754,
literally `return true`) and collapsing its unconditional branches to the taken path, plus the
associated V1-fork removals:

- ~11 `this.is_dtrader_v2` read sites in `trade-store.ts` (L856, L870, L2281, L2343, L2360, L2563,
  L2648, L2675, L2738, L2842, L4165) collapsed to the V2 path, the `is_dtrader_v2: computed`
  registration (L695) and the getter itself dropped. (The function-local `is_dtrader_v2` parameter of
  `processContractsForV2`/`processNewValuesAsync` at L2302/L2422 is a distinct local, not the getter.)
- `packages/trader/src/AppV2/Hooks/useGuideContractTypes.ts` (L14/L19/L28) collapsed to
  `contract_types_list_v2` unconditionally.
- `packages/core/src/App/Components/Layout/Header/account-info-wrapper.tsx` (L7/L14/L19) `is_dtrader_v2`
  prop removal and its caller updates.
- `packages/trader/src/Modules/Contract/Containers/replay-chart.tsx` (L104/L164) — remove the
  `is_dtrader_v2_enabled = isMobile` V1 fork; standardise the remaining device predicate on
  `useDevice().isMobile` rather than the deprecated `isMobile()` (also `strike.tsx` ~L139).
- `packages/stores/src/mockStore.ts` (L341) `is_dtrader_v2: false` mirror removal.
- Test rewrites: dropping the `describe('is_dtrader_v2')` always-true asserts in `trade-store.spec.ts`
  (L1036–1041) and the `barrier-reset.spec.ts` getter mock (L414), and — the largest piece —
  rewriting ~30 `is_dtrader_v2`-keyed mock blocks and the V1-branch assertions in the 500-line
  `useGuideContractTypes.spec.tsx`.

**Why:** This is a **pure refactor with no behaviour change** — the getter already returns `true`
everywhere, so the app already runs exclusively on the V2 paths. The behavioural half of bug 6 (the
desktop persisted-strike restore, ABF-007) shipped in c6 §11 and is unaffected by this deferral. c6
task §12 is explicitly marked **CUTTABLE** with the instruction: "If this phase's diff exceeds a
reviewable size, STOP at this phase boundary, file this deferral, and ship phases 1–11." Layering an
~11-branch collapse across the 103 KB critical trade store, a core Header prop removal with caller
tracing, a V1-fork removal, and a ~30-mock-block spec rewrite on top of the already-substantial
phases 1–11 diff exceeds a reviewable single-PR size and dilutes the revert unit for the 15
behavioural fixes that are the point of c6.

**Follow-up required:** A dedicated follow-up change should perform the cleanup above as its own
revert unit:

1. Delete `get is_dtrader_v2()` and its `computed` registration; collapse every `this.is_dtrader_v2`
   read to the taken (V2) branch, deleting the now-unreachable V1 arms.
2. Collapse `useGuideContractTypes` to `contract_types_list_v2`; rewrite its spec to drop the flag and
   the V1-branch cases (keep the native-app-allowed-trade-types coverage).
3. Remove the `is_dtrader_v2` prop from `account-info-wrapper.tsx`, updating callers so the Popover
   alignment reads `is_mobile ? 'bottom' : 'left'`.
4. Remove the `is_dtrader_v2_enabled = isMobile` fork in `replay-chart.tsx`; standardise device checks
   on `useDevice().isMobile` (retire `isMobile()` in `strike.tsx` ~L139 too).
5. Remove the `is_dtrader_v2: false` mirror from `mockStore.ts`; drop the `trade-store.spec.ts`
   always-true asserts and the `barrier-reset.spec.ts` getter mock.
6. Run `build:all && test:jest && check-imports && knip:check`; if any route/alias/chunk SET changed,
   run `npm run baseline:update` and commit the regenerated `docs/baselines/*.json` in the same PR.

Reference: derivatives-trader issue #1271 (C6), bug 6 / ABF-007, tasks §12.

**Tracked:** https://github.com/deriv-com/derivatives-trader/issues/1479
