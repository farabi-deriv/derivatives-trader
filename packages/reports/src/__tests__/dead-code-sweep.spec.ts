import fs from 'fs';
import path from 'path';

const repo_root = path.resolve(__dirname, '../../../..');
const reports_src = path.resolve(__dirname, '..');
const readRepoFile = (relative_path: string) => fs.readFileSync(path.join(repo_root, relative_path), 'utf8');

describe('C8d @deriv/reports sweep', () => {
    describe('[DCR-024] the binary-link cascade and its route helpers', () => {
        it('[DCR-024] should have removed binary-link, helpers and their specs', () => {
            [
                'Components/Routes/binary-link.tsx',
                'Components/Routes/__tests__/binary-link.spec.tsx',
                'Components/Routes/helpers.ts',
                'Components/Routes/__tests__/helpers.spec.tsx',
            ].forEach(relative_path => expect(fs.existsSync(path.join(reports_src, relative_path))).toBe(false));
        });

        it('[DCR-024] should leave the Routes barrel exporting only the live router', () => {
            const barrel = readRepoFile('packages/reports/src/Components/Routes/index.ts');
            expect(barrel).not.toContain('binary-link');
            expect(barrel).not.toContain('helpers');
            expect(barrel).not.toContain('RouteWithSubRoutes');
            expect(barrel).toContain('export default BinaryRoutes;');
        });

        it('[DCR-024] should keep the live reports router chain intact', () => {
            ['Components/Routes/binary-routes.tsx', 'Components/Routes/route-with-sub-routes.tsx'].forEach(
                relative_path => expect(fs.existsSync(path.join(reports_src, relative_path))).toBe(true)
            );
            expect(readRepoFile('packages/reports/src/Components/Routes/binary-routes.tsx')).toContain(
                "import RouteWithSubRoutes from './route-with-sub-routes';"
            );
            expect(readRepoFile('packages/reports/src/Containers/routes.tsx')).toContain(
                "import BinaryRoutes from 'Components/Routes';"
            );
        });

        it("[DCR-024] should leave core's independently defined BinaryLink alone", () => {
            expect(fs.existsSync(path.join(repo_root, 'packages/core/src/App/Components/Routes/binary-link.tsx'))).toBe(
                true
            );
        });
    });

    describe('[DCR-025] dead types and SCSS', () => {
        const common_prop_types = () => readRepoFile('packages/reports/src/Types/common-prop.type.ts');

        it('[DCR-025] should have deleted the two unreferenced types and de-exported TPassthrough', () => {
            expect(common_prop_types()).not.toContain('TColumnTemplateType');
            expect(common_prop_types()).not.toContain('TSupportedContractType');
            expect(common_prop_types()).not.toContain('getSupportedContracts');
            expect(common_prop_types()).toContain('type TPassthrough = {');
            expect(common_prop_types()).not.toContain('export type TPassthrough');
        });

        it('[DCR-025] should keep every type with a live consumer exported', () => {
            [
                'TBinaryRoutes',
                'TRoute',
                'TRouteConfig',
                'TErrorComponent',
                'TRoutes',
                'TInputDateRange',
                'TColIndex',
                'TCellContentProps',
                'THeaderProps',
                'TUnsupportedContractType',
            ].forEach(name => expect(common_prop_types()).toContain(`export type ${name}`));
        });

        it('[DCR-025] should have removed only the SCSS blocks whose base class no TSX emits', () => {
            expect(readRepoFile('packages/reports/src/sass/app/modules/reports.scss')).not.toMatch(
                /^\.statement-(card|empty) \{/m
            );
            expect(readRepoFile('packages/reports/src/sass/app/modules/portfolio.scss')).not.toMatch(
                /^\.portfolio \{/m
            );
        });

        it('[DCR-025] should keep the dynamically-composed and externally-emitted classes', () => {
            expect(readRepoFile('packages/reports/src/sass/app/_common/components/amount.scss')).toContain('.amount {');
            expect(readRepoFile('packages/reports/src/Constants/data-table-constants.tsx')).toMatch(
                /amount--\$\{getProfitOrLoss\(/
            );
            expect(readRepoFile('packages/reports/src/Components/profit-loss-cell.tsx')).toMatch(
                /amount--\$\{status\}/
            );
            expect(readRepoFile('packages/reports/src/sass/app/modules/portfolio.scss')).toContain(
                '.portfolio-empty {'
            );
            expect(readRepoFile('packages/reports/src/sass/app/_common/layout/trader-layouts.scss')).toContain(
                '.app-contents {'
            );
        });

        it('[DCR-025] should keep reports.scss and composite-calendar.scss, both reached outside app.scss', () => {
            expect(readRepoFile('packages/reports/src/Containers/reports.tsx')).toContain(
                "import 'Sass/app/modules/reports.scss';"
            );
            expect(readRepoFile('packages/reports/src/sass/app/modules/reports.scss')).toContain(
                "@import '../_common/components/composite-calendar';"
            );
        });

        it('[DCR-025] should keep every chart-library rule the grep cannot see', () => {
            const layouts = readRepoFile('packages/reports/src/sass/app/_common/layout/trader-layouts.scss');
            ['.cq-top-ui-widgets', '.sc-toolbar-widget', '.stx-panel-control', '.cq-chart-controls'].forEach(selector =>
                expect(layouts).toContain(selector)
            );
        });

        it('[DCR-025] should leave the statement action-type handling untouched', () => {
            const statement = readRepoFile('packages/reports/src/Containers/statement.tsx');
            ['deposit', 'withdrawal', 'transfer'].forEach(action_type => expect(statement).toContain(action_type));
            expect(readRepoFile('packages/reports/src/Stores/Modules/Statement/Helpers/format-response.ts')).toContain(
                'action_type'
            );
            expect(
                readRepoFile(
                    'packages/reports/src/Components/Elements/Modals/ServicesErrorModal/insufficient-balance-modal.tsx'
                )
            ).toContain('Deposit now');
        });
    });

    describe('[DCR-026] the dependency manifest', () => {
        const manifest = () => JSON.parse(readRepoFile('packages/reports/package.json'));

        it('[DCR-026] should have removed the sixteen unimported dependencies', () => {
            [
                '@deriv/deriv-api',
                'acorn',
                'canvas-toBlob',
                'crc-32',
                'dayjs',
                'extend',
                'formik',
                'framer-motion',
                'i18next',
                'js-cookie',
                'lodash.throttle',
                'object.fromentries',
                'prop-types',
                'react-i18next',
                'react-transition-group',
                'workbox-webpack-plugin',
            ].forEach(name => expect(manifest().dependencies).not.toHaveProperty(name));
        });

        it('[DCR-026] should keep the four entries only a build config references', () => {
            ['null-loader', 'react-dom', 'core-js', '@types/react', '@types/react-dom', 'typescript'].forEach(name =>
                expect(manifest().dependencies).toHaveProperty(name)
            );
            expect(readRepoFile('packages/reports/build/constants.js')).toContain("'null-loader'");
            expect(readRepoFile('packages/reports/build/webpack.config.js')).toContain("'react-dom': 'react-dom'");
            expect(readRepoFile('packages/reports/babel.config.json')).toContain('"corejs": 3');
        });

        it('[DCR-026] should declare the two packages it imports through workspace hoisting', () => {
            expect(manifest().dependencies['@deriv/quill-icons']).toBe('2.4.16');
            expect(manifest().dependencies['@deriv/utils']).toBe('^1.0.0');
            expect(readRepoFile('packages/reports/src/Containers/reports.tsx')).toContain(
                "import { isAllowedRedirectDomain } from '@deriv/utils';"
            );
        });
    });
});
