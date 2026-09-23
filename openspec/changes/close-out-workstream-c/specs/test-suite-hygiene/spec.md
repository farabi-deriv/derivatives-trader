## Purpose

Defines what the repository's Jest suite may and may not assert, so that a large deletion programme does not leave behind tests whose only subject is code that no longer exists, spec files that name the wrong module, or tests parked as skipped with no recorded reason.

## ADDED Requirements

### Requirement: [TSH-001] No test may exist whose only subject is absent code

A test whose sole subject is the absence of code — asserting a deleted file does not exist, a removed export is no longer on a barrel, a removed store member is not on an instance, a deleted module fails to resolve, or a source file does not contain a token — SHALL NOT exist in the repository. Deletions are proven by the build (a surviving import of a deleted module fails to compile), by the dead-code ratchet (anything re-orphaned fails the gate) and by the pre-existing suites staying green; a test is not a third proof, it is maintenance cost on every later refactor of a neighbouring file. Every such test the cleanup programme added SHALL be deleted. Where a file of such tests also contains a test that exercises live runtime behaviour, that test SHALL be preserved by moving it to the spec of the module it exercises, not deleted with its host file.

#### Scenario: The absence-pinning specs are gone

- **WHEN** the suite is searched for tests that assert a path does not exist, a module fails to resolve, a member is not present on an instance, or a source file does not contain a token
- **THEN** no such test remains

#### Scenario: A live-behaviour test caught up in a deleted file survives

- **WHEN** a file of absence-pinning tests also contains a test that calls live code and asserts its observable result
- **THEN** that test exists, unchanged in substance, in the spec for the module it exercises, and still passes

#### Scenario: The suite is green and no coverage of live behaviour is lost

- **WHEN** the full Jest suite runs after the deletions
- **THEN** it passes, and every remaining test exercises code that exists

### Requirement: [TSH-002] No new test may be added to confirm a removal

No test SHALL be added to confirm that anything has been removed — including the removals made by the change that introduces this requirement. A change that deletes code SHALL rely on the build, the dead-code ratchet and the existing suites for its proof. This prohibition SHALL apply to every later cleanup change, not only to this one.

#### Scenario: A deletion ships without a confirming test

- **WHEN** a change removes a file, an export, a store member or a branch
- **THEN** its diff adds no test asserting that the removed thing is gone, and the deletion is verified by compilation, the dead-code gate and the pre-existing suites

### Requirement: [TSH-003] A spec file is named after the module it tests

A spec file SHALL be named after the module whose behaviour it exercises, matching that module's file name exactly — including separator style, spelling and casing — and SHALL carry the extension its content requires, with the JSX extension used only by a file that contains JSX. A spec that covers one named aspect of a larger module MAY carry a topic-scoped name, but SHALL NOT carry a name that reads as a different module's. Renaming a spec SHALL NOT change its content beyond the extension, so the rename is reviewable as a pure move.

#### Scenario: Every spec resolves to the module it names

- **WHEN** each spec file whose name does not match its subject module is examined
- **THEN** it has been renamed to the subject module's name, or it is a deliberately topic-scoped spec of a larger module

#### Scenario: A renamed spec still runs and still passes

- **WHEN** the suite runs after the renames
- **THEN** every renamed spec is collected by the test-path pattern and passes with the same assertions it had before

#### Scenario: The JSX extension tracks the content

- **WHEN** a renamed spec contains no JSX
- **THEN** it carries the non-JSX extension

### Requirement: [TSH-004] No Jest test is left skipped without a recorded reason

The Jest suite SHALL contain no skipped or pending test — no `describe.skip`, `it.skip`, `xit`, `xdescribe` or `it.todo` — unless the skip carries a recorded reason in the repository. A test that cannot be made to pass SHALL be fixed or deleted, never parked. A runtime guard that ends a run early on an environment condition, and states that condition, is not a skipped test for this purpose.

#### Scenario: The suite has no unexplained skip

- **WHEN** the packages are searched for the skip and pending forms
- **THEN** there are no occurrences, or each occurrence carries a recorded reason

### Requirement: [TSH-005] Deleting specs is reflected in the committed dead-code baseline

Because the dead-code baseline records findings per file, deleting spec files changes the finding set. The committed baseline SHALL be regenerated with the pinned tool and committed in the same change, so the gate is green against the tree that ships and the regenerated diff records exactly what the deletions removed.

#### Scenario: The baseline matches the tree after the deletions

- **WHEN** the dead-code gate runs against the change's final tree
- **THEN** it exits zero, and the committed baseline diff contains only entries attributable to the files this change deleted or renamed
