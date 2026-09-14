# `front-channel.html` is not deleted — its consumer is an external identity provider, not this repo

## What was deferred

Deleting `packages/core/src/root_files/front-channel.html` (24 lines) and its `CopyPlugin` entry at `packages/core/build/config.js:59-60`, which issue [#1274](https://github.com/deriv-com/derivatives-trader/issues/1274)'s C8b asset bullet names — with the explicit caveat "verify no OIDC registration first", stated as a hard gate rather than a note.

The gate could not be discharged from this tree.

**In-repo evidence, measured at HEAD `6da4e254dd`:**

- `grep -rniE "oidc|frontchannel|front_channel_logout"` over `packages/core/src` and `packages/shared/src` returns **zero** hits.
- The only reference to the file anywhere is the CopyPlugin entry that ships it to the site root as `/front-channel.html`.
- `default.conf`, `vercel.json`, `vercel.dr.json`, `Dockerfile` and `.github/` contain no reference to it.

**Why that is not sufficient.** The page is a front-channel logout target: it detects that it is being rendered cross-origin (in an iframe on the IdP's logout page rather than in the app window) and clears `closed_toast_notifications`, `config.account1`, `config.tokens`, `client.accounts`, `verification_code.system_email_change`, `verification_code.request_email` and `new_email.system_email_change` from `localStorage`. Three of those keys are still written by this app today (`packages/core/src/Services/logout.js:56-58` removes the same `config.account1`, `config.tokens` and `verification_code.system_email_change`). The thing that would _call_ the page is the `frontchannel_logout_uri` registered on the OAuth/OIDC client with the external identity provider — configuration that lives in the IdP, not in this repository. No amount of grepping this tree can settle it.

## Why

A gate that cannot be discharged is not the same as a gate that passes. Deleting the page on in-repo evidence alone would, if the URI _is_ registered, silently break single-logout: a user who logs out at the IdP would keep stale `client.accounts` and `config.tokens` in this app's `localStorage`, and the failure would be invisible in CI, in review and in local testing — it only reproduces against a real IdP logout flow.

The cost of keeping it is 24 lines and roughly 1 KB in the deployed output. The cost of deleting it wrongly is a silent auth-state bug. The asymmetry decides it.

## Follow-up required

1. **Check the IdP client configuration** for every environment this app is deployed to (production, staging, and any regional variant). Look for `frontchannel_logout_uri`, `front_channel_logout_uri` or the provider's equivalent field on the OAuth client used by DTrader, and see whether any value ends in `/front-channel.html`. The relevant owners are whoever administers the Deriv SSO/Ory client registrations — this app has no auth of its own (it resolves an account from URL → `localStorage` → the shared `.deriv.com` `client_information` cookie).
2. **If no registration references it:** delete `packages/core/src/root_files/front-channel.html` and the CopyPlugin entry at `packages/core/build/config.js:59-60` in the same commit, and remove the `front-channel.html` assertion from `packages/core/src/__tests__/dead-code-sweep.spec.ts` (added by #1274 to pin the keep).
3. **If a registration does reference it:** leave the file, and instead reconcile its key list with `packages/core/src/Services/logout.js` — the two have already drifted (`logout.js` does not clear `client.accounts`; `front-channel.html` does not clear anything added since). Record the page as a live auth surface in `CLAUDE.md` so the next sweep does not re-flag it.
4. Either way, record the outcome so the question is answered once rather than re-litigated by every cleanup pass.

**Tracked:** https://github.com/deriv-com/derivatives-trader/issues/1387
