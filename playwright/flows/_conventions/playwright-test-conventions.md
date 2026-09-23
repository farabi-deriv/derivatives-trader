# Playwright Test Conventions — derivatives-trader

## File Naming

- Spec files: `verify-<feature>-<scenario>.spec.ts`
- Page objects: `<FeatureName>Page.ts`

## Test Tags

Tag every `test.describe` block:

| Tag | Purpose |
| --- | --- |
| `@desktop` / `@mobile` | Platform targeting |
| `@smoke` / `@regression` | Suite classification |
| `@trade` / `@auth` / `@reports` | Module targeting |
| `@production` | Production-only tests |

```typescript
test.describe('Trade Form', { tag: ['@desktop', '@smoke', '@trade'] }, () => {
    // ...
});
```

## Imports

Always import `test` and `expect` from fixtures, not directly from `@playwright/test`:

```typescript
import { test, expect } from '../fixtures/fixtures';
```

## Page Objects

- Use `get` getters for locators (lazy, no async)
- Prefer `getByTestId` over CSS selectors
- Group into `// LOCATORS` and `// ACTIONS` sections

## Test Structure

```typescript
test.describe('Feature', { tag: ['@desktop', '@smoke', '@trade'] }, () => {
    test.beforeEach(async ({ loginPage }) => {
        await loginPage.login();
    });

    test('VERIFY something works', async ({ tradePage }) => {
        // arrange, act, assert
    });
});
```
