# Deferral: AccumulatorsInformation (Barrier / Max-duration) placement in landscape

**What was deferred:** The Barrier and Max-duration readouts (today's `AccumulatorsInformation`, `accu_info_display`, which renders desktop-only) are not placed anywhere on the landscape trade surface. The landscape layout omits them.

**Why:** These readouts render only on the desktop path today and not on the mobile path, so no behaviour is lost by omitting them from landscape. Whether they belong in landscape "if anywhere" is an open design question (plan §9 open item 4) with no confirmed placement, and inventing one would be guessing at design.

**Follow-up required:** Get design to confirm whether the Barrier and Max-duration readouts should appear in landscape and where (e.g. in the stats strip, in the pill, or on the chart). If yes, add them to `trade-landscape.tsx` in a follow-up change; if no, close this out.
