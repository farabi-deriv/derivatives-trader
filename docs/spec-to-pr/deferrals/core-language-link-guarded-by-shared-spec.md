# `packages/core`'s `language-link.tsx` is not deleted — a `packages/shared` spec reads it by path

## What was deferred

Deleting `packages/core/src/App/Components/Routes/language-link.tsx` (68 LOC), which issue [#1274](https://github.com/deriv-com/derivatives-trader/issues/1274)'s C8b "Routes machinery" bullet names as dead.

The file's only consumer at HEAD `6da4e254dd` is its own barrel line in `packages/core/src/App/Components/Routes/index.js` (the `import LanguageLink from './language-link';` on line 2 and the `LanguageLink` name in the `export { BinaryLink, LanguageLink, RouteWithSubRoutes };` on line 7). Issue #1274 drops that named export, so after this change the module has **zero** consumers and is a clean delete on every other axis.

What blocks it is a cross-package test coupling introduced by the C7 sweep (#1272):

```ts
// packages/shared/src/__tests__/dead-code-sweep.spec.ts:53-57
it('[DCR-009] should have removed the commented-out TranslationFlag call in core', () => {
    expect(readRepoFile('packages/core/src/App/Components/Routes/language-link.tsx')).not.toContain('TranslationFlag');
});
```

`readRepoFile` is `fs.readFileSync`. If the file is gone the call throws `ENOENT` and the assertion fails — in a `packages/shared` spec, not a `packages/core` one.

## Why

Issue #1274's Part 3 rule 8 forbids editing `packages/shared`, `components`, `reports`, `api`, `stores` or `utils`: they belong to the parent changes C7 (#1272) and C8-small (#1273), both with in-flight PRs at the time of writing, and an edit there would collide. The one-line fix — replacing the `readRepoFile(...).not.toContain('TranslationFlag')` assertion with an existence check inverted, or dropping the assertion since its subject is gone — is trivially correct but lands in a file neither change owns.

Deleting the file and fixing the spec together is the right change; doing it inside a 11,500-line deletion targeting a stacked branch is not.

## Follow-up required

Once #1272 and #1273 have merged to `master` and `packages/shared` is no longer contended:

1. Delete `packages/core/src/App/Components/Routes/language-link.tsx`.
2. Confirm nothing imports it: `grep -rnw "LanguageLink\|language-link" packages playwright --exclude-dir=node_modules` must return zero after #1274's barrel edit has landed. (#1274 removes the barrel line, so this should already be true.)
3. Replace the assertion at `packages/shared/src/__tests__/dead-code-sweep.spec.ts:53-57`. The DCR-009 intent was "the commented-out `TranslationFlag` call is gone from core"; with the whole file deleted that intent is satisfied more strongly, so the honest replacement is:
    ```ts
    expect(fs.existsSync(path.join(repo_root, 'packages/core/src/App/Components/Routes/language-link.tsx'))).toBe(
        false
    );
    ```
    Keep the `[DCR-009]` tag so the requirement stays traceable.
4. Also delete `packages/core/src/sass/app/_common/components/settings-language.scss` (112 LOC) if `language-link.tsx` was its last consumer — verify the `.settings-language__language-link` base class has no other producer first.
5. Check the same pattern before any future cross-package sweep: `packages/shared/src/__tests__/dead-code-sweep.spec.ts` reads **two** `packages/core` paths by absolute path. The other is `packages/core/src/_common/utility.js` (line 60, asserting `const isEuCountry` is present), which costs nothing today because `isEuCountry` is genuinely live — but it is the same trap.

**Tracked:** https://github.com/deriv-com/derivatives-trader/issues/1388
