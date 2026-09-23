# Deferral: `Analytics.reset()` reset-on-mount semantics (bug 11 fallout)

**What was deferred:** Deciding the _correct_ trigger for `Analytics.reset()` in `packages/core/src/App/app.jsx` (~L74–78). C6 deletes the always-`undefined` `client.email` observable (the dead cookie cluster, bug 11 / ABF-012) and, to avoid a behaviour change, replaces the `email`-gated effect with an unconditional `Analytics.reset()` on mount — preserving exactly what shipped (the old effect's guard `!email` was always true, so it already fired once per mount). C6 does **not** decide whether resetting analytics on every app mount is actually intended.

**Why:** The effect was written to reset analytics when `email` was falsy — almost certainly a "reset on logout / not-logged-in" proxy — but `email` never populated (its only writer `setEmail` had zero callers), so the guard degenerated to "always." Fixing the _intent_ (e.g. reset only on `!is_logged_in`, or on an auth transition) is an analytics-behaviour change that belongs with Analytics/product sign-off, not inside a dead-code-removal batch whose stance is "preserve current observable behaviour."

**Follow-up required:** A future change (with Analytics/product input) should decide the correct condition for `Analytics.reset()` and implement it, replacing the interim unconditional mount-time reset. If reset-on-mount turns out to be undesired, remove the effect; if a logged-out/auth-transition reset is wanted, gate it on the appropriate `client.is_logged_in` transition rather than a mount effect. Reference: derivatives-trader issue #1271 (C6), bug 11.

**Tracked:** https://github.com/deriv-com/derivatives-trader/issues/1476
