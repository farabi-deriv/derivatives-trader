# `@deriv/components` props whose only consumer lives in `packages/core` are not pruned

## What was deferred

The part of issue #1273's C8a prop-surface prune that would require editing a file under `packages/core/`.

Issue #1273 explicitly scopes `packages/core` out — it belongs to issue [#1274](https://github.com/deriv-com/derivatives-trader/issues/1274). But `packages/core` is a _consumer_ of most of the components being pruned, so a prop it passes cannot be removed here even when every other package has stopped using it. Known cases at HEAD `8038e85f3f`:

- **`VerticalTab`** — `packages/core/src/App/Components/Layout/Footer/toggle-settings.jsx:16` renders `<VerticalTab list={content} />`. This is the second consumer; `packages/reports/src/Containers/reports.tsx:222` is the first. The issue body's "sole consumer uses 6/24 props" figure was measured against `packages/reports` alone. `list` is therefore permanently in the keep set for this change, and the prune target is 7 of 24 props, not 6.
- **`Modal`** — of the 49 `<Modal` call sites in the repo, a large share are under `packages/core` (`toggle-settings.jsx`, the Endpoint and NotificationsDialog surfaces, and others). Any prop passed only from there survives this change.
- **`Popover`, `Input`, `InputField`, `Dropdown`, `SelectNative`, `DataTable`** — same pattern; the exact per-prop list is produced by task 7.1's consumer sweep and appended here by the implementing change.

Also deferred: `packages/core/src/sass/app/_common/components/account-common.scss:850`'s `.dc-dropdown-list` rule and `packages/core/src/sass/app/_common/components/media-item.scss:10`'s `.inline-message` rule. The former stays live (the class is emitted by `dropdown.tsx`'s internal `DropdownList`); the latter becomes dead when `InlineMessage` is deleted in C8a, but the file is in `packages/core`.

## Why

Issue #1273's Definition of Done requires `packages/core` untouched, and a PR that edits it would collide with #1274's own sweep of the same files. The prop-surface prune's ~543 LOC budget is a ceiling, not a target: the honest result is "everything provable without leaving scope", with the remainder recorded rather than forced.

## Follow-up required

As part of, or immediately after, issue #1274 (`packages/core` sweep):

1. Re-run the consumer sweep for each of `vertical-tab`, `tabs`, `modal`, `input-field`, `input`, `dropdown`, `select-native`, `data-table` and `popover` across **all** packages now that `packages/core` is editable, and take the union of props actually passed.
2. For each prop kept in #1273 only because a `packages/core` file passed it, decide whether the core call site should stop passing it (then remove the prop from `@deriv/components`) or whether the prop is genuinely load-bearing.
3. Specifically re-check `VerticalTab`: if `toggle-settings.jsx` is itself removed or migrated during #1274, `VerticalTab`'s consumer set drops to `packages/reports/src/Containers/reports.tsx` alone and a further six props become removable.
4. Delete `packages/core/src/sass/app/_common/components/media-item.scss:10`'s `.inline-message` block, whose component was removed in #1273.
5. Apply the same base-class rule to any SCSS touched: `${base}__modifier` names are built dynamically and are live despite zero literal grep hits.

## Measured result (appended by the implementing change, issue #1273)

Task 7.1's consumer sweep ran over every `.tsx`/`.jsx` file tracked by git, filtered to call sites that import the component from `@deriv/components` (or relatively within it), so that `@deriv-com/quill-ui`'s same-named `Modal`, `Input` and `Popover` are excluded. Four props survive **only** because a file under `packages/core/` passes them:

| Component  | Prop                            | Sole consumer                                                                           |
| ---------- | ------------------------------- | --------------------------------------------------------------------------------------- |
| `Input`    | `hint`                          | `packages/core/src/App/Devtools.tsx`                                                    |
| `Input`    | `maxLength`                     | `packages/core/src/App/Devtools.tsx`, `packages/core/src/Modules/Endpoint/Endpoint.jsx` |
| `Dropdown` | `placeholder`                   | `packages/core/src/App/Components/dev-tools/mock-dialog.tsx`                            |
| `Popover`  | `should_disable_pointer_events` | `packages/core/src/App/Components/Layout/Header/toggle-notifications.jsx`               |

`VerticalTab`'s `list` is the fifth: `packages/reports/src/Containers/reports.tsx:222` passes it too, so it is not core-only, but `toggle-settings.jsx` is what makes the other six reports props un-removable as a group — see item 3 above.

A separate case: `packages/core/src/App/Components/Layout/Footer/toggle-settings.jsx` passes `disableApp` and `enableApp` to `<Modal>`, and `@deriv/components`' `Modal` has never declared either. They are silently ignored today. Because the file is a `.jsx` excluded from `tsconfig.json`, nothing flags them. Remove both from the call site during #1274 rather than adding them to `Modal`'s prop type.

Everything else the prune targeted was removable without leaving scope: `git diff --name-only` for issue #1273 contains no path under `packages/core/`.

**Tracked:** https://github.com/deriv-com/derivatives-trader/issues/1373
