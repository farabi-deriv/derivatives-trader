# @semantic-release/npm security stub

Replaces `@semantic-release/npm` so the full `npm` CLI (pulled in via `@deriv-com/quill-tokens`) is not installed. That CLI bundles vulnerable transitive packages that ignore npm `overrides`.

This stub is for Dependabot alert closure only. The trading app does not use it at runtime.
