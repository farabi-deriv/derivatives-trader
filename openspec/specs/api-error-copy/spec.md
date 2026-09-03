# api-error-copy Specification

## Purpose

TBD - created by archiving change p2-raw-api-parameter-name-date-expiry-surfaces-in-user-facing-error-toast. Update Purpose after archive.

## Requirements

### Requirement: A user-facing backend error message contains no raw API parameter name

Any message derived from an API error and shown to a user SHALL NOT contain a raw API parameter name. This covers all three paths by which an API error becomes copy: parameters interpolated from the error's `code_args`, the backend's own `error.message` when the error carries no mapped `subcode`, and the authored message templates themselves. A "raw API parameter name" means the wire identifier of a request field — `date_expiry`, `take_profit`, `duration_unit`, `underlying_symbol`, `barrier2` and the like.

#### Scenario: The reported toast names the end time in English

- **WHEN** a proposal is rejected with `subcode` `MissingEither` and `code_args` `['duration', 'date_expiry']`
- **THEN** the message reads "Please specify either duration or end time."
- **AND** it does not contain the token `date_expiry`

#### Scenario: A parameter list inside one argument is fully translated

- **WHEN** an error carries a single `code_args` entry holding several comma-separated parameter names (e.g. `'take_profit, stop_loss'`)
- **THEN** every name in that entry is replaced by its label ("take profit, stop loss")
- **AND** the separators and surrounding punctuation of the message are preserved

#### Scenario: An unmapped error's backend prose is sanitized

- **WHEN** an error has no `subcode`, or a `subcode` with no authored message, and its `error.message` mentions a known parameter name (e.g. "Please specify either duration or date_expiry.")
- **THEN** the known name is replaced by its label before the message is shown

#### Scenario: An unmapped error with an unrecognised identifier falls back to the generic message

- **WHEN** an unmapped error's `error.message` still contains a lowercase snake_case identifier after substitution (an API field the glossary has no label for)
- **THEN** the generic message "An error occurred. Please try again later." is shown instead of the leaking prose
- **AND** the original `error.message` remains available on the error object for logging and analytics

### Requirement: A parameter is named with the label the UI already uses for that field

The label substituted for a parameter name SHALL be the wording the app's own UI uses for that field, so the message points the user at a control they can find. `date_expiry` SHALL be rendered as "end time", matching the **End time** duration tab. The set of labelled parameters SHALL cover the request fields this app sends on `proposal`, `buy`, `contract_update` and the autotrader contract template — the only parameters a backend rejection can name. Labels SHALL be resolved in the user's active language at the time the message is built, not fixed at application start.

#### Scenario: End time uses the app's own tab wording

- **WHEN** a message names the `date_expiry` parameter
- **THEN** it reads "end time", the same wording as the duration picker's End time tab

#### Scenario: Labels follow a language switch

- **WHEN** the user switches the app language and then triggers the same rejection
- **THEN** the parameter label is rendered in the newly selected language

#### Scenario: An unlabelled parameter does not blank the message

- **WHEN** an error names a parameter that has no label in the glossary
- **THEN** the message is still produced (no empty string, no `undefined` in the copy)

### Requirement: Values carried alongside parameter names are preserved exactly

Substitution SHALL apply only to parameter names. Every other value an error carries — stake and payout amounts, currency codes, barrier and range bounds, dates and times, market symbol codes (`R_100`, `1HZ100V`), contract-type codes (`MULTUP`, `DIGITMATCH`) and decimal counts — SHALL reach the message byte-for-byte unchanged, preserving the sign convention and decimal places the user is expected to type.

#### Scenario: A barrier range is unchanged

- **WHEN** a barrier is rejected with `subcode` `BarrierNotInRange` and `code_args` `['+207.90', '-207.60']`
- **THEN** the message quotes those bounds exactly, including the leading signs and trailing zeros

#### Scenario: An uppercase code is not mistaken for a parameter name

- **WHEN** an error message or argument contains `R_100` or `MULTUP`
- **THEN** the code is left untouched and does not trigger the generic fallback

### Requirement: Authored error copy contains no raw API parameter name

The authored English templates the app maps errors to SHALL be free of raw API parameter names, and this SHALL be enforced automatically rather than by review. A template placeholder for an interpolated argument is not a parameter name and is exempt.

#### Scenario: The existing hardcoded identifier is gone

- **WHEN** an error is mapped to the `InvalidExpiry` message
- **THEN** the message names the duration and end time in English and contains no `date_expiry` token

#### Scenario: A reintroduced identifier fails the build

- **WHEN** an authored template is edited to include a lowercase snake_case API identifier
- **THEN** the test suite fails and names the offending template

### Requirement: A substituted label reads grammatically in its message

A template that interpolates a parameter name SHALL read correctly once a multi-word label is substituted — no doubled nouns, no missing punctuation before a list.

#### Scenario: A second barrier does not double its noun

- **WHEN** a barrier-offset decimals rejection names the `barrier2` parameter
- **THEN** the message reads as a single well-formed sentence about the second barrier offset, not "second barrier barrier offset"

#### Scenario: An allowed-parameter list is punctuated

- **WHEN** a contract-update rejection lists the parameters that may be updated
- **THEN** the list is introduced by punctuation rather than run onto the end of the sentence

### Requirement: The guarantee holds on every surface that renders a backend error

Sanitized copy SHALL be produced by the shared error-mapping layer that all surfaces already read, so no surface can opt out or re-derive its own copy. This includes the trade-parameter toasts (duration, barrier, last digit), the trade error snackbar, the stake / take-profit / stop-loss inputs on mobile and desktop, the service-error sheet and Reports' services-error modal, the portfolio / contract-trade / common stores, the socket-level error handler, and the proposal info `message` that inline field errors read.

#### Scenario: The same rejection is clean on a toast and on an inline field error

- **WHEN** the same proposal rejection is surfaced once as a toast and once as an inline trade-parameter error
- **THEN** both show the same sanitized wording with no raw parameter name

#### Scenario: A non-trading surface is covered too

- **WHEN** a Reports or portfolio request is rejected with an error naming an API parameter
- **THEN** the message shown there is sanitized by the same layer
