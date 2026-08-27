/**
 * This file created to use in `setupFilesAfterEnv` in jest setup
 * For more info about it  please check the link below
 * https://jestjs.io/docs/configuration#setupfilesafterenv-array
 * */

/** provides a set of custom jest matchers that you can use to extend jest.
 * These will make your tests more declarative, clear to read and to maintain. */
import '@testing-library/jest-dom';

/**
 * jest-extended aims to add additional matchers to Jest's default ones making it easy to test everything raised_hands
 */
import 'jest-extended';

/**
 * Chain Jest matchers together to write easier matchers and reduce code.
 */
import 'jest-chain';

/**
 * Setup Global mocks
 */
import './__mocks__/globals';

/**
 * `__mocks__/translation.mock.js` (mapped onto `@deriv-com/translations` for every package by
 * `jest.config.base.js`) keeps its i18next stub — and the listeners registered on it — in
 * module-level state that outlives a single test. Reset it between tests so a listener left behind
 * by a component that was never unmounted cannot fire in the next test.
 */
import { resetTranslationMock } from './__mocks__/translation.mock';

afterEach(() => resetTranslationMock());
