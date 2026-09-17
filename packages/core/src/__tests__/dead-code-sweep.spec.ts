import fs from 'fs';
import path from 'path';

const repo_root = path.resolve(__dirname, '../../../..');
const core_root = path.resolve(__dirname, '../..');
const core_src = path.resolve(__dirname, '..');
const readRepoFile = (relative_path: string) => fs.readFileSync(path.join(repo_root, relative_path), 'utf8');
const readCoreFile = (relative_path: string) => fs.readFileSync(path.join(core_src, relative_path), 'utf8');
const expectGone = (relative_paths: string[]) =>
    relative_paths.forEach(relative_path => expect(fs.existsSync(path.join(core_src, relative_path))).toBe(false));
const expectPresent = (relative_paths: string[]) =>
    relative_paths.forEach(relative_path => expect(fs.existsSync(path.join(core_src, relative_path))).toBe(true));

const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
    });

describe('C8b @deriv/core sweep', () => {
    describe('[DCR-034] the unreachable notification and layout clusters', () => {
        it('[DCR-034] should have removed the whole notification chain', () => {
            expectGone([
                'App/Containers/Layout/header/show-notifications.tsx',
                'App/Containers/Layout/header/__tests__/show-notifications.spec.tsx',
                'App/Components/Layout/Header/toggle-notifications.jsx',
                'App/Containers/NotificationsDialog',
            ]);
        });

        it('[DCR-034] should leave no barrel line pointing at the notification chain', () => {
            expect(readCoreFile('App/Containers/Layout/header/index.ts')).not.toMatch(/ShowNotifications/);
            expect(readCoreFile('App/Components/Layout/Header/index.js')).not.toMatch(/ToggleNotifications/);
            expect(readCoreFile('App/Containers/Layout/header/header-legacy.tsx')).not.toMatch(
                /ShowNotifications|NotificationsDialog/
            );
        });

        it('[DCR-034] should reduce the Footer to the live NetworkStatus export', () => {
            expectGone([
                'App/Components/Layout/Footer/account-limits.jsx',
                'App/Components/Layout/Footer/endpoint-note.jsx',
                'App/Components/Layout/Footer/help-centre.jsx',
                'App/Components/Layout/Footer/responsible-trading.jsx',
                'App/Components/Layout/Footer/toggle-settings.jsx',
                'App/Components/Layout/Footer/__tests__/help-centre.spec.jsx',
                'App/Components/Layout/Footer/__tests__/toggle-settings.spec.tsx',
            ]);
            expectPresent(['App/Components/Layout/Footer/network-status.tsx']);
            const barrel = readCoreFile('App/Components/Layout/Footer/index.js');
            expect(barrel).toContain('export default NetworkStatus;');
            expect(barrel).not.toMatch(/account-limits|endpoint-note|help-centre|responsible-trading|toggle-settings/);
        });

        it('[DCR-034] should have removed dev-tools and LogoutSuccessModal while keeping Devtools.tsx', () => {
            expectGone(['App/Components/dev-tools', 'App/Containers/Modals/LogoutSuccessModal']);
            expectPresent(['App/Devtools.tsx']);
            expect(readCoreFile('App/Containers/Modals/app-modals.jsx')).not.toMatch(/LogoutSuccessModal/);
        });

        it('[DCR-034] should have removed the Elements orphans and their barrel lines', () => {
            expectGone([
                'App/Components/Elements/Media',
                'App/Components/Elements/NotificationMessage/notification-order.jsx',
                'App/Components/Layout/Header/account-info-icon.tsx',
                'App/Components/Layout/Header/__tests__/account-info-icon.spec.tsx',
                'App/Components/Layout/Header/Components/ToggleMenu/menu-title.tsx',
                'App/Components/Layout/Header/Components/Preloader/header-items.jsx',
                'App/Containers/server-time.jsx',
                'templates/app/components/loading.jsx',
                'templates/_common/components/loading.jsx',
            ]);
            expect(readCoreFile('App/Components/Elements/NotificationMessage/index.js')).not.toMatch(
                /notification-order/
            );
            expect(readCoreFile('App/Components/Layout/Header/Components/ToggleMenu/index.ts')).not.toMatch(
                /MenuTitle|menu-title/
            );
            expect(readCoreFile('App/Components/Layout/Header/Components/Preloader/index.js')).not.toMatch(
                /header-items/
            );
            expectPresent(['templates/app/manifest.json']);
        });

        it('[DCR-034] should confirm LiveChat was already absent, with nothing substituted for it', () => {
            const live_chat_files = walk(core_src).filter(file => /live-?chat/i.test(path.basename(file)));
            expect(live_chat_files).toEqual([]);
        });
    });

    describe('[DCR-035] the cookie banner', () => {
        it('[DCR-035] should have removed the component, the partial and its @import', () => {
            expectGone(['App/Components/Elements/CookieBanner', 'sass/app/_common/components/cookie-banner.scss']);
            expect(readCoreFile('sass/app.scss')).not.toMatch(/cookie-banner/);
        });

        it('[DCR-035] should leave no banner residue in app-contents, and no disabled placeholder', () => {
            expect(readCoreFile('App/Containers/Layout/app-contents.jsx')).not.toMatch(
                /cookie.?banner|TRACKING_STATUS_KEY|show_cookie_banner|is_gtm_tracking/i
            );
        });
    });

    describe('[DCR-036] the routes machinery', () => {
        it('[DCR-036] should have dropped the dead helpers, keeping the two that binary-link consumes', () => {
            const helpers = readCoreFile('App/Components/Routes/helpers.ts');
            expect(helpers).toContain('export const normalizePath');
            expect(helpers).toContain('export const findRouteByPath');
            ['isRouteVisible', 'getPath', 'getContractPath'].forEach(name =>
                expect(helpers).not.toMatch(new RegExp(`\\b${name}\\b`))
            );
        });

        it('[DCR-036] should leave the barrel exporting only BinaryLink and the live router', () => {
            const barrel = readCoreFile('App/Components/Routes/index.js');
            expect(barrel).toContain('export { BinaryLink };');
            expect(barrel).toContain('export default BinaryRoutes;');
            expect(barrel).not.toMatch(/LanguageLink|RouteWithSubRoutes|helpers/);
        });

        it('[DCR-036] should keep BinaryLink, its consumers and the live router chain', () => {
            expectPresent([
                'App/Components/Routes/binary-link.tsx',
                'App/Components/Routes/binary-routes.jsx',
                'App/Components/Routes/route-with-sub-routes.jsx',
            ]);
            expect(readCoreFile('App/Components/Layout/Header/menu-link.tsx')).toContain(
                "import { BinaryLink } from 'App/Components/Routes';"
            );
            expect(readCoreFile('App/Components/Elements/NotificationMessage/notification.jsx')).toContain(
                "import { BinaryLink } from '../../Routes';"
            );
        });

        it('[DCR-036] should keep language-link.tsx, which a packages/shared spec reads by path', () => {
            expectPresent(['App/Components/Routes/language-link.tsx']);
            expect(readRepoFile('packages/shared/src/__tests__/dead-code-sweep.spec.ts')).toContain(
                'packages/core/src/App/Components/Routes/language-link.tsx'
            );
        });

        it('[DCR-036] should have removed the account-closed regex and the news notification branch', () => {
            expect(readCoreFile('App/Components/Routes/binary-routes.jsx')).not.toMatch(/account-closed/);
            const notification = readCoreFile('App/Components/Elements/NotificationMessage/notification.jsx');
            expect(notification).not.toMatch(/case 'news'/);
            expect(notification).toMatch(/case 'trustpilot'/);
        });
    });

    describe('[DCR-037] _common legacy and the live socket surface', () => {
        it('[DCR-037] should have removed _common/lib and the two empty base files', () => {
            expectGone(['_common/lib', '_common/base/client_base.js', '_common/base/currency_base.js']);
        });

        it('[DCR-037] should leave utility.js exporting exactly getStaticHash and isEuCountry', () => {
            const utility = readCoreFile('_common/utility.js');
            ['getStaticHash', 'isEuCountry'].forEach(name => expect(utility).toContain(name));
            expect(utility).toContain('const isEuCountry');
            ['createElement', 'isSyntheticsUnavailable', 'countries_without_synthetics'].forEach(name =>
                expect(utility).not.toMatch(new RegExp(`\\b${name}\\b`))
            );
        });

        it('[DCR-037] should keep the duck-typed socket_cache method untouched', () => {
            const socket_cache = readCoreFile('_common/base/socket_cache.js');
            expect(socket_cache).toContain('getByMsgType');
        });

        it('[DCR-037] should keep sendKeepAlive and waitForAuth exported', () => {
            const socket_base = readCoreFile('_common/base/socket_base.js');
            expect(socket_base).toContain('const sendKeepAlive');
            expect(socket_base).toContain('const waitForAuth');
            expect(socket_base).toMatch(/^\s+sendKeepAlive,$/m);
            expect(socket_base).toMatch(/^\s+waitForAuth,$/m);
            expect(readCoreFile('_common/base/network_monitor_base.js')).toContain('sendKeepAlive');
        });

        it('[DCR-037] should have removed only the proven-dead socket_base exports', () => {
            const socket_base = readCoreFile('_common/base/socket_base.js');
            ['blockRequest', 'removeOnDisconnect'].forEach(name =>
                expect(socket_base).not.toMatch(new RegExp(`\\b${name}\\b`))
            );
            expect(socket_base).not.toMatch(/getSocket:/);
            expect(socket_base).toContain('setOnDisconnect:');
        });
    });

    describe('[DCR-038] dead Services, Utils and Constants exports', () => {
        it('[DCR-038] should have removed requestLogout and its spec, keeping requestRestLogout', () => {
            expectGone(['Services/__tests__/logout.spec.js']);
            const logout = readCoreFile('Services/logout.js');
            expect(logout).toContain('export const requestRestLogout');
            ['requestLogout', 'doLogout'].forEach(name => expect(logout).not.toMatch(new RegExp(`\\b${name}\\b`)));
            expect(readCoreFile('Stores/client-store.js')).toContain('requestRestLogout');
        });

        it('[DCR-038] should de-export authorizeAccount while keeping its implementation and caller', () => {
            const socket_general = readCoreFile('Services/socket-general.js');
            expect(socket_general).toContain('const authorizeAccount = response =>');
            expect(socket_general).toContain('authorizeAccount(response);');
            expect(socket_general).not.toMatch(/^\s+authorizeAccount,$/m);
        });

        it('[DCR-038] should have removed the PWA unregister export, keeping register', () => {
            const register = readCoreFile('Utils/PWA/register-service-worker.ts');
            expect(register).toContain('export default function register()');
            expect(register).not.toMatch(/\bunregister\b/);
            expect(readCoreFile('Utils/PWA/index.ts')).not.toMatch(/\bunregister\b/);
        });

        it('[DCR-038] should have removed Constants/currency.js, whose barrel line never existed', () => {
            expectGone(['Constants/currency.js']);
            expect(readCoreFile('Constants/index.js').trim()).toBe("export * from './ui';");
        });
    });

    describe('[DCR-039] orphan assets and the stale alias map', () => {
        it('[DCR-039] should have removed the orphaned fonts, images and SVGs', () => {
            expectGone([
                'public/fonts',
                'public/images/common/static_images/presets-onboarding',
                'public/images/common/plus.svg',
                'Assets/SvgComponents/footer',
                'Assets/SvgComponents/settings/ic-api-token.svg',
                'Assets/SvgComponents/settings/img-theme-dark.svg',
                'Assets/SvgComponents/settings/dark',
            ]);
        });

        it('[DCR-039] should keep the assets that are read at runtime or by a trader spec', () => {
            expectPresent([
                'public/videos',
                'public/images/common/static_images/404.png',
                'public/images/common/static_images/no-market-found.webp',
                'root_files/front-channel.html',
            ]);
        });

        it('[DCR-039] should retire Fonts and Translations from both declarations, keeping Images', () => {
            const constants = fs.readFileSync(path.join(core_root, 'build/constants.js'), 'utf8');
            expect(constants).toMatch(/^\s+Images: /m);
            expect(constants).not.toMatch(/^\s+(Fonts|Translations): /m);

            const knip = JSON.parse(readRepoFile('knip.json'));
            const paths = knip.workspaces['packages/core'].paths;
            expect(Object.keys(paths)).toContain('Images');
            expect(Object.keys(paths)).toContain('Images/*');
            expect(Object.keys(paths)).not.toContain('Fonts/*');
            expect(Object.keys(paths)).not.toContain('Translations/*');
        });
    });

    describe('[DCR-040] the dependency manifest', () => {
        const manifest = () => JSON.parse(fs.readFileSync(path.join(core_root, 'package.json'), 'utf8'));

        it('[DCR-040] should have removed every measured-dead runtime dependency', () => {
            const { dependencies, devDependencies } = manifest();
            [
                '@deriv-com/quill-tokens',
                '@simplewebauthn/browser',
                'acorn',
                'canvas-toBlob',
                'crc-32',
                'framer-motion',
                'i18next',
                'loadjs',
                'lodash.debounce',
                'object.fromentries',
                'postcss-rtlcss',
                'react-i18next',
                'react-tiny-popover',
                'react-window',
                'usehooks-ts',
            ].forEach(name => {
                expect(Object.keys(dependencies)).not.toContain(name);
                expect(Object.keys(devDependencies)).not.toContain(name);
            });
        });

        it('[DCR-040] should move the two build-config-only dependencies rather than delete them', () => {
            const { dependencies, devDependencies } = manifest();
            ['null-loader', 'dotenv-webpack'].forEach(name => {
                expect(Object.keys(devDependencies)).toContain(name);
                expect(Object.keys(dependencies)).not.toContain(name);
            });
        });

        it('[DCR-040] should keep the four entries a source-only grep misses', () => {
            const { dependencies } = manifest();
            ['@deriv/trader', '@deriv/reports', 'core-js', 'react-dom'].forEach(name =>
                expect(Object.keys(dependencies)).toContain(name)
            );
        });
    });

    describe('[DCR-041] core SCSS', () => {
        it('[DCR-041] should have removed the dead partials', () => {
            expectGone([
                'sass/app/_common/components/account-common.scss',
                'sass/app/_common/components/media-item.scss',
                'sass/app/_common/components/settings-language.scss',
                'sass/app/_common/components/theme-select.scss',
                'sass/app/modules/notifications-dialog.scss',
                'sass/app/modules/reset-email.scss',
                'sass/app/modules/settings.scss',
                'sass/app/modules/account-types.scss',
                'sass/app/modules/account-signup.scss',
                'sass/app/modules/complaints-policy.scss',
                'sass/app/modules/set-residence.scss',
                'sass/app/modules/set-citizenship.scss',
            ]);
        });

        it('[DCR-041] should have removed each @import in the same commit as its partial', () => {
            const app_scss = readCoreFile('sass/app.scss');
            ['account-common', 'media-item', 'reset-email'].forEach(name => expect(app_scss).not.toContain(name));
            expect(app_scss).toContain("@import 'app/modules/reset-password';");
            expect(app_scss).toContain("@import 'app/_common/components/side-menu';");
        });

        it('[DCR-041] should keep every .reset-password rule RedirectToLoginModal reaches', () => {
            const reset_password = readCoreFile('sass/app/modules/reset-password.scss');
            ['&__password-selection', '&__heading', '&__subtext'].forEach(selector =>
                expect(reset_password).toContain(selector)
            );
            const modal = readCoreFile('App/Containers/Modals/RedirectToLoginModal/redirect-to-login-modal.jsx');
            ['reset-password__password-selection', 'reset-password__heading', 'reset-password__subtext'].forEach(
                class_name => expect(modal).toContain(class_name)
            );
        });

        it('[DCR-041] should keep the side-menu override that restyles the live VerticalTab', () => {
            const side_menu = readCoreFile('sass/app/_common/components/side-menu.scss');
            expect(side_menu).toContain('.dc-vertical-tab__tab .dc-vertical-tab__header');
            expect(side_menu).not.toMatch(/^\.side-menu \{/m);
            expect(readRepoFile('packages/reports/src/Containers/reports.tsx')).toContain('<VerticalTab');
        });

        it('[DCR-041] should keep the partials a component imports directly', () => {
            expectPresent([
                'sass/app/_common/components/account-switcher.scss',
                'sass/app/_common/components/app-notification-message.scss',
                'sass/app/_common/components/app-toast-message.scss',
            ]);
        });
    });

    describe('[DCR-049] the verified-live KEEP set (core half)', () => {
        it('[DCR-049] should leave every named core KEEP member present', () => {
            expectPresent([
                '_common/base/socket_cache.js',
                '_common/base/socket_base.js',
                'App/Components/Routes/binary-link.tsx',
                'App/Components/Routes/language-link.tsx',
                'root_files/front-channel.html',
            ]);
        });

        it('[DCR-049] should leave the account-status trade gating and login redirects alone', () => {
            expect(readCoreFile('App/initStore.js')).toContain("status === 'trading_disabled'");
            expect(readCoreFile('App/Components/Layout/Header/account-switcher.tsx')).toContain(
                "account.status === 'trading_disabled'"
            );
            expect(readCoreFile('App/Components/Layout/Header/login-button.tsx')).toContain('redirectToLogin');
        });
    });

    describe('[DCR-051] verification artefacts', () => {
        it('[DCR-051] should have banked the deleted core files in the knip baseline', () => {
            const baseline = readRepoFile('docs/baselines/knip-baseline.json');
            ['packages/core/src/_common/lib/', 'packages/core/src/Constants/currency.js'].forEach(entry =>
                expect(baseline).not.toContain(entry)
            );
        });

        it('[DCR-051] should record the removed alias roots in the committed alias baseline', () => {
            const alias_usage = JSON.parse(readRepoFile('docs/baselines/alias-usage.json'));
            expect(alias_usage.roots.core).toContain('Images');
            expect(alias_usage.roots.core).not.toContain('Fonts');
            expect(alias_usage.roots.core).not.toContain('Translations');
        });
    });

    describe('[DCR-052] the guard specs themselves', () => {
        it('[DCR-052] should follow the guard-spec pattern the other swept packages use', () => {
            expectPresent(['__tests__/dead-code-sweep.spec.ts']);
            ['packages/components', 'packages/reports', 'packages/shared'].forEach(pkg =>
                expect(fs.existsSync(path.join(repo_root, pkg, 'src/__tests__/dead-code-sweep.spec.ts'))).toBe(true)
            );
        });

        it('[DCR-052] should leave the packages/shared guard spec unmodified', () => {
            const shared_spec = readRepoFile('packages/shared/src/__tests__/dead-code-sweep.spec.ts');
            expect(shared_spec).toContain("describe('C7 @deriv/shared sweep'");
            expect(shared_spec).toContain('should leave the independent isEuCountry in core alone');
        });
    });
});
