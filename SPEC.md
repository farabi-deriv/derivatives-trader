# Spec — derivatives-trader

<!-- spec-manifest v1 -->

```yaml
format: openspec
spec_root: openspec/specs
owner: nijil-deriv
lifecycle: spec-to-code
```

Living specs: [`openspec/specs/`](openspec/specs/) · in-flight changes:
[`openspec/changes/`](openspec/changes/).

Specs are authored before the code that satisfies them, and changes ship through
[`@deriv-com/spec-to-pr`](https://github.com/deriv-com/spec-to-pr) (`dstp`) —
configured by [`spec-to-pr.config.json`](spec-to-pr.config.json), triggered by
[`spec-to-pr-trigger.yml`](.github/workflows/spec-to-pr-trigger.yml), with
[`issue-to-spec-trigger.yml`](.github/workflows/issue-to-spec-trigger.yml)
seeding a change from a GitHub issue.

The engine runs in one of two lanes, and they write to different places.

**Full run (OpenSpec).** Work is planned into `openspec/changes/<slug>/` —
proposal, tasks, and delta specs carrying stable `[PREFIX-NNN]` requirement IDs
— reviewed at a human plan gate, then implemented and validated by
`openspec validate` before it ships.
[`openspec-archive-on-merge.yml`](.github/workflows/openspec-archive-on-merge.yml)
opens a follow-up PR that folds the merged delta into
[`openspec/specs/`](openspec/specs/). That accumulation is why `openspec/specs/`
is the `spec_root` above: it is the current-state spec body for the product.

**Fastlane.** A lighter lane that skips `openspec/` entirely. Its spec is written
to [`docs/spec-to-pr/specs/<slug>/spec.md`](docs/spec-to-pr/specs/) in the same
delta format with the same `[PREFIX-NNN]` IDs, alongside the run's design doc and
plan, and it lands with the change's own PR rather than being archived into
`openspec/specs/`. So a fastlane spec is a second, per-change spec location — not
reflected in `spec_root`, which points at the accumulated body.

Both `openspec/changes/**` and `docs/spec-to-pr/**` are engine-owned — written by
`dstp` runs, not by hand. Repo conventions for agents live in
[`CLAUDE.md`](CLAUDE.md).
