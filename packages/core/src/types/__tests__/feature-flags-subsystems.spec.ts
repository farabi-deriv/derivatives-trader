import fs from 'fs';
import path from 'path';

import { isFeatureFlags } from '../feature-flags';

const repo_root = path.resolve(__dirname, '../../../../..');
const readRepoFile = (relative_path: string) => fs.readFileSync(path.join(repo_root, relative_path), 'utf8');

describe('feature-flag subsystems', () => {
    it('[DCR-007] should keep the remote-config tracking flags and reject the removed chat keys', () => {
        expect(isFeatureFlags({ tracking_rudderstack: true, tracking_posthog: false })).toBe(true);

        const source = readRepoFile('packages/core/src/types/feature-flags.ts');
        expect(source).not.toContain('cs_chat_intercom');
        expect(source).not.toContain('cs_chat_whatsapp');

        const remote_config = readRepoFile('packages/api/src/remote_config.json');
        expect(remote_config).not.toContain('cs_chat_intercom');
        expect(remote_config).not.toContain('cs_chat_whatsapp');
    });

    it('[DCR-007] should leave the remote-config subsystem untouched by the store-subsystem removal', () => {
        expect(readRepoFile('packages/core/src/Utils/Analytics/index.ts')).toContain('tracking_rudderstack');
        expect(fs.existsSync(path.join(repo_root, 'packages/stores/src/stores'))).toBe(false);
        expect(fs.existsSync(path.join(repo_root, 'packages/api/src/hooks/useFeatureFlags.ts'))).toBe(false);
        expect(fs.existsSync(path.join(repo_root, 'packages/core/src/Modules/Endpoint/FeatureFlagsSection.tsx'))).toBe(
            false
        );
        expect(readRepoFile('packages/core/src/App/Devtools.tsx')).not.toContain('FeatureFlagsSection');
    });
});
