# Deferral: crypto-denominated stake/take-profit stepping in landscape

**What was deferred:** The landscape value ladder uses a uniform `0.10` step and assumes a 2-decimal fiat currency. Crypto-denominated accounts (8 decimals, e.g. BTC) are not supported by the drag picker.

**Why:** A `0.10` step is meaningless for a crypto account — `trade-store.ts` already special-cases `isCryptocurrency(currency)` for minimums and `getDecimalPlaces` returns 8 for BTC. Supporting crypto would need a currency-aware, non-uniform step and is out of scope for this Accumulators-only landscape v1. The assumption is confirmed with the requester (fiat-only) and recorded in a comment in `landscape-wheel-utils.ts`.

**Follow-up required:** If crypto-denominated accounts are ever enabled for landscape trading, replace the uniform-tenths ladder in `packages/trader/src/AppV2/Utils/landscape-wheel-utils.ts` with a currency-aware step derived from `getDecimalPlaces(currency)` / the server minimum, and re-verify `valueAt`/`indexOf` have no float drift at 8 decimals.
