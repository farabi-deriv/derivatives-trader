## ADDED Requirements

### Requirement: [TSG-001] A failing package fails the TypeScript gate

The repository SHALL provide a `test:typescript` npm script (`node scripts/typecheck.js`) that runs `tsc --noEmit` against each gated package's `tsconfig.json`, waits for every run to finish, and exits non-zero when **any** run exits non-zero.

The runner SHALL report every failing package, not only the first — a change that breaks two packages must show both, so the author does not fix one and rediscover the other on the next CI round. The runner SHALL NOT diff findings against a committed baseline: a non-zero `tsc` exit is a failure, full stop.

`.github/workflows/test.yml`'s `Check TypeScript` step SHALL invoke this script as its whole command, with nothing appended that could discard its exit status.

#### Scenario: One package fails, the gate fails

- **WHEN** one gated package's `tsc` project exits non-zero and every other gated package exits 0
- **THEN** `npm run test:typescript` exits non-zero and names the failing package with its `tsc` output

#### Scenario: Every failing package is reported

- **WHEN** two or more gated packages exit non-zero in the same run
- **THEN** the summary lists all of them, not just the one that finished first

#### Scenario: All packages clean passes

- **WHEN** every gated package's `tsc` project exits 0
- **THEN** `npm run test:typescript` prints a pass summary and exits 0

#### Scenario: A backgrounded shell step can never swallow a status again

- **WHEN** `.github/workflows/test.yml` is inspected
- **THEN** no `run:` step contains a line that is a bare `wait` (which returns 0 regardless of its children), and the `Check TypeScript` step's command is exactly `npm run test:typescript`

### Requirement: [TSG-002] The gated package set is explicit and complete but for a documented exclusion

The gated set SHALL be a single list in `scripts/typecheck.js`, covering `api`, `components`, `reports`, `shared`, `stores`, `trader` and `utils` — every package under `packages/` that has a `tsconfig.json`, except `core`.

`packages/core` SHALL be the only exclusion and SHALL be recorded as a deliberate one in the script, because core resolves `@deriv/trader` and `@deriv/reports` sources through the `@deriv/*` alias without inheriting those packages' own alias roots, and `trader` and `reports` both claim the `Types` alias for different modules — so core's project cannot resolve both.

`packages/trader` SHALL be gated here explicitly even though `ForkTsCheckerWebpackPlugin` also type-checks it during the Build job, so the gate does not depend on a webpack mode inference to stay blocking.

#### Scenario: The list tracks the packages that exist

- **WHEN** the gated list is compared against the directories under `packages/` that contain a `tsconfig.json`
- **THEN** the two sets differ only by `core`, and every gated entry resolves to an existing `packages/<name>/tsconfig.json`

#### Scenario: A new package cannot be quietly ungated

- **WHEN** a package with a `tsconfig.json` is added to `packages/` and not added to the gated list
- **THEN** the script's unit test fails, naming the ungated package

### Requirement: [TSG-003] Every gated package reports zero type errors

Each gated package's `tsc --noEmit` run SHALL report zero errors, in source **and** in test files. No committed per-package error baseline or allowlist SHALL be introduced for this gate.

Test files are in scope deliberately: with the tsconfig defects of [TSG-004] corrected, the whole-repo residue is 25 errors, small enough to clear outright, and a baseline file would only preserve the class of blindness this change removes.

#### Scenario: Gated packages are clean

- **WHEN** `npm run test:typescript` runs on the merge result
- **THEN** every gated package exits 0, with no errors reported from `__tests__/`, `*.spec.*` or `*.test.*` files either

#### Scenario: No allowlist file is introduced

- **WHEN** the repository is inspected for the artifacts this gate depends on
- **THEN** there is no committed per-package TypeScript error baseline, and the only inputs are each package's `tsconfig.json` and the gated list

### Requirement: [TSG-004] Shared ambient declarations are wired once and narrowed nowhere

Ambient declarations that every package needs SHALL live at the repository root under `types/` and be listed in each gated package's `tsconfig.json` `include`:

- `types/deriv-com-translations.d.ts` — the existing `@deriv-com/translations` shim.
- `types/testing-library.d.ts` — registers `@testing-library/jest-dom`'s matcher augmentation, replacing the one-line `packages/trader/index.d.ts` that only `trader` included.

No gated package's `tsconfig.json` SHALL set `typeRoots`. A `typeRoots` entry that does not resolve silently drops every ambient `@types` package from the project, and one that names a directory of loose `.d.ts` files raises a config-level diagnostic — and a config-level diagnostic makes `tsc` skip semantic checking for the whole project, so the package reads as almost clean while it is in fact unchecked. Every gated package SHALL instead use the default root `node_modules/@types` walk-up.

A `tsconfig.json` `include` entry SHALL NOT name a path that does not exist; `tsc` ignores it silently, so it reads as coverage that is not there.

#### Scenario: No package narrows typeRoots

- **WHEN** the gated packages' `tsconfig.json` files are inspected
- **THEN** none of them declares a `typeRoots` compiler option

#### Scenario: A config-level diagnostic is treated as a failure, not a near-pass

- **WHEN** a gated package's project emits a config-level diagnostic such as `TS2688`
- **THEN** `tsc` exits non-zero and the gate fails, rather than the project reading as one error away from clean while its semantic checking is skipped

#### Scenario: jest-dom matchers resolve in every gated package

- **WHEN** a spec in any gated package asserts with `toBeInTheDocument` or another `@testing-library/jest-dom` matcher
- **THEN** the matcher type-checks, because that package's `tsconfig.json` includes `types/testing-library.d.ts`

### Requirement: [TSG-005] The parallel lint step propagates each command's exit status

`.github/workflows/test.yml`'s `Run linting` step SHALL capture the PID of each backgrounded command and `wait` on it individually, failing the step when either `npm run test:stylelint` or `npm run test:eslint-all` exits non-zero.

#### Scenario: A stylelint failure fails the job

- **WHEN** `npm run test:stylelint` exits non-zero and `npm run test:eslint-all` exits 0
- **THEN** the `Run linting` step exits non-zero

#### Scenario: An ESLint failure fails the job

- **WHEN** `npm run test:eslint-all` exits non-zero and `npm run test:stylelint` exits 0
- **THEN** the `Run linting` step exits non-zero
