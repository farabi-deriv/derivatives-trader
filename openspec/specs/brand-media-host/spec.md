# brand-media-host Specification

## Purpose
TBD - created by archiving change migrate-videos-cloudflare-stream-r2. Update Purpose after archive.
## Requirements
### Requirement: [BMH-001] Media host resolver returns the brand-aware media URL

The `@deriv/shared` brand utility SHALL expose a `getMediaUrl()` helper that returns `https://<media_hostname>`, where `media_hostname` is read from `brand.config.json` (`"media.deriv.com"`) and passed through the existing `substituteDerivDomain` routine — mirroring `getDocumentsUrl()`. The primitive `substituteDerivDomain` SHALL remain private; only the named helper is exported. The helper SHALL be exported from the brand barrel (`packages/shared/src/utils/brand/index.ts`) so `@deriv/trader` can import it from `@deriv/shared`.

#### Scenario: Resolves to media.deriv.com on a deriv.com hostname

- **WHEN** the app runs on `dtrader.deriv.com` and `getMediaUrl()` is called
- **THEN** it returns `https://media.deriv.com`

#### Scenario: Substitutes the brand TLD on deriv.be

- **WHEN** the app runs on `dtrader.deriv.be` and `getMediaUrl()` is called
- **THEN** it returns `https://media.deriv.be`

#### Scenario: Substitutes the brand TLD on deriv.me

- **WHEN** the app runs on `dtrader.deriv.me` and `getMediaUrl()` is called
- **THEN** it returns `https://media.deriv.me`

#### Scenario: Returns the unchanged host on an unrecognised hostname

- **WHEN** the app runs on an unrecognised hostname (e.g. `localhost`) and `getMediaUrl()` is called
- **THEN** it returns `https://media.deriv.com` unchanged

