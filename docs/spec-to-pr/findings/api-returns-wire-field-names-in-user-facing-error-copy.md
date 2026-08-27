# The Deriv API returns wire field names in copy destined for retail users

**Class:** report-upstream — related to issue
[#1247](https://github.com/deriv-com/derivatives-trader/issues/1247).

**Source:** the Deriv API v3 WebSocket endpoint (`wss://api.deriv.com/websockets/v3`) — the `error`
object on `proposal`, `buy` and `contract_update` rejections. Not an npm dependency; the producer is
the backend service, so there is no version to bump. Observed on the client at
`packages/shared/src/utils/error-mapping/error-message-mapper.ts` (the `code_args` interpolation and
the two fallback returns).

**Symptom:** a retail user drafting a trade saw the toast

```
Please specify either duration or date_expiry.
```

`date_expiry` is the API's wire identifier for a request field, not English. Reported from a
Lagos/Nigeria geo; the in-thread ask was explicitly "we need to ensure error messages have English
statements too… not `date_expiry`".

**Root cause:** the API's error contract mixes two audiences in fields the client is expected to
render.

1. `error.code_args` is a positional array whose entries the client interpolates into copy, but the
   backend puts **wire field names** in it — `['duration', 'date_expiry']` for `MissingEither`,
   `'take_profit, stop_loss'` for `OrderUpdateNotAllowed`. The client cannot tell a field name from
   a value by position alone; both arrive as plain strings in the same slot.
2. `error.message` is prose written for API consumers (it names request fields the same way), yet it
   is the only text available when `error.subcode` is absent or is a subcode the client has no
   authored template for. The client must either render it verbatim or drop the specifics.

Neither field is marked as display-ready or as machine-only, so a correct client has to guess.

**Fix at the source:** have the API return errors that are either fully display-ready or fully
machine-readable, not a blend:

- **Preferred** — give every rejection a stable `subcode` and put **only values** in `code_args`
  (amounts, bounds, currencies, symbol codes), never field names. A field the message needs to name
  belongs in a separate, structured key (e.g. `details.fields: ['duration', 'date_expiry']`) that
  the client labels itself.
- **Or** — return a display-ready, localized `message` and document it as safe to render, with the
  API-consumer prose moved to a separate developer-facing field.

Either removes the need for any client to keep a parameter-name glossary in step with the backend's
field list.

**Why our code changed anyway:** the client cannot rely on a backend contract change it does not
control, and a message that leaks a wire identifier reaches users on every release until then — so
`mapErrorMessage` sanitizes defensively at the funnel. This finding tracks the source fix so the
glossary can eventually be retired, not a workaround for a defect in code we depend on.
