import fs from 'fs';
import path from 'path';

const repo_root = path.resolve(__dirname, '../../../..');
const trader_root = path.resolve(__dirname, '../..');
const trader_src = path.resolve(__dirname, '..');
const readRepoFile = (relative_path: string) => fs.readFileSync(path.join(repo_root, relative_path), 'utf8');
const readTraderFile = (relative_path: string) => fs.readFileSync(path.join(trader_src, relative_path), 'utf8');
const expectGone = (relative_paths: string[]) =>
    relative_paths.forEach(relative_path => expect(fs.existsSync(path.join(trader_src, relative_path))).toBe(false));
const expectPresent = (relative_paths: string[]) =>
    relative_paths.forEach(relative_path => expect(fs.existsSync(path.join(trader_src, relative_path))).toBe(true));

describe('C8c @deriv/trader sweep', () => {
    describe('[DCR-042] the TradeTypes cluster', () => {
        it('[DCR-042] should have removed the cluster, its hook and its icon', () => {
            expectGone([
                'AppV2/Containers/Trade/trade-types.tsx',
                'AppV2/Containers/Trade/trade-types-content.tsx',
                'AppV2/Containers/Trade/__tests__/trade-types.spec.tsx',
                'AppV2/Components/TradeTypesSelector',
                'AppV2/Components/DraggableList',
                'AppV2/Hooks/useIsTradeTypeSelectionRestricted.ts',
                'AppV2/Hooks/__tests__/useIsTradeTypeSelectionRestricted.spec.tsx',
                'Assets/SvgComponents/ic-grid.svg',
            ]);
        });

        it('[DCR-042] should leave the Trade barrel importing only the live container', () => {
            const barrel = readTraderFile('AppV2/Containers/Trade/index.ts');
            expect(barrel).toContain("import Trade from './trade';");
            expect(barrel).not.toMatch(/trade-types/);
            ['AppV2/Containers/Trade/trade-desktop.tsx', 'AppV2/Containers/Trade/trade-mobile.tsx'].forEach(
                relative_path => expect(readTraderFile(relative_path)).not.toMatch(/trade-types'/)
            );
        });

        it('[DCR-042] should have freed react-beautiful-dnd and orphaned pinned_trade_types', () => {
            const manifest = JSON.parse(fs.readFileSync(path.join(trader_root, 'package.json'), 'utf8'));
            expect(Object.keys(manifest.dependencies)).not.toContain('react-beautiful-dnd');
            expect(Object.keys(manifest.devDependencies)).not.toContain('@types/react-beautiful-dnd');
        });

        it('[DCR-042] should keep the two live look-alikes', () => {
            expectPresent([
                'AppV2/Utils/trade-types-utils.tsx',
                'AppV2/Components/TradeParameters/TradeTypeTabs/trade-type-tabs.tsx',
            ]);
        });
    });

    describe('[DCR-043] the trade-categories tree', () => {
        it('[DCR-043] should have removed everything but icon-trade-categories', () => {
            expectGone([
                'Assets/Trading/Categories/Description',
                'Assets/Trading/Categories/trade-categories.tsx',
                'Assets/Trading/Categories/trade-categories-gif.tsx',
                'Assets/Trading/Categories/contract-type-description-video.tsx',
                'Assets/Trading/Categories/__tests__/trade-categories.spec.tsx',
                'Assets/Trading/Categories/__tests__/trade-categories-gif.spec.tsx',
                'Assets/Trading/Categories/__tests__/contract-type-description-video.spec.tsx',
            ]);
        });

        it('[DCR-043] should keep icon-trade-categories importable at its current path', () => {
            expectPresent([
                'Assets/Trading/Categories/icon-trade-categories.tsx',
                'Assets/Trading/Categories/__tests__/icon-trade-categories.spec.tsx',
            ]);
            expect(readTraderFile('AppV2/Components/MarketSelection/market-info-screen.tsx')).toContain(
                "import IconTradeCategory from 'Assets/Trading/Categories/icon-trade-categories';"
            );
        });

        it('[DCR-043] should not have touched the live AppV2 guide tree', () => {
            expectPresent([
                'AppV2/Components/Guide/Description',
                'AppV2/Components/Guide/Description/ContractDescription/multipliers-trade-description.tsx',
            ]);
        });
    });

    describe('[DCR-044] post-redesign orphans and runtime-dead modules', () => {
        it('[DCR-044] should have removed the orphan components and the dead loader', () => {
            expectGone([
                'AppV2/Components/SymbolNotFound',
                'AppV2/Components/SymbolsSearchField',
                'Modules/Contract/Components/AccumulatorsStats',
                'Modules/Contract/Components/InfoBox',
                'Modules/Contract/Components/ContentLoader/trade-params.tsx',
                'AppV2/Components/InputPopover/icons.tsx',
                'AppV2/Components/Layout/PositionsDrawer/index.ts',
                'AppV2/Components/Layout/Sidebar/index.ts',
                'AppV2/Components/TradeParameters/Stake/stake-modal-tabs.tsx',
                'AppV2/Containers/AppShell/index.ts',
                'AppV2/Hooks/useAutoRuns.ts',
                'AppV2/Utils/client.ts',
            ]);
            expect(readTraderFile('Modules/Contract/Components/ContentLoader/index.ts')).not.toMatch(/trade-params/);
        });

        it('[DCR-044] should keep the same-named live AccumulatorStats sibling', () => {
            expectPresent([
                'AppV2/Components/AccumulatorStats/accumulator-stats.tsx',
                'AppV2/Components/AccumulatorStats/accumulator-stats.scss',
            ]);
            expect(readTraderFile('AppV2/Components/AccumulatorStats/accumulator-stats.tsx')).toContain(
                'accumulators-stats-v2'
            );
        });

        it('[DCR-044] should keep positions-card, and therefore react-content-loader', () => {
            expectPresent(['Modules/Contract/Components/ContentLoader/positions-card.tsx']);
            const manifest = JSON.parse(fs.readFileSync(path.join(trader_root, 'package.json'), 'utf8'));
            expect(Object.keys(manifest.dependencies)).toContain('react-content-loader');
        });

        it('[DCR-044] should have removed the InfoBox slot, prop and widget with the tree', () => {
            const top_widgets = readTraderFile('Modules/SmartChart/Components/top-widgets.tsx');
            expect(top_widgets).not.toMatch(/\bInfoBox\b/);
            const replay_widget = readTraderFile('Modules/Contract/Containers/contract-replay-widget.tsx');
            expect(replay_widget).not.toMatch(/\bInfoBox(Widget)?\b/);
            expect(replay_widget).toContain('<TopWidgets is_title_enabled={false} />');
        });

        it('[DCR-044] should keep recent-trade-info, whose guarding branch is reachable', () => {
            expectPresent(['Modules/SmartChart/Components/recent-trade-info.tsx']);
            const top_widgets = readTraderFile('Modules/SmartChart/Components/top-widgets.tsx');
            expect(top_widgets).toContain('{!is_digits_widget_active && <RecentTradeInfo />}');
            expect(
                fs.existsSync(
                    path.join(repo_root, 'docs/spec-to-pr/deferrals/trader-top-widgets-runtime-dead-branch.md')
                )
            ).toBe(true);
        });

        it('[DCR-044] should keep symbol-categories-utils and trade-parameter-presets', () => {
            expect(readTraderFile('AppV2/Utils/symbol-categories-utils.ts')).toContain(
                'export const categorizeSymbols'
            );
            expectPresent(['AppV2/Config/trade-parameter-presets.ts']);
        });

        it('[DCR-044] should have de-exported rather than deleted the internally-live symbols', () => {
            const cases: [string, string][] = [
                ['AppV2/Utils/market-discovery-utils.ts', 'DISCOVERY_SECTION_LIMIT'],
                ['Stores/Modules/Trading/Helpers/contract-template.ts', 'buildContractTemplate'],
                ['Stores/Modules/Trading/Helpers/contract-template.ts', 'validateContractTemplate'],
                ['AppV2/Utils/trading-contract-type-helpers.tsx', 'findContractCategory'],
            ];
            cases.forEach(([relative_path, name]) => {
                const source = readTraderFile(relative_path);
                expect(source).toContain(`const ${name}`);
                expect(source).not.toContain(`export const ${name}`);
            });
        });

        it('[DCR-044] should have removed the fully-dead exports outright', () => {
            expect(readTraderFile('AppV2/Utils/layout-utils.tsx')).not.toMatch(/\bASPECT_RATIO\b/);
            expect(readTraderFile('AppV2/Utils/trading-contract-type-helpers.tsx')).not.toMatch(
                /\bisMajorPairsSymbol\b/
            );
            expect(readTraderFile('AppV2/Utils/video-config.ts')).not.toMatch(
                /\bgetAutomationOnboardingVideoId\b|\bAUTOMATION_ONBOARDING_VIDEO_ID\b/
            );
            const trading_times = readTraderFile('AppV2/Utils/trading-times-utils.ts');
            expect(trading_times).not.toMatch(/\bgetTradingSessions\b|\bformatTradingSession\b/);
            expect(trading_times).toContain('export const formatTradingTimeRange');
            const smart_chart = readTraderFile('Modules/SmartChart/index.js');
            expect(smart_chart).not.toMatch(/\bChartSize\b|\bRawMarker\b/);
            expect(smart_chart).toContain('SmartChart,');
        });
    });

    describe('[DCR-045] the static directory and its alias map', () => {
        it('[DCR-045] should have removed src/public in full', () => {
            expectGone(['public']);
        });

        it('[DCR-045] should have removed the three alias entries from tsconfig only', () => {
            const tsconfig = JSON.parse(fs.readFileSync(path.join(trader_root, 'tsconfig.json'), 'utf8'));
            const paths = tsconfig.compilerOptions.paths;
            ['Fonts/*', 'Images', 'Translations/*'].forEach(alias => expect(Object.keys(paths)).not.toContain(alias));
            ['AppV2/*', 'Modules/*', 'Stores/*', '_common/*'].forEach(alias =>
                expect(Object.keys(paths)).toContain(alias)
            );

            const constants = fs.readFileSync(path.join(trader_root, 'build/constants.js'), 'utf8');
            expect(constants).not.toMatch(/^\s+(Fonts|Images|Translations): /m);
            const knip = JSON.parse(readRepoFile('knip.json'));
            expect(knip.workspaces['packages/trader']).not.toHaveProperty('paths');
        });

        it('[DCR-045] should leave the trader alias root set unmoved', () => {
            const alias_usage = JSON.parse(readRepoFile('docs/baselines/alias-usage.json'));
            expect(alias_usage.roots.trader).toEqual([
                'AppV2',
                'Assets',
                'Modules',
                'Sass',
                'Stores',
                'Types',
                '_common',
            ]);
        });
    });

    describe('[DCR-046] dead build configuration', () => {
        const buildFile = (relative_path: string) => fs.readFileSync(path.join(trader_root, relative_path), 'utf8');

        it('[DCR-046] should have removed helpers.js and its commented-out require', () => {
            expect(fs.existsSync(path.join(trader_root, 'build/helpers.js'))).toBe(false);
            expect(buildFile('build/config.js')).not.toMatch(/transformContentUrlBase|\.\/helpers/);
        });

        it('[DCR-046] should have removed generateSWConfig and htmlOutputConfig with their call sites', () => {
            const config = buildFile('build/config.js');
            ['generateSWConfig', 'htmlOutputConfig'].forEach(name =>
                expect(config).not.toMatch(new RegExp(`\\b${name}\\b`))
            );
            expect(config).toContain('cssConfig');
            expect(config).toContain('stylelintConfig');

            const constants = buildFile('build/constants.js');
            ['htmlOutputConfig', 'htmlInjectConfig', 'HtmlWebPackPlugin', 'HtmlWebpackTagsPlugin'].forEach(name =>
                expect(constants).not.toMatch(new RegExp(`\\b${name}\\b`))
            );
        });

        it('[DCR-046] should have removed the eslint-loader block but kept every other is_test_env use', () => {
            const constants = buildFile('build/constants.js');
            expect(constants).not.toContain('eslint-loader');
            expect(constants).toContain('const rules = (is_test_env = false) => [');
            expect(constants).toContain('const plugins = (base, is_test_env) => [');
        });

        it('[DCR-046] should have removed .eslintrc.ts and the uploader shim, keeping the jest-dom import', () => {
            expect(fs.existsSync(path.join(trader_root, '.eslintrc.ts'))).toBe(false);
            expect(fs.existsSync(path.join(trader_root, '.eslintrc.js'))).toBe(true);
            const index_d_ts = buildFile('index.d.ts');
            expect(index_d_ts).toContain("import '@testing-library/jest-dom';");
            expect(index_d_ts).not.toContain('binary-document-uploader');
            const tsconfig = JSON.parse(buildFile('tsconfig.json'));
            expect(tsconfig.include).toContain('./index.d.ts');
        });
    });

    describe('[DCR-047] the dependency manifest', () => {
        const manifest = () => JSON.parse(fs.readFileSync(path.join(trader_root, 'package.json'), 'utf8'));

        it('[DCR-047] should have removed the six dead dependencies and the dnd types', () => {
            const { dependencies, devDependencies } = manifest();
            [
                '@deriv-com/quill-tokens',
                '@deriv/deriv-api',
                'formik',
                'mobx-utils',
                'prop-types',
                'react-beautiful-dnd',
            ].forEach(name => expect(Object.keys(dependencies)).not.toContain(name));
            expect(Object.keys(devDependencies)).not.toContain('@types/react-beautiful-dnd');
        });

        it('[DCR-047] should move null-loader rather than remove it', () => {
            const { dependencies, devDependencies } = manifest();
            expect(Object.keys(devDependencies)).toContain('null-loader');
            expect(Object.keys(dependencies)).not.toContain('null-loader');
            expect(fs.readFileSync(path.join(trader_root, 'build/constants.js'), 'utf8')).toContain('null-loader');
        });

        it('[DCR-047] should keep the seven dependencies with live importers', () => {
            const { dependencies } = manifest();
            [
                '@deriv-com/analytics',
                'extend',
                'framer-motion',
                'lodash.debounce',
                'react-content-loader',
                'dayjs',
                'clsx',
            ].forEach(name => expect(Object.keys(dependencies)).toContain(name));
        });
    });

    describe('[DCR-048] trader SCSS', () => {
        it('[DCR-048] should have removed the fully-dead and never-imported partials', () => {
            expectGone([
                'sass/app/_common/components/contract-type-info.scss',
                'sass/app/_common/components/contract-type-widget.scss',
                'sass/app/_common/components/contract-type-list.scss',
                'sass/app/_common/components/contract-type-no-result.scss',
                'sass/app/_common/components/range-slider.scss',
                'sass/app/_common/form/time-picker.scss',
                'sass/app/modules/trading-mobile.scss',
                'sass/app/_common/mobile-widget.scss',
                'sass/app/_common/components/positions-toggle.scss',
            ]);
        });

        it('[DCR-048] should have removed each @import in the same commit as its partial', () => {
            const app_scss = readTraderFile('sass/app.scss');
            [
                'contract-type-info',
                'contract-type-widget',
                'contract-type-list',
                'contract-type-no-result',
                'range-slider',
                'time-picker',
            ].forEach(name => expect(app_scss).not.toContain(name));
            expect(app_scss).toContain("@import 'app/modules/trading';");
            expect(app_scss).toContain("@import 'app/_common/components/purchase-button';");
        });

        it('[DCR-048] should have removed contract.scss with the InfoBox tree it styled', () => {
            expectGone(['sass/app/modules/contract.scss']);
            expect(readTraderFile('sass/app.scss')).not.toContain("@import 'app/modules/contract';");
            expect(readTraderFile('sass/app/_common/layout/trader-layouts.scss')).not.toContain('info-box');
        });

        it('[DCR-048] should keep .trade-container, which contract-replay still renders', () => {
            expect(readTraderFile('Modules/Contract/Containers/contract-replay.tsx')).toContain(
                "className='trade-container__replay'"
            );
            expect(readTraderFile('sass/app/_common/layout/trader-layouts.scss')).toContain('&__replay');
            expect(readTraderFile('sass/app/modules/trading.scss')).toContain('.trade-container {');
        });

        it('[DCR-048] should keep every chart-library rule, deleting no cq-/stx-/sc-/ciq- selector', () => {
            const accumulators = readTraderFile('sass/app/modules/contract/accumulators-stats.scss');
            expect(accumulators).toContain('.cq-bottom-ui-widgets');
            expect(accumulators).not.toMatch(/^\.accumulators-stats \{/m);
            expect(readTraderFile('sass/app/_common/layout/trader-layouts.scss')).toContain('.cq-bottom-ui-widgets');
        });

        it('[DCR-048] should keep the keyframes smart-chart.scss still animates', () => {
            expect(readTraderFile('sass/app/modules/contract/accumulators-stats.scss')).toContain(
                '@keyframes spot-emphasizer'
            );
            expect(readTraderFile('sass/app/modules/smart-chart.scss')).toContain('animation: 0.5s spot-emphasizer');
        });

        it('[DCR-048] should keep the live AppV2 purchase-button file and the produced btn-purchase rules', () => {
            expectPresent([
                'AppV2/Components/PurchaseButton/purchase-button.scss',
                'sass/app/_common/components/purchase-button.scss',
            ]);
            const legacy = readTraderFile('sass/app/_common/components/purchase-button.scss');
            ['&--swoosh', '&--disabled'].forEach(selector => expect(legacy).toContain(selector));
            expect(legacy).not.toMatch(/&--turbos|&--multiplier|&__info--left/);
        });
    });

    describe('[DCR-049] the verified-live KEEP set (trader half)', () => {
        it('[DCR-049] should keep the regulatory purchase-button gating', () => {
            const purchase_button = readTraderFile('AppV2/Components/PurchaseButton/purchase-button.tsx');
            expect(purchase_button).toContain("import { useRiskDisclosure } from 'AppV2/Hooks/useRiskDisclosure';");
            expect(purchase_button).toContain('useRiskDisclosure()');
        });

        it('[DCR-049] should keep the insufficient-balance Deposit now redirect', () => {
            expect(readTraderFile('AppV2/Components/ServiceErrorSheet/service-error-sheet.tsx')).toContain(
                "i18n_default_text='Deposit now'"
            );
        });

        it('[DCR-049] should keep the four commission copy sites', () => {
            expect(readTraderFile('AppV2/Utils/contract-description-utils.tsx')).toContain(
                'including additional commissions if any'
            );
            const multipliers = readTraderFile(
                'AppV2/Components/Guide/Description/ContractDescription/multipliers-trade-description.tsx'
            );
            expect(multipliers).toContain('A fixed commission is charged');
            expect(multipliers).toContain('× stake) − commission.');
            [
                'AppV2/Components/TradeParameters/PayoutPerPoint/payout-per-point.scss',
                'AppV2/Components/TradeParameters/Strike/strike.scss',
                'AppV2/Components/TradeParameters/GrowthRate/growth-rate.scss',
            ].forEach(relative_path => expect(readTraderFile(relative_path)).toContain('commission'));
        });
    });

    describe('[DCR-050] the sweep is not shipped part-ticked', () => {
        it('[DCR-050] should file every deferral under docs/spec-to-pr/deferrals/', () => {
            [
                'core-language-link-guarded-by-shared-spec.md',
                'core-front-channel-oidc-registration.md',
                'core-migration-onboarding-orphan-images.md',
                'core-missing-notification-banner-images.md',
                'trader-top-widgets-runtime-dead-branch.md',
                'trader-contract-type-dialog-scss-guarded-by-components-spec.md',
                'trader-spec-only-exports-and-type-aliases.md',
            ].forEach(name =>
                expect(fs.existsSync(path.join(repo_root, 'docs/spec-to-pr/deferrals', name))).toBe(true)
            );
        });
    });

    describe('[DCR-051] verification artefacts', () => {
        it('[DCR-051] should have banked the deleted trader files in the knip baseline', () => {
            const baseline = readRepoFile('docs/baselines/knip-baseline.json');
            [
                'packages/trader/src/AppV2/Components/SymbolNotFound/',
                'packages/trader/src/AppV2/Hooks/useAutoRuns.ts',
                'packages/trader/src/Modules/Contract/Components/AccumulatorsStats/',
                'packages/trader/package.json react-beautiful-dnd',
            ].forEach(entry => expect(baseline).not.toContain(entry));
        });
    });

    describe('[DCR-052] the guard specs', () => {
        it('[DCR-052] should add a guard spec to both swept packages', () => {
            [
                'packages/core/src/__tests__/dead-code-sweep.spec.ts',
                'packages/trader/src/__tests__/dead-code-sweep.spec.ts',
            ].forEach(relative_path => expect(fs.existsSync(path.join(repo_root, relative_path))).toBe(true));
        });

        it('[DCR-052] should leave the packages/shared guard spec unmodified', () => {
            expect(readRepoFile('packages/shared/src/__tests__/dead-code-sweep.spec.ts')).toContain(
                "describe('C7 @deriv/shared sweep'"
            );
        });
    });
});
