# mockContractInfo fixture relocation

**What was deferred:** Moving the `mockContractInfo` test fixture out of production source. It is defined at `packages/shared/src/utils/contract/contract-info.ts:3`, re-exported through the `@deriv/shared` wildcard barrel, and imported from `@deriv/shared` by 27 spec files across `@deriv/trader`, `@deriv/components`, `@deriv/reports` and `@deriv/shared` itself (34 files mention the name; `deal-cancellation.spec.tsx` and `deal-cancellation-remaining-time.spec.tsx` define their own unrelated local `mockContractInfo` object and must not be repointed). This was item C7f of GitHub issue #1272; the rest of C7f — the `market-icons.ts` dedupe and the intra-shared de-exports — landed in change `issue-1272-shared-sweep`.

**Why:** The relocation has zero dead-code value — the fixture is live, only misplaced — and it is a merge-conflict magnet across three packages. It also needs a design decision this change did not have to make (a `packages/shared/src/test-utils/` entry point? a `@deriv/shared/test-utils` subpath export? a per-package fixture?), plus matching `jest.moduleNameMapper` and tsconfig `paths` updates in every consuming package. Bundling it with a 1,700-line deletion sweep would have made that sweep unreviewable and put the deletion work at risk of a rebase. The issue body explicitly pre-authorised deferring it.

**Follow-up required:**

1. Choose the destination and the resolution mechanism. The recommended shape is a `packages/shared/src/test-utils/` directory that is **not** re-exported from `packages/shared/src/index.ts`, imported as `@deriv/shared/test-utils`, with a `moduleNameMapper` entry added to each consuming package's `jest.config.js` and a `paths` entry in each `tsconfig.json`.
2. Move `packages/shared/src/utils/contract/contract-info.ts` (or just its `mockContractInfo` export) to that destination and drop it from the production barrel chain.
3. Rewrite the 27 `import { ... mockContractInfo ... } from '@deriv/shared'` statements to the new specifier. Leave the two files that define their own local `mockContractInfo` object alone.
4. Verify with `npm run test:jest` and `npx tsc -p packages/shared/tsconfig.json --noEmit` (expected non-test `packages/shared/src/` baseline after `issue-1272-shared-sweep`: **2** errors — `utils/analytics/analytics-utils.ts` `process`, `utils/object/object.ts` `require`).
5. Regenerate and commit `docs/baselines/knip-baseline.json`; a new non-entry file plus 27 rewritten imports will move knip's findings.

**Tracked:** https://github.com/deriv-com/derivatives-trader/issues/1365
