/**
 * Utils barrel export
 *
 * Re-exports everything from the e2e-tests-core submodule plus project-specific
 * utilities. Import any utility from this single entry point.
 *
 * @example
 * ```typescript
 * import {
 *   NavigationUtils,
 *   MailiskUtils,
 *   DataFactory,
 *   TestData,
 * } from '../utils';
 * ```
 */

export * from '../e2e-tests-core/utils';
export * from './testData';
export * from './manual-trade-negative-matrix';
