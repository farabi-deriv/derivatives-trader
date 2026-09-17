import fs from 'fs';
import path from 'path';

import * as ApiHooks from '../index';

const repo_root = path.resolve(__dirname, '../../../../..');
const readRepoFile = (relative_path: string) => fs.readFileSync(path.join(repo_root, relative_path), 'utf8');
const repoFileExists = (relative_path: string) => fs.existsSync(path.join(repo_root, relative_path));

// Bridge identifiers that must not survive anywhere the bridge used to fork behaviour.
const BRIDGE_TOKENS = [
    'useMobileBridge',
    'sendBridgeEvent',
    'isBridgeAvailable',
    'isMobileApp',
    'DerivAppChannel',
    'nativeAppAllowedTradeTypes',
    'useNativeAppAllowedTradeTypes',
];

// The source files that previously forked on the bridge and were collapsed back to the web path.
const COLLAPSED_SOURCE_FILES = [
    'packages/core/src/Modules/Menu/menu.tsx',
    'packages/core/src/App/Containers/Layout/bottom-nav/bottom-nav.tsx',
    'packages/core/src/App/Components/Layout/Header/account-actions.tsx',
    'packages/core/src/App/Containers/Modals/TryRealModal/try-real-modal.tsx',
    'packages/core/src/App/AppContent.tsx',
    'packages/core/src/App/app.jsx',
    'packages/trader/src/AppV2/Components/Layout/Sidebar/sidebar.tsx',
    'packages/trader/src/AppV2/Components/ServiceErrorSheet/service-error-sheet.tsx',
    'packages/trader/src/AppV2/Components/AccountHeader/account-header.tsx',
    'packages/trader/src/AppV2/Components/Guide/Description/trade-description.tsx',
    'packages/trader/src/AppV2/Containers/Positions/positions.tsx',
    'packages/trader/src/AppV2/Hooks/useContractsFor.ts',
    'packages/trader/src/AppV2/Hooks/useAvailableContracts.ts',
    'packages/trader/src/AppV2/Hooks/useGuideContractTypes.ts',
    'packages/trader/src/AppV2/Utils/trade-types-utils.tsx',
    'packages/trader/src/AppV2/Utils/trading-contract-type-helpers.tsx',
    'packages/reports/src/Components/Elements/Modals/ServicesErrorModal/insufficient-balance-modal.tsx',
];

describe('mobile-bridge removal', () => {
    it('[MBR-001] deletes the bridge hook, its barrel export and its global types', () => {
        expect(repoFileExists('packages/api/src/hooks/useMobileBridge.ts')).toBe(false);
        expect(repoFileExists('packages/api/src/hooks/__tests__/useMobileBridge.spec.ts')).toBe(false);
        expect(ApiHooks).not.toHaveProperty('useMobileBridge');
        expect(readRepoFile('packages/api/src/hooks/index.ts')).not.toContain('useMobileBridge');

        const global_types = readRepoFile('types/global.d.ts');
        ['DerivAppChannel', 'DerivAppChannelMessage', 'TradingConfigData'].forEach(token =>
            expect(global_types).not.toContain(token)
        );
    });

    it('[MBR-004] removes the native-app trade-type allow-list and its remote-config key while keeping tracking flags', () => {
        expect(repoFileExists('packages/trader/src/AppV2/Hooks/useNativeAppAllowedTradeTypes.ts')).toBe(false);

        const remote_config = readRepoFile('packages/api/src/remote_config.json');
        expect(remote_config).not.toContain('native_app_allowed_trade_types');
        expect(remote_config).toContain('tracking_rudderstack');
        expect(remote_config).toContain('tracking_posthog');
    });

    it('[MBR-005] removes the vanilla-JS native-app bootstrap hooks', () => {
        expect(readRepoFile('packages/core/src/index.html')).not.toContain('is_mobile_app');

        const init_store = readRepoFile('packages/core/src/App/initStore.js');
        expect(init_store).not.toContain('is_mobile_app');
        expect(init_store).not.toContain('ory_cookie_link');
    });

    it('[MBR-007] leaves no bridge residue in the collapsed source files', () => {
        COLLAPSED_SOURCE_FILES.forEach(relative_path => {
            const source = readRepoFile(relative_path);
            BRIDGE_TOKENS.forEach(token =>
                expect({ relative_path, token, found: source.includes(token) }).toEqual({
                    relative_path,
                    token,
                    found: false,
                })
            );
        });
    });

    it('[MBR-008] updates CLAUDE.md so it no longer documents the bridge', () => {
        const claude_md = readRepoFile('CLAUDE.md');
        expect(claude_md).not.toContain('useMobileBridge');
        expect(claude_md).not.toContain('Mobile bridge detection');
    });
});
