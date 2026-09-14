import { execSync } from 'child_process';
import { configure } from 'mobx';

import { mockStore } from '@deriv/stores';

import ClientStore from '../client-store';
import CommonStore from '../common-store';
import ContractReplayStore from '../contract-replay-store';
import ContractStore from '../contract-store';
import { excluded_notifications } from '../Helpers/client-notifications';
import * as logic from '../Helpers/logic';
import NotificationStore from '../notification-store';

configure({ safeDescriptors: false });

// Characterization guards for the SMC-016 remaining-core-store removals: they never went red,
// they pin that the dead members are gone while the KEEP surfaces survive.
describe('[SMC-016] remaining core-store dead members removed', () => {
    it('CommonStore drops routeTo/isCurrentLanguage/platform/app_router/was_socket_opened, keeps live members', () => {
        const common = new CommonStore(mockStore());

        ['routeTo', 'isCurrentLanguage', 'app_router', 'was_socket_opened', 'platform'].forEach(member =>
            expect(member in common).toBe(false)
        );

        expect(typeof common.setPlatform).toBe('function');
        expect(typeof common.setInitialRouteHistoryItem).toBe('function');
        expect(typeof common.routeBackInApp).toBe('function');
        expect(typeof common.setError).toBe('function');
        // showError is NOT dead — AppV2/Hooks/useActiveSymbols.ts destructures it off `common`.
        // See docs/spec-to-pr/findings/smc-016-common-store-showerror-not-dead.md.
        expect(typeof common.showError).toBe('function');
    });

    it('[SMC-016] the kept CommonStore.showError still routes through setError for its live caller', () => {
        const common = new CommonStore(mockStore());

        common.showError({ message: 'Trading is unavailable at this time.' });

        expect(common.has_error).toBe(true);
        expect(common.error.type).toBe('error');
        expect(common.error.message).toBe('Trading is unavailable at this time.');
    });

    it('ContractStore drops write-only sell_info/is_static_chart/is_chart_scaling, keeps the barrier + update caches', () => {
        const contract = new ContractStore(mockStore(), { contract_id: 1 });

        expect('sell_info' in contract).toBe(false);
        expect('is_static_chart' in contract).toBe(false);
        expect('is_chart_scaling' in contract).toBe(false);

        expect('cached_barriers_data' in contract).toBe(true);
        expect('contract_update_config' in contract).toBe(true);
        expect(typeof contract.populateConfig).toBe('function');
    });

    it('ClientStore drops setPreferredLanguage, keeps cookie/analytics/WS-idle-recovery members', () => {
        const client = new ClientStore(mockStore());

        expect('setPreferredLanguage' in client).toBe(false);

        expect(typeof client.setCookieAccount).toBe('function');
        expect(typeof client.getAnalyticsConfig).toBe('function');
        expect(typeof client.setupVisibilityListener).toBe('function');
        expect(typeof client.removeVisibilityListener).toBe('function');
    });

    it('NotificationStore drops the never-added is_virtual config, keeps demo-top-up/install_pwa/offline/deriv_go', () => {
        const notifications = new NotificationStore(mockStore());
        notifications.setClientNotifications();
        const configs = notifications.client_notifications as unknown as Record<string, { key?: string } | undefined>;

        expect(configs.is_virtual).toBeUndefined();

        ['reset_virtual_balance', 'install_pwa', 'you_are_offline', 'deriv_go'].forEach(key =>
            expect(configs[key]?.key).toBe(key)
        );
        // contract_sold is kept as an excluded (never-rendered) notification key.
        expect(excluded_notifications).toContain('contract_sold');
    });

    it('Helpers drops the core-duplicate getBuyPrice and the whole device.js, keeps the chart helpers', () => {
        expect('getBuyPrice' in logic).toBe(false);

        expect(typeof logic.getChartConfig).toBe('function');
        expect(typeof logic.getChartType).toBe('function');
        expect(typeof logic.getChartGranularity).toBe('function');
        expect(typeof logic.calculateGranularity).toBe('function');

        // The dead device.js (getCookieObject/setDeviceDataCookie, no importer) is gone entirely.
        // eslint-disable-next-line import/no-unresolved
        expect(() => require('../Helpers/device')).toThrow(/Cannot find module/);
    });

    // Scenario: "No call to a removed client-store method survives".
    it('[SMC-016] setInitialRouteHistoryItem no longer calls the removed client.setExternalParams', () => {
        const root = mockStore();
        // A client mock WITHOUT setExternalParams — a surviving call would throw here.
        expect((root.client as unknown as { setExternalParams?: unknown }).setExternalParams).toBeUndefined();
        const common = new CommonStore(root);

        window.history.pushState({}, '', '/?ext_platform_url=https%3A%2F%2Fexample.com');
        const location = {
            pathname: '/',
            search: '?ext_platform_url=https%3A%2F%2Fexample.com',
            hash: '',
            action: 'PUSH',
        };

        expect(() => common.setInitialRouteHistoryItem(location)).not.toThrow();
        expect(common.app_routing_history).toContainEqual(expect.objectContaining({ pathname: '/', action: 'PUSH' }));

        window.history.pushState({}, '', '/');
    });

    it('[SMC-016] no production caller of the already-removed setPreventRedirectToHub / setExternalParams survives', () => {
        // Faithful to the delta scenario: grep the tree — neither already-removed client-store method
        // may retain a caller in production source (specs/__tests__ excluded, including this file).
        const grepProduction = (symbol: string) => {
            try {
                return execSync(
                    `git grep -I -l -E '${symbol}' -- 'packages' ':(exclude)*.spec.ts' ':(exclude)*.spec.tsx' ` +
                        `':(exclude)*.spec.js' ':(exclude)*.spec.jsx' ':(exclude)*/__tests__/*'`,
                    { cwd: execSync('git rev-parse --show-toplevel').toString().trim(), encoding: 'utf8' }
                ).trim();
            } catch (error) {
                // git grep exits 1 when there are no matches — that is the pass case.
                if ((error as { status?: number }).status === 1) return '';
                throw error;
            }
        };

        expect(grepProduction('setPreventRedirectToHub')).toBe('');
        expect(grepProduction('setExternalParams')).toBe('');
    });

    // SMC-017 realised outcome: the cross-store sell-flow dedup was deferred (see
    // docs/spec-to-pr/deferrals/cross-store-sell-flow-dedup.md), so both stores keep their own
    // sell/cancel trio, and the dead write-only sell_info is dropped from both rather than shared.
    it('[SMC-017] leaves both stores their own sell/cancel flow with sell_info dropped', () => {
        const replay = new ContractReplayStore(mockStore());
        const contract = new ContractStore(mockStore(), { contract_id: 1 });

        ['onClickSell', 'onClickCancel', 'handleSell'].forEach(member =>
            expect(typeof replay[member as keyof ContractReplayStore]).toBe('function')
        );
        expect('sell_info' in replay).toBe(false);
        expect('sell_info' in contract).toBe(false);
    });
});
