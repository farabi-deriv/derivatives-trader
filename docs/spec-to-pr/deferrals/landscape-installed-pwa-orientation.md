# Deferral: landscape in the installed PWA / native webview

**What was deferred:** Landscape trade mode ships for browser tabs only. `packages/core/src/templates/app/manifest.json` keeps `"orientation": "portrait"` unchanged, so the installed PWA does not rotate. The native webview shell's own orientation lock is not confirmed or changed here.

**Why:** Flipping the manifest orientation would let **every** route rotate (not just the accumulator trade page), which is out of scope and a wider product decision. The native app may lock orientation independently of the manifest.

**Follow-up required:** (1) Confirm with the native team whether the webview shell locks orientation before promising installed-app support (plan §9 open item 2). (2) If installed-app landscape is later wanted, decide how to allow rotation on the trade route only without unlocking every route — a manifest change alone is too broad.
