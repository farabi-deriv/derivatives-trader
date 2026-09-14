# @deriv/utils

A lightweight utility library providing essential helper functions for account management, storage operations, and common application utilities.

## Overview

The `@deriv/utils` package provides a focused collection of utility functions specifically designed for Deriv applications. It includes essential helpers for localStorage operations, logging, and URL parsing. This package serves as a lightweight alternative to the more comprehensive `@deriv/shared` package, focusing on core utilities needed across multiple applications.

## Key Features

- **Storage Operations**: Safe localStorage access with JSON parsing capabilities
- **Error Logging**: PostHog integration for error tracking and logging
- **URL Parsing**: External link detection and URL validation
- **Type Safety**: Full TypeScript support with proper type definitions

## Architecture

The package follows a simple, functional architecture with individual utility modules:

```
src/
├── index.ts            # Main exports
├── getLocalStorage.ts  # Safe localStorage operations
├── logging.ts          # Error logging with PostHog
└── parse-url.ts        # URL parsing utilities
```

## Usage/Development

### Installation

This package is part of the derivatives-trader monorepo:

```bash
npm run bootstrap
```

### Building

```bash
npm run build
```

### Testing

```bash
npm run test:eslint
```

## Storage Utilities

### safeParse

Safely parses JSON strings with fallback to original string:

```typescript
import { safeParse } from '@deriv/utils';

const data = safeParse('{"key": "value"}');
// Returns: object | string
```

### getLocalStorage (Deprecated)

⚠️ **Deprecated**: Use `LocalStorageUtils.getValue` from `@deriv-com/utils` instead.

```typescript
import { getLocalStorage } from '@deriv/utils';

const value = getLocalStorage('key');
// Returns: any | null
```

## Error Logging

### logError

Reports errors to PostHog via `@deriv-com/analytics` (emits a `log_error` event):

```typescript
import { logError } from '@deriv/utils';

logError('Something went wrong', {
    userId: 'CR1234567',
    action: 'trade_execution',
    additionalData: { symbol: 'EURUSD' },
});
```

## URL Utilities

### isExternalLink

Checks if a URL is external (http, https, or mailto):

```typescript
import { isExternalLink } from '@deriv/utils';

const isExternal = isExternalLink('https://example.com');
// Returns: boolean
```

## Development Guidelines

### Code Organization

- **Single Responsibility**: Each utility module has a focused, single purpose
- **Type Safety**: All functions include proper TypeScript type definitions
- **Error Handling**: Graceful error handling with fallback values
- **Performance**: Lightweight implementations with minimal dependencies

### Dependencies Management

- **Minimal Dependencies**: Only essential external dependencies (`@deriv-com/analytics`)
- **Tree Shaking**: All utilities support tree shaking for optimal bundle sizes
- **No Side Effects**: Pure functions without global state modifications

## Contributing

When contributing to this package:

1. **Maintain Simplicity**: Keep utilities focused and lightweight
2. **Type Safety**: Ensure all functions have proper TypeScript types
3. **Error Handling**: Include appropriate error handling and fallbacks
4. **Documentation**: Add clear JSDoc comments for all public functions
5. **Testing**: Add comprehensive tests for new utilities
