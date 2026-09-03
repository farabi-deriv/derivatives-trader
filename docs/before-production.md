# Before-production findings

Decisions that are acceptable to ship now but must be revisited before a production release.
One section per finding, each with three bullets: what **ships now**, what must happen
**before production**, and **why staging is OK** in the meantime.

## The market tab strip does not survive closing the browser

- Ships now (staging/demo): the tab strip (`OPEN_MARKETS_STORAGE_KEYS` in
  `packages/trader/src/AppV2/Utils/open-markets-utils.ts`) moved from `localStorage` to
  `sessionStorage`, so it is scoped to one browser tab like the parameters below. This is what makes
  a new browser tab open a single default market tab instead of reopening the markets another
  browser tab has open (change `design.md` D8, Q1 option (a)). Consequence: closing the browser
  discards the strip, where previously it was restored.
- Before production: confirm with product that "a new browser tab starts from a single default tab"
  is worth losing "my tabs come back after a browser restart". If both are wanted, the strip moves
  back to `localStorage` namespaced by a per-browser-tab id held in `sessionStorage` — isolating tabs
  while surviving a restart, at the cost of a tab-id lifecycle and a reaper for abandoned
  namespaces. No consumer change either way; the medium is isolated to `readOpenMarkets` /
  `writeOpenMarkets`.
- Why staging is OK: it is the behaviour that was explicitly asked for, and the strip is cheap to
  rebuild by hand (a few taps) compared with re-entering parameters.

## Per-tab trade parameters do not survive closing the browser

- Ships now (staging/demo): each market tab's trade parameters (stake, duration, barriers,
  take profit / stop loss, deal cancellation) live in `sessionStorage`
  (`TAB_TRADE_PARAMS_STORAGE_KEYS` in `packages/trader/src/AppV2/Utils/tab-trade-params-utils.ts`).
  They survive a page refresh and switching between tabs, but are gone once the browser tab is
  closed. Previously a single global set lived in `localStorage['trade_store']` and survived a
  browser restart.
- Before production: confirm with product that "a new browser tab starts from defaults" is worth
  losing "parameters survive a browser restart". If both are wanted, the parameters map moves to
  `localStorage` namespaced by a per-browser-tab id held in `sessionStorage` (option (ii) in the
  change's Open Question 2).
- Why staging is OK: `sessionStorage` is what scopes the parameters to a browser tab, which is the
  behaviour the change was asked for. The tab strip (see the section above) is now scoped the
  same way, so a browser restart resets the tabs and their parameters together.
