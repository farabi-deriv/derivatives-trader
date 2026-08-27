# trade.deriv.com help-centre redirect discards the visitor's market

**Class:** report-upstream — the root external defect behind deriv-com/derivatives-trader#1252.

**Source:** the `trade.deriv.com` web property (not in this repo, not an npm dependency) — its
redirect rule for `/help-centre/deriv-trader`, the URL `brand.config.json` pointed
`platform.help_centre_url` at until this change.

**Symptom:** issue #1252 (June 2026) shows visitors from both Spain (EU) and Kenya (non-EU) being
forwarded to `https://deriv.com/eu/helpcentre/deriv-trader`, so every DTrader Help click — desktop
sidebar `dt_sidebar_help` and mobile Menu → Help centre — landed on the EU help centre with EU-only
CFD risk copy, regardless of the visitor's market.

**Root cause:** the hop forwards to a fixed regional variant of the help centre instead of the
region-neutral content-site URL, discarding the EU/non-EU decision that deriv.com itself makes for
its visitors. Re-checked 2026-08-26 from Malaysian (non-EU) egress: the hop now 301s server-side to
the global `https://deriv.com/help-centre/deriv-trader`, so the forwarding is either geo-conditional
or has been partially fixed since the report — but the issue's June observations show EU-pinning at
that time, and any consumer linking through the hop inherits whatever that rule does next.

**Fix at the source:** trade.deriv.com should forward `/help-centre/deriv-trader` to the
region-neutral `https://deriv.com/help-centre/deriv-trader` for **all** egress (as already observed
for MY egress on 2026-08-26) and let deriv.com's own geo-routing lift EU visitors to
`/eu/helpcentre/deriv-trader` — never pin a regional variant. Escalated on the tracking issue:
https://github.com/deriv-com/derivatives-trader/issues/1252 (escalation comment linked in the PR
description).

**Why our code must not change:** it no longer depends on the hop — `getHelpCentreUrl()` now routes
straight to the content site, which owns the regional help-centre IA. The hop remains a live
misrouting risk only for other properties that still link to it.
