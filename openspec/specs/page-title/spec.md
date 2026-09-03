# page-title Specification

## Purpose

TBD - created by archiving change favicon-text-does-not-update-automatically-after-changing-the-language. Update Purpose after archive.

## Requirements

### Requirement: Tab title reflects the active route

The application SHALL set the browser tab title from the matched route's title, formatted as `<route title> | <brand name>`, where the brand name is the product's configured brand name. A route that declares no title SHALL leave the tab showing the brand name alone.

#### Scenario: Route with a title

- **WHEN** the user is on the Trade page and the app language is English
- **THEN** the browser tab reads `Trade | Deriv`

#### Scenario: Route without a title

- **WHEN** a matched route declares no title
- **THEN** the browser tab reads `Deriv` with no leading separator

#### Scenario: Navigating between routes

- **WHEN** the user navigates from the Trade page to the Statement page
- **THEN** the browser tab changes from `Trade | Deriv` to `Statement | Deriv` without a page reload

### Requirement: Tab title follows the active language

The tab title SHALL be re-derived from the active language whenever a language change completes, without requiring the user to refresh the page. The title SHALL show the new language's text only once the translations for that language are available — it MUST NOT be left showing the previous language's text, and it MUST NOT show an untranslated fallback once the new translations have loaded.

#### Scenario: Language changed from the trade page

- **WHEN** the user is on the Trade page with the tab reading `Trade | Deriv` and selects a different language from the language selector
- **THEN** the tab title updates to that language's translation of the route title, with no manual page refresh

#### Scenario: Language changed from a reports page

- **WHEN** the user is on the Statement page and changes the language
- **THEN** the tab title updates to that language's translation of the Statement route title, with no manual page refresh

#### Scenario: Translations still loading when the switch starts

- **WHEN** a language change is in progress and the new language's translations have not finished loading
- **THEN** the tab title is not left stale after loading completes: once the new translations become available the tab shows the newly translated route title

#### Scenario: Language change with no route change

- **WHEN** the user changes the language without navigating
- **THEN** the tab title updates in place and the user stays on the same route

#### Scenario: Route title is untranslatable

- **WHEN** the user is on a route whose title is deliberately not localized, such as the internal endpoint page
- **THEN** changing the language leaves that route's tab title unchanged

### Requirement: Nested routes resolve to the innermost title

When a route renders a nested router — as the reports section does — the tab title SHALL come from the innermost matched route, not from its parent.

#### Scenario: A reports sub-page is open

- **WHEN** the user is on the Statement page, which is a sub-route rendered inside the parent Reports route
- **THEN** the tab reads `Statement | Deriv`, not `Reports | Deriv`

#### Scenario: Switching between reports sub-pages

- **WHEN** the user moves from Open positions to Trade table within the reports section
- **THEN** the tab title changes from `Open positions | Deriv` to `Trade table | Deriv`

#### Scenario: Language changed on a nested route

- **WHEN** the user changes the language while on a reports sub-page
- **THEN** the tab shows the sub-page's title in the new language, and the parent section title does not replace it
