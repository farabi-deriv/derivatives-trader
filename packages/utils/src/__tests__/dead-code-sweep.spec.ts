import fs from 'fs';
import path from 'path';

import * as Utils from '../index';

const repo_root = path.resolve(__dirname, '../../../..');
const utils_src = path.resolve(__dirname, '..');
const readRepoFile = (relative_path: string) => fs.readFileSync(path.join(repo_root, relative_path), 'utf8');

describe('C8e @deriv/utils sweep', () => {
    describe('[DCR-029] dead modules and exports', () => {
        it('[DCR-029] should have removed moment.ts and the api-v2-era localStorage helpers', () => {
            [
                'moment.ts',
                'getToken.ts',
                'getAccountsFromLocalStorage.ts',
                'getActiveLoginIDFromLocalStorage.ts',
                '__tests__/moment.spec.ts',
                '__tests__/getToken.spec.ts',
                '__tests__/getAccountsFromLocalStorage.spec.ts',
                '__tests__/getActiveLoginIDFromLocalStorage.spec.ts',
            ].forEach(relative_path => expect(fs.existsSync(path.join(utils_src, relative_path))).toBe(false));
        });

        it('[DCR-029] should no longer export toMoment, getToken or the localStorage account helpers', () => {
            ['toMoment', 'getToken', 'getAccountsFromLocalStorage', 'getActiveLoginIDFromLocalStorage'].forEach(name =>
                expect(Utils).not.toHaveProperty(name)
            );
            expect(readRepoFile('packages/utils/src/index.ts')).not.toMatch(
                /'\.\/(moment|getToken|getAccountsFromLocalStorage|getActiveLoginIDFromLocalStorage)'/
            );
        });

        it('[DCR-029] should keep logError and the live storage and URL helpers exported', () => {
            ['logError', 'safeParse', 'getLocalStorage', 'isExternalLink', 'isAllowedRedirectDomain'].forEach(name =>
                expect(Utils).toHaveProperty(name)
            );
            expect(readRepoFile('packages/utils/src/index.ts')).toContain("export * from './logging';");
        });

        it('[DCR-029] should leave logging.ts intact for the error-monitoring capability', () => {
            const logging = readRepoFile('packages/utils/src/logging.ts');
            expect(logging).toContain("import { Analytics } from '@deriv-com/analytics';");
            expect(logging).toContain('export const logError = (message: string, data: TLogData = {}): void =>');
            expect(logging).toContain("Analytics.trackEvent('log_error'");
        });

        it('[DCR-029] should have dropped the dead dependencies but kept @deriv-com/analytics', () => {
            const manifest = JSON.parse(readRepoFile('packages/utils/package.json'));
            ['bowser', 'dayjs', 'lodash.groupby', 'lodash.pickby'].forEach(name =>
                expect(manifest.dependencies).not.toHaveProperty(name)
            );
            ['@types/lodash.groupby', '@types/lodash.pickby'].forEach(name =>
                expect(manifest.devDependencies).not.toHaveProperty(name)
            );
            expect(manifest.dependencies).toHaveProperty('@deriv-com/analytics');
        });

        it('[DCR-029] should have pruned the root @deriv/utils mock of every deleted symbol', () => {
            const mock = readRepoFile('__mocks__/utils.mock.js');
            ['toMoment', 'getToken', 'getAccountsFromLocalStorage', 'getActiveLoginIDFromLocalStorage', 'Chat'].forEach(
                name => expect(mock).not.toContain(name)
            );
            ['safeParse', 'getLocalStorage', 'isExternalLink'].forEach(name => expect(mock).toContain(name));
        });

        it('[DCR-029] should leave every toMoment consumer importing it from @deriv/shared', () => {
            expect(readRepoFile('packages/shared/src/utils/date/date-time.ts')).toContain('export const toMoment');
            ['packages/core/src/Stores/common-store.js'].forEach(relative_path =>
                expect(readRepoFile(relative_path)).toContain("from '@deriv/shared'")
            );
        });
    });
});
