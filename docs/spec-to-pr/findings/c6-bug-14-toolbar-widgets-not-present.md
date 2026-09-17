# Finding: bug 14 (toolbar-widgets function-negation) is NOT present at HEAD

**Change:** c6 / issue #1271, bug 14. **Requirement:** ABF-001 (re-verify at HEAD; record not-present reports as discrepancies).

## Reported bug

> `toolbar-widgets.tsx` negates the _function reference_ → StudyLegend + Share widgets can never render on desktop.

The implied defect is a `!isDesktop` (missing call parens) or `!isTabletOs()` (negating a truthy function reference) that is always false, gating the two widgets off on desktop.

## What HEAD actually contains

`packages/trader/src/Modules/SmartChart/Components/toolbar-widgets.tsx`:

```tsx
const is_real_desktop_device = isDesktopOs() && !isTabletOs; // (~L16)
...
{is_real_desktop_device && !isMobile && (
    <StudyLegend portalNodeId='modal_root' searchInputClassName='data-hj-whitelist' />   // ~L25–27
)}
{is_real_desktop_device && !isMobile && <Share portalNodeId='modal_root' />}             // ~L28
```

- `isDesktopOs` **is called** — `isDesktopOs()` with parens (`packages/shared/src/utils/os/os_detect.ts` ~L56, `export const isDesktopOs = () => {...}`).
- `isTabletOs` is **not a function** — it is a module-level boolean constant (`os_detect.ts` ~L87–92, the result of `.test(...) || ...`). So `!isTabletOs` is a valid boolean negation, not a truthy-function-reference negation.

Therefore `is_real_desktop_device && !isMobile` is reachable-true on a real desktop and `StudyLegend`/`Share` **do** render there. Git history (`b92f9b8308` and the current revision) shows the same `isDesktopOs() && !isTabletOs` form throughout — there was never a `!isDesktop`/`!isTabletOs()` function-negation here.

## Conclusion

**The reported bug is absent at HEAD. No code change was made for bug 14.** Per ABF-001, this discrepancy is recorded rather than coded, and the C6 requirement set carries no ABF-0xx for bug 14 (its home is ABF-001's discrepancy scenario).

## Separate, out-of-scope observation

`isTabletOs` is evaluated once at module import, so it will not re-evaluate if the device/emulation profile changes without a reload. This is a minor latent limitation, **not** the reported defect, and is out of C6's scope — recorded here only for completeness, with no tracked follow-up.
