import fs from 'fs';
import path from 'path';

import * as BrandUtils from '../utils/brand';
import * as BrowserUtils from '../utils/browser';
import * as ConstantsUtils from '../utils/constants';
import * as ObjectUtils from '../utils/object';
import * as RouteUtils from '../utils/route';
import * as UrlUtils from '../utils/url';
import * as ValidationUtils from '../utils/validation';
import * as ValidatorUtils from '../utils/validator';

const repo_root = path.resolve(__dirname, '../../../..');
const shared_src = path.resolve(__dirname, '..');
const readRepoFile = (relative_path: string) => fs.readFileSync(path.join(repo_root, relative_path), 'utf8');

describe('C7 @deriv/shared sweep', () => {
    describe('[DCR-009] dead files and directories', () => {
        const deleted_paths = [
            'utils/object/clone.js',
            'utils/analytics/analytics.ts',
            'loaders',
            'utils/constants/translation-flag.tsx',
            'utils/digital-options',
            'utils/location',
            'utils/validation/regex-validation.ts',
            'utils/constants/error.ts',
        ];

        it('[DCR-009] should have removed every named path', () => {
            deleted_paths.forEach(relative_path =>
                expect(fs.existsSync(path.join(shared_src, relative_path))).toBe(false)
            );
        });

        it('[DCR-009] should leave no barrel line pointing at a deleted module', () => {
            const barrel = readRepoFile('packages/shared/src/index.ts');
            expect(barrel).not.toMatch(/digital-options|utils\/location|analytics\/analytics'/);
            expect(ObjectUtils).not.toHaveProperty('cloneThorough');
            expect(ConstantsUtils).not.toHaveProperty('TranslationFlag');
            expect(ConstantsUtils).not.toHaveProperty('getDefaultError');
            expect(ValidationUtils).not.toHaveProperty('regex_checks');
        });

        it('[DCR-009] should keep the live loader utilities and their barrel lines', () => {
            expect(fs.existsSync(path.join(shared_src, 'utils/loader'))).toBe(true);
            expect(fs.existsSync(path.join(shared_src, 'utils/loader-handler'))).toBe(true);
            const barrel = readRepoFile('packages/shared/src/index.ts');
            expect(barrel).toContain("export * from './utils/loader';");
            expect(barrel).toContain("export * from './utils/loader-handler';");
        });

        it('[DCR-009] should have removed the commented-out TranslationFlag call in core', () => {
            expect(readRepoFile('packages/core/src/App/Components/Routes/language-link.tsx')).not.toContain(
                'TranslationFlag'
            );
        });

        it('[DCR-009] should leave the independent isEuCountry in core alone', () => {
            expect(readRepoFile('packages/core/src/_common/utility.js')).toContain('const isEuCountry');
        });
    });

    describe('[DCR-010] dead exports and de-exports', () => {
        it('[DCR-010] should no longer export the dead object, url, brand, browser and route symbols', () => {
            [
                'filterObjProperties',
                'findValueByKeyRecursively',
                'removeEmptyPropertiesFromObject',
                'removeObjProperties',
            ]
                .concat('isEqualArray')
                .forEach(name => expect(ObjectUtils).not.toHaveProperty(name));

            ['getActionFromUrl', 'getPlatformFromUrl', 'getlangFromUrl', 'isStaging', 'legacyUrlForLanguage']
                .concat('normalizePath')
                .forEach(name => expect(UrlUtils).not.toHaveProperty(name));

            [
                'getApiBaseUrl',
                'getApiUrl',
                'getBrandHostname',
                'getBrandLoginUrl',
                'getBrandLogo',
                'getBrandSignupUrl',
                'getPlatformLogo',
                'getApiCoreUrl',
                'getDomainName',
            ].forEach(name => expect(BrandUtils).not.toHaveProperty(name));

            expect(BrowserUtils).not.toHaveProperty('isSafari');
            expect(RouteUtils).not.toHaveProperty('isRouteVisible');
            expect(ValidatorUtils).not.toHaveProperty('Errors');
            expect(ValidatorUtils).not.toHaveProperty('template');
        });

        it('[DCR-010] should keep the internal callers of the de-exported symbols working', () => {
            expect(BrandUtils.getApiCoreBaseUrl()).toMatch(/^https:\/\/.+/);
            expect(BrandUtils.getBrandUrl()).toMatch(/^https:\/\/.+/);
            expect(BrandUtils.getWhoAmIURL()).toContain('/sessions/whoami');
            expect(BrandUtils.getLogoutURL()).toContain('/self-service/logout/browser');
            expect(BrandUtils.getRedirectHostname()).toBe('');
            expect(BrandUtils.getBrandHomeUrl('fr')).toContain('lang=FR');

            expect(ObjectUtils.isDeepEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);
            expect(ObjectUtils.isDeepEqual([1, [2, 3]], [1, [2, 4]])).toBe(false);
            expect(ObjectUtils.deepFreeze({ a: { b: 1 } })).toEqual({ a: { b: 1 } });

            expect(UrlUtils.getStaticUrl('/terms-and-conditions/')).toMatch(/terms-and-conditions$/);

            expect(BrowserUtils.isSafariBrowser()).toBe(false);
            expect(typeof ValidatorUtils.Validator).toBe('function');
        });
    });

    describe('[DCR-012] dead SCSS constants', () => {
        it('[DCR-012] should have removed the three unused layout variables', () => {
            const layout = readRepoFile('packages/shared/src/styles/constants/layout.scss');
            ['$BORDER_RADIUS_2', '$MOBILE_WRAPPER_HEADER_HEIGHT', '$MOBILE_WRAPPER_FOOTER_HEIGHT'].forEach(name =>
                expect(layout).not.toContain(name)
            );
            expect(layout).toContain('$BORDER_RADIUS: 4px;');
        });

        it('[DCR-012] should keep all eleven mixins, none of which is dead', () => {
            const mixins = readRepoFile('packages/shared/src/styles/mixins.scss');
            [
                'colorIcon',
                'convertTooltipColor',
                'createBarspinnerAnimation',
                'interpolate',
                'pill-segmented-control',
                'rtl',
                'setTypeface',
                'thumbStyle',
                'toEm',
                'tooltipColor',
                'typeface',
            ].forEach(name => expect(mixins).toContain(`@mixin ${name}`));
        });
    });

    describe('[DCR-019] verification artefacts', () => {
        it('[DCR-019] should keep the run-state directory out of git', () => {
            expect(readRepoFile('.gitignore')).toContain('.spec-to-pr/');
        });

        it('[DCR-019] should have banked the deleted files in the knip baseline', () => {
            const baseline = readRepoFile('docs/baselines/knip-baseline.json');
            expect(baseline).not.toContain('packages/shared/src/loaders/');
        });
    });
});
