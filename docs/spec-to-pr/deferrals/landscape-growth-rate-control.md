# Deferral: growth-rate control in landscape

**What was deferred:** The Accumulator growth-rate selector is not rendered anywhere on the landscape trade surface. The landscape pill carries only Stake, Take profit and Buy.

**Why:** Per the confirmed decision in `docs/landscape-mode-accumulators-plan.md` §4, the chart team owns the growth-rate control on the chart in landscape. Rendering it in our pill would duplicate an control another team is building, and the chart-side control has not shipped. This is a cross-team dependency, not our scope.

**Follow-up required:** Once the chart team's growth-rate control lands, confirm it appears and is adjustable on the DTrader AppV2 landscape trade surface for Accumulators. Until then, growth rate is not adjustable in landscape — the user must rotate to portrait to change it. Track ownership, control design and timing with the chart team (plan §9 open item 1).
