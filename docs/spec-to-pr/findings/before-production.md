# Before-production findings

## Help centre geo routing — EU-egress verification (issue #1252)

- Ships now (staging/demo): `platform.help_centre_url` points at
  `https://deriv.com/helpcentre/deriv-trader`; the deriv.com content site is trusted to lift EU
  visitors to `/eu/helpcentre/deriv-trader` via its own geo-routing.
- Before production: verify from real EU egress (e.g. Spain, as in the bug report) that opening
  `https://deriv.com/helpcentre/deriv-trader` finally renders the EU help centre. The non-EU half
  was verified directly on 2026-08-26 from Malaysian egress (global page, no `/eu/`); the EU half
  could not be executed from the implementation environment (no EU egress available).
- Why staging is OK: the failure mode is bounded to the spec's safe default — an EU visitor landing
  on the global help centre — which is the fallback the spec itself mandates for an unknown market.
  The reported defect (non-EU visitors pinned to `/eu/`) is fixed and covered by tests either way.
  If EU egress does not get lifted, the plan's group 4 contingency (in-app market resolver with
  `help_centre_url_eu`) is pre-broken-down in
  `openspec/changes/bug-dtrader-help-always-opens-eu-help-centre-url-help-public-chrome/tasks.md`.
