import fs from 'fs';
import path from 'path';

import * as Components from '../index';
import * as Hooks from '../hooks';

const repo_root = path.resolve(__dirname, '../../../..');
const components_root = path.resolve(__dirname, '../..');
const components_src = path.resolve(__dirname, '..');
const readRepoFile = (relative_path: string) => fs.readFileSync(path.join(repo_root, relative_path), 'utf8');

describe('C8a @deriv/components sweep', () => {
    describe('[DCR-020] dead hooks, components and utilities', () => {
        it('[DCR-020] should have removed the nine dead hooks and their specs', () => {
            [
                'use-deep-effect.ts',
                'use-event-listener.ts',
                'use-interval.ts',
                'use-isomorphic-layout-effect.ts',
                'use-on-scroll.ts',
                'use-prevent-ios-zoom.ts',
                'use-safe-state.ts',
                'use-state-callback.ts',
                'use-device.ts',
                '__tests__/use-device.spec.tsx',
            ].forEach(relative_path =>
                expect(fs.existsSync(path.join(components_src, 'hooks', relative_path))).toBe(false)
            );
        });

        it('[DCR-020] should no longer export any deleted hook from the barrel', () => {
            [
                'useDeepEffect',
                'useEventListener',
                'useInterval',
                'useIsomorphicLayoutEffect',
                'useOnScroll',
                'usePreventIOSZoom',
                'useSafeState',
                'useStateCallback',
                'useDevice',
                'MAX_MOBILE_WIDTH',
            ].forEach(name => expect(Hooks).not.toHaveProperty(name));
        });

        it('[DCR-020] should keep the eight hooks with live callers', () => {
            [
                'useBlockScroll',
                'useConstructor',
                'useCopyToClipboard',
                'useDebounce',
                'useDocumentTitle',
                'useHover',
                'useOnClickOutside',
                'usePrevious',
            ].forEach(name => expect(Hooks).toHaveProperty(name));
        });

        it('[DCR-020] should leave use-onclickoutside importing no deleted module', () => {
            const hook = readRepoFile('packages/components/src/hooks/use-onclickoutside.ts');
            expect(hook).not.toContain('use-event-listener');
            expect(hook).toContain("import { RefObject, useEffect, useLayoutEffect, useRef } from 'react';");
        });

        it('[DCR-020] should have removed inline-message, autosizer and rename.js with their barrel lines', () => {
            ['components/inline-message', 'components/autosizer'].forEach(relative_path =>
                expect(fs.existsSync(path.join(components_src, relative_path))).toBe(false)
            );
            expect(fs.existsSync(path.join(components_root, 'utils/rename.js'))).toBe(false);

            const barrel = readRepoFile('packages/components/src/index.ts');
            expect(barrel).not.toContain('./components/inline-message');
            expect(barrel).not.toContain('./components/autosizer');
            expect(Components).not.toHaveProperty('AutoSizer');
            expect(Components).not.toHaveProperty('InlineMessage');
        });

        it('[DCR-020] should leave AutoSizer consumers importing it straight from react-virtualized', () => {
            ['data-list/data-list.tsx', 'data-table/data-table.tsx'].forEach(relative_path =>
                expect(readRepoFile(`packages/components/src/components/${relative_path}`)).toContain(
                    "} from 'react-virtualized';"
                )
            );
        });

        it('[DCR-020] should have removed the dead inline-message SCSS rules', () => {
            expect(readRepoFile('packages/components/src/components/mobile-dialog/mobile-dialog.scss')).not.toContain(
                '.inline-message__information'
            );
            expect(
                readRepoFile('packages/trader/src/sass/app/_common/components/contract-type-dialog.scss')
            ).not.toContain('.inline-message__information');
        });

        it('[DCR-020] should have removed getEffectiveUnderlying but kept getUnderlyingFromShortcode', () => {
            const helpers = readRepoFile('packages/components/src/utils/contract-helpers.ts');
            expect(helpers).not.toContain('getEffectiveUnderlying');
            expect(helpers).not.toContain('@deprecated');
            expect(helpers).toContain('export const getUnderlyingFromShortcode');
            expect(Components).toHaveProperty('getUnderlyingFromShortcode');
        });

        it('[DCR-020] should have removed the react-drag-drawer shim but kept react-div-100vh', () => {
            expect(fs.existsSync(path.join(components_root, '@types/react-drag-drawer'))).toBe(false);
            expect(fs.existsSync(path.join(components_root, '@types/react-div-100vh'))).toBe(true);

            const tsconfig = readRepoFile('packages/components/tsconfig.json');
            expect(tsconfig).not.toContain('react-drag-drawer');
            expect(tsconfig).toContain('./@types/react-div-100vh/react-div-100vh-config.d.ts');
        });
    });

    describe('[DCR-021] dead statics and type files', () => {
        it('[DCR-021] should leave no dead static assignment', () => {
            expect(readRepoFile('packages/components/src/components/vertical-tab/vertical-tab.tsx')).not.toMatch(
                /VerticalTab\.\w+ =/
            );
            expect(readRepoFile('packages/components/src/components/button/button.tsx')).not.toContain('Button.Group');
            expect(readRepoFile('packages/components/src/components/contract-card/contract-card.tsx')).not.toContain(
                'ContractCard.ContractTypeCell'
            );
        });

        it('[DCR-021] should have removed ButtonGroup and TButtonGroupProps with the static', () => {
            const button = readRepoFile('packages/components/src/components/button/button.tsx');
            expect(button).not.toContain('ButtonGroup');
            expect(button).not.toContain('TButtonGroupProps');
        });

        it('[DCR-021] should keep ContractTypeCell and the ContractCard statics that are rendered', () => {
            expect(
                fs.existsSync(
                    path.join(components_src, 'components/contract-card/contract-card-items/contract-type-cell.tsx')
                )
            ).toBe(true);
            const contract_card = readRepoFile('packages/components/src/components/contract-card/contract-card.tsx');
            ['Header', 'Body', 'Footer', 'Loader', 'MultiplierCloseActions', 'Sell'].forEach(name =>
                expect(contract_card).toContain(`ContractCard.${name} =`)
            );
        });

        it('[DCR-021] should keep only the TItem type import from vertical-tab-header', () => {
            const vertical_tab = readRepoFile('packages/components/src/components/vertical-tab/vertical-tab.tsx');
            expect(vertical_tab).toContain("import { TItem } from './vertical-tab-header';");
            expect(vertical_tab).not.toContain('vertical-tab-layout');
        });

        it('[DCR-021] should have removed the three dead type files and their barrel entries', () => {
            ['icons.types.ts', 'accordion.types.ts', 'multi-step.types.ts'].forEach(relative_path =>
                expect(fs.existsSync(path.join(components_src, 'components/types', relative_path))).toBe(false)
            );
            [
                'TIconsManifest',
                'TIconProps',
                'TAccordionProps',
                'TAccordionItem',
                'TMultiStepProps',
                'TMultiStepRefProps',
                'TErrorMessages',
                'TGenericObjectType',
            ].forEach(name =>
                expect(readRepoFile('packages/components/src/components/types/index.ts')).not.toContain(name)
            );
        });

        it('[DCR-021] should keep the surviving type exports', () => {
            const barrel = readRepoFile('packages/components/src/components/types/index.ts');
            [
                'TPopoverProps',
                'TGetCardLables',
                'TGetContractPath',
                'TToastConfig',
                'TGetContractTypeDisplay',
                'TDatePickerOnChangeEvent',
            ].forEach(name => expect(barrel).toContain(name));
        });
    });

    describe('[DCR-022] the prop surface is pruned to its measured consumers', () => {
        it('[DCR-022] should keep exactly the seven VerticalTab props its two consumers pass', () => {
            const vertical_tab = readRepoFile('packages/components/src/components/vertical-tab/vertical-tab.tsx');
            [
                'current_path',
                'is_floating',
                'is_full_width',
                'is_routed',
                'is_sidebar_enabled',
                'list',
                'setVerticalTabIndex',
            ].forEach(prop => expect(vertical_tab).toContain(prop));
            [
                'action_bar',
                'extra_content',
                'extra_offset',
                'has_mixed_dimensions',
                'header_title',
                'initial_vertical_tab_index',
                'is_collapsible',
                'is_grid',
                'list_groups',
                'onClickClose',
                'tab_headers_note',
                'vertical_tab_index',
            ].forEach(prop => expect(vertical_tab).not.toContain(prop));
        });

        it('[DCR-022] should have deleted each subcomponent whose sole entry point was removed', () => {
            ['vertical-tab-header-group.tsx', 'vertical-tab-header-title.tsx', 'vertical-tab-layout.tsx'].forEach(
                relative_path =>
                    expect(fs.existsSync(path.join(components_src, 'components/vertical-tab', relative_path))).toBe(
                        false
                    )
            );
            expect(
                readRepoFile('packages/components/src/components/vertical-tab/vertical-tab-headers.tsx')
            ).not.toMatch(/vertical-tab-(header-group|header-title|layout)/);
        });

        it('[DCR-022] should keep the props whose only consumer lives in packages/core', () => {
            expect(readRepoFile('packages/components/src/components/input/input.tsx')).toContain('hint');
            expect(readRepoFile('packages/components/src/components/input/input.tsx')).toContain('maxLength');
            expect(readRepoFile('packages/components/src/components/dropdown/dropdown.tsx')).toContain('placeholder');
            expect(readRepoFile('packages/components/src/components/types/popover.types.ts')).toContain(
                'should_disable_pointer_events'
            );
        });

        it('[DCR-022] should keep .dc-dropdown-list in the modal portal-element selector list', () => {
            expect(readRepoFile('packages/components/src/components/modal/modal.tsx')).toContain("'.dc-dropdown-list'");
        });
    });

    describe('[DCR-023] the dependency manifest', () => {
        const manifest = () => JSON.parse(readRepoFile('packages/components/package.json'));

        it('[DCR-023] should declare @deriv/quill-icons and no longer declare the four dead entries', () => {
            expect(manifest().dependencies['@deriv/quill-icons']).toBe('2.4.16');
            ['@deriv/stores', 'dayjs', 'glob', 'gh-pages'].forEach(name =>
                expect(manifest().dependencies).not.toHaveProperty(name)
            );
        });

        it('[DCR-023] should keep the four entries with a live importer', () => {
            ['@types/react-virtualized', 'usehooks-ts', 'react-div-100vh', 'framer-motion'].forEach(name =>
                expect(manifest().dependencies).toHaveProperty(name)
            );
        });
    });

    describe('[DCR-031] stale issue claims are resolved by report, never by substitution', () => {
        it('[DCR-031] should confirm dropdown-list is already absent and no directory replaced it', () => {
            expect(fs.existsSync(path.join(components_src, 'components/dropdown-list'))).toBe(false);
            ['components/dropdown', 'components/filter-dropdown'].forEach(relative_path =>
                expect(fs.existsSync(path.join(components_src, relative_path))).toBe(true)
            );
        });

        it('[DCR-031] should keep triangle-warning.webp, which FullscreenError still renders', () => {
            expect(fs.existsSync(path.join(components_src, 'components/fullscreen-error/triangle-warning.webp'))).toBe(
                true
            );
            expect(
                readRepoFile('packages/components/src/components/fullscreen-error/triangle-warning-icon.tsx')
            ).toContain('triangle-warning.webp');
            expect(readRepoFile('packages/components/src/components/fullscreen-error/fullscreen-error.tsx')).toContain(
                'TriangleWarningIcon'
            );
        });

        it('[DCR-031] should confirm src/utils/helper.js is already absent', () => {
            expect(fs.existsSync(path.join(components_src, 'utils/helper.js'))).toBe(false);
        });

        it("[DCR-031] should leave core's socket_cache.js untouched", () => {
            expect(readRepoFile('packages/core/src/_common/base/socket_cache.js')).toContain('getByMsgType');
        });
    });

    describe('[DCR-032] deletions are proven per symbol, not by a clean knip exit', () => {
        it('[DCR-032] should keep the components internally consumed elsewhere exported', () => {
            [
                'ButtonLink',
                'CircularProgress',
                'CurrencyBadge',
                'FullscreenError',
                'Field',
                'InputWithCheckbox',
                'TickProgress',
                'Tooltip',
            ].forEach(name => expect(Components).toHaveProperty(name));
        });

        it('[DCR-033] should have banked every deleted file in the knip baseline', () => {
            const baseline = readRepoFile('docs/baselines/knip-baseline.json');
            [
                'packages/components/src/hooks/use-device.ts',
                'packages/components/src/components/inline-message/',
                'packages/components/src/components/autosizer/',
                'packages/api/src/utils/file-utils.ts',
                'packages/utils/src/moment.ts',
            ].forEach(deleted_path => expect(baseline).not.toContain(deleted_path));
        });

        it('[DCR-033] should keep both committed baselines present for the CI drift gates', () => {
            ['docs/baselines/knip-baseline.json', 'docs/baselines/alias-usage.json'].forEach(relative_path =>
                expect(fs.existsSync(path.join(repo_root, relative_path))).toBe(true)
            );
        });

        it('[DCR-033] should not rely on the CI Check TypeScript step, which cannot fail', () => {
            const workflow = readRepoFile('.github/workflows/test.yml');
            expect(workflow).toContain('wait');
            expect(
                fs.existsSync(path.join(repo_root, 'docs/spec-to-pr/deferrals/ci-typescript-gate-is-a-no-op.md'))
            ).toBe(true);
        });

        it('[DCR-032] should leave every barrel line pointing at a file that exists', () => {
            const module_paths = readRepoFile('packages/components/src/index.ts')
                .split('\n')
                .filter(line => !line.trim().startsWith('//'))
                .flatMap(line => Array.from(line.matchAll(/from '(\.\/[^']+)'/g)).map(match => match[1]));
            expect(module_paths.length).toBeGreaterThan(0);
            module_paths.forEach(module_path => {
                const resolved = path.join(components_src, module_path);
                const exists =
                    fs.existsSync(resolved) ||
                    ['.ts', '.tsx', '.js', '.jsx'].some(extension => fs.existsSync(`${resolved}${extension}`));
                expect(exists).toBe(true);
            });
        });
    });
});
