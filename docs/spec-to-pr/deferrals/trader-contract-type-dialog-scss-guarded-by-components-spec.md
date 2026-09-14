# `contract-type-dialog.scss` is kept because a `packages/components` spec reads it by path

## What was deferred

`packages/trader/src/sass/app/_common/components/contract-type-dialog.scss` (147 LOC) and its
`@import` line in `packages/trader/src/sass/app.scss`. Every base class in it is dead:
`.contract-type-dialog` has zero references in any `.tsx`/`.jsx`/`.ts`/`.js` file across
`packages/*/src` and `playwright/`, and its two `dc-*` overrides
(`.contract-type-widget__header ~ .dc-mobile-dialog__content`,
`.dc-mobile-dialog__contracts-modal-info`) hang off `contract-type-widget`, which was deleted in
this change. It was the sixth member of DCR-048's fully-dead partial list and the only one not
removed.

## Why

`packages/components/src/__tests__/dead-code-sweep.spec.ts:91` reads the file with
`fs.readFileSync`:

```ts
expect(readRepoFile('packages/trader/src/sass/app/_common/components/contract-type-dialog.scss')).not.toContain(
    '.inline-message__information'
);
```

Deleting the file makes that call throw `ENOENT`, turning a `packages/components` spec red.
`packages/components` is off-limits to this change (design Non-Goals; it has an in-flight PR of its
own), so the assertion cannot be adjusted here. This is the same cross-package coupling that design
D5 resolved for `packages/core/src/App/Components/Routes/language-link.tsx`, and it gets the same
answer: keep the file, defer the deletion, record the reason.

## Follow-up required

In a change that is allowed to edit `packages/components`, drop the second assertion from that
`[DCR-020]` test (the `mobile-dialog.scss` half stands on its own), then delete
`packages/trader/src/sass/app/_common/components/contract-type-dialog.scss` and its `@import` line
in `packages/trader/src/sass/app.scss` in the same commit. Prefer replacing the path-read guard
with one that tolerates a missing file, so the next sweep does not hit the same wall.

**Tracked:** https://github.com/deriv-com/derivatives-trader/issues/1391
