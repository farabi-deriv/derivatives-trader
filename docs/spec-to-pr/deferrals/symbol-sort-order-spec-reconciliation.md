# Reconcile the `symbol-sort-order` spec with the curated Derived order

**What was deferred:**

The unmerged OpenSpec change `cut-main-thread-work-behind-the-market-selector-inp-regression` proposes
a new capability `symbol-sort-order`. Its first requirement
(`openspec/changes/cut-main-thread-work-behind-the-market-selector-inp-regression/specs/symbol-sort-order/spec.md`)
states that same-market symbols are ordered "alphabetically by the localized submarket display name
using locale-aware comparison", and includes the scenario _"Same-market symbols keep a stable
submarket-name ordering"_.

Change `994-derived-market-ordering` makes that clause false for the Derived market: its seven curated
submarkets are ordered by a fixed key-based rank, ahead of the `localeCompare` fallback. That
contradicting clause was **not** corrected as part of `994-derived-market-ordering`.

**Why:**

`openspec/specs/symbol-sort-order/spec.md` does not exist yet — the capability lives only in an
unarchived change. `openspec archive` refuses a `## MODIFIED Requirements` delta whose target spec is
absent (_"target spec does not exist; only ADDED requirements are allowed for new specs"_, verified
against `@fission-ai/openspec@1.7.0`), so shipping the correction inside `994-derived-market-ordering`
would make that change unarchivable if it lands first. The two changes are independent and can archive
in either order.

**Follow-up required:**

Once **both** changes have been archived — i.e. `openspec/specs/symbol-sort-order/spec.md` exists and
`openspec/specs/derived-market-ordering/spec.md` exists — amend the `symbol-sort-order` spec so its
ordering requirement reads: within a market, symbols are ordered by curated submarket rank where the
submarket key has one, and only otherwise alphabetically by the localized submarket display name using
locale-aware comparison. Update its _"Same-market symbols keep a stable submarket-name ordering"_
scenario to say the same, and add a cross-reference to `derived-market-ordering` (requirements DMO-001
and DMO-002) as the authority for which keys are curated. Leave the two INP requirements
("Localized submarket names resolve against the runtime-active language", "Localization work is
bounded per sort") untouched — `994-derived-market-ordering` preserves both, and its tests still
assert the 28-call cap.

If instead `cut-main-thread-work-behind-the-market-selector-inp-regression` is still unarchived when
this is picked up, make the correction directly in that change's own delta spec file rather than in
`openspec/specs/`.

**Tracked:** https://github.com/deriv-com/derivatives-trader/issues/1358
