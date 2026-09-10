# Feed Journey Coverage

**Analysis date:** 2026-09-10

---

## Section 1 — Coverage at a Glance

| #      | Journey                                                                | Desktop | Mobile | Notes                                                                                                                                                                                 |
| ------ | ---------------------------------------------------------------------- | ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flow 1 | All markets: live feed ticks on Market Info for every tradeable symbol | ✅      | ✅     | ~65 symbols; picker opens once → cross-trade-type search → skip **CLOSED** in list or assert `.market-info__price` ticks on Info; Back between live markets; picker closed after loop |

Full details → [flow.md — Flow 1](./flow.md#flow-1--all-markets-live-feed-ticks-on-market-info-for-every-tradeable-symbol--feedverify-all-markets-streamingspects)

---

## Section 2 — Gaps

_No known gaps._

---

## Section 3 — Priority List

| Priority | Spec file                                   | Flow   | Reason                                                                                               |
| -------- | ------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| P0       | `feed/verify-all-markets-streaming.spec.ts` | Flow 1 | Confirms WebSocket feed is alive for all tradeable markets (~65 symbols) via Market Info price ticks |
