import fs from 'fs';
import path from 'path';

import * as ApiUtils from '../utils';

const repo_root = path.resolve(__dirname, '../../../..');
const api_src = path.resolve(__dirname, '..');
const readRepoFile = (relative_path: string) => fs.readFileSync(path.join(repo_root, relative_path), 'utf8');

describe('C8e @deriv/api sweep', () => {
    describe('[DCR-027] dead modules and exports', () => {
        it('[DCR-027] should have removed the constants directory, file-utils and useInfiniteQuery', () => {
            ['constants', 'utils/file-utils.ts', 'utils/__test__/file-utils.spec.ts', 'useInfiniteQuery.ts'].forEach(
                relative_path => expect(fs.existsSync(path.join(api_src, relative_path))).toBe(false)
            );
        });

        it('[DCR-027] should leave no barrel line pointing at a deleted module', () => {
            const utils_barrel = readRepoFile('packages/api/src/utils/index.ts');
            expect(utils_barrel).not.toContain('file-utils');
            expect(utils_barrel).toContain("export * from './query-utils';");
            expect(utils_barrel).toContain("export * from './crypto.utils';");

            const barrel = readRepoFile('packages/api/src/index.ts');
            expect(barrel).not.toContain('useInfiniteQuery');
            expect(barrel).toContain('export { useMutation, useQueries, useQuery };');
        });

        it('[DCR-027] should no longer expose any file-utils export', () => {
            [
                'compressImage',
                'convertToBase64',
                'isSupportedImageFormat',
                'compressImageFile',
                'numToUint8Array',
                'generateChunks',
                'readFile',
            ].forEach(name => expect(ApiUtils).not.toHaveProperty(name));
        });

        it('[DCR-027] should keep the live query and crypto utilities', () => {
            expect(ApiUtils).toHaveProperty('getQueryKeys');
            expect(ApiUtils).toHaveProperty('hashObject');
        });

        it('[DCR-027] should keep the @tanstack/react-query useInfiniteQuery types, a different symbol', () => {
            const types = readRepoFile('packages/api/types.ts');
            expect(types).toContain(
                "import type { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';"
            );
        });

        it('[DCR-027] should have dropped the six unimported dependencies', () => {
            const manifest = JSON.parse(readRepoFile('packages/api/package.json'));
            [
                '@deriv-com/analytics',
                '@deriv-com/ui',
                '@simplewebauthn/typescript-types',
                'dayjs',
                'js-cookie',
                'react-i18next',
            ].forEach(name => expect(manifest.dependencies).not.toHaveProperty(name));
            ['@tanstack/react-query', '@deriv/shared', '@deriv/stores', '@deriv/utils', 'react'].forEach(name =>
                expect(manifest.dependencies).toHaveProperty(name)
            );
        });

        it('[DCR-027] should keep the inert @deriv-com/ui jest moduleNameMapper entry', () => {
            expect(readRepoFile('packages/api/jest.config.js')).toContain("'@deriv-com/ui'");
        });
    });

    describe('[DCR-028] APIProvider connection machinery is preserved', () => {
        const provider = () => readRepoFile('packages/api/src/APIProvider.tsx');

        it('[DCR-028] should keep the WSConnections window augmentation, init and reuse', () => {
            expect(provider()).toContain('WSConnections');
            expect(provider()).toContain('window.WSConnections');
        });

        it('[DCR-028] should keep the subscription hash-dedup registry and its hashObject import', () => {
            expect(provider()).toContain("import { hashObject } from './utils';");
            expect(provider()).toContain('subscriptions');
        });
    });
});
