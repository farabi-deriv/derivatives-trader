import fs from 'fs';
import path from 'path';

const repo_root = path.resolve(__dirname, '../../../..');
const readRepoFile = (relative_path: string) => fs.readFileSync(path.join(repo_root, relative_path), 'utf8');

describe('C8e @deriv/stores sweep', () => {
    describe('[DCR-030] the type surface is narrowed to its external consumers', () => {
        const types = () => readRepoFile('packages/stores/types.ts');

        it('[DCR-030] should have de-exported the three internally-read types', () => {
            expect(types()).toContain("type TUrlUnavailableModalReason = 'trade_type' | 'symbol' | 'both';");
            expect(types()).toContain('type TCurrentAccount = {');
            expect(types()).toContain('type TClientStore = {');
            ['TUrlUnavailableModalReason', 'TCurrentAccount', 'TClientStore'].forEach(name =>
                expect(types()).not.toContain(`export type ${name}`)
            );
        });

        it('[DCR-030] should keep the types with external consumers exported', () => {
            [
                'TCoreStores',
                'TStores',
                'TPortfolioPosition',
                'TNotificationMessage',
                'TCommonStoreServicesError',
            ].forEach(name => expect(types()).toContain(`export type ${name}`));
        });

        it('[DCR-030] should keep all six compatibility aliases, each read by a TCoreStores member', () => {
            const alias_readers: Record<string, RegExp> = {
                ActiveSymbols: /active_symbols: ActiveSymbols;/,
                ContractUpdate: /contract_update\?: ContractUpdate;/,
                ContractUpdateHistory: /contract_update_history: ContractUpdateHistory;/,
                LogOutResponse: /logout: \(\) => Promise<LogOutResponse>;/,
                Portfolio1: /Omit<Portfolio1, /,
                ProposalOpenContract: /contract_info: ProposalOpenContract/,
            };
            Object.entries(alias_readers).forEach(([alias, reader]) => {
                expect(types()).toContain(`type ${alias} = `);
                expect(types()).toMatch(reader);
            });
        });

        it('[DCR-030] should leave the stores manifest untouched', () => {
            const manifest = JSON.parse(readRepoFile('packages/stores/package.json'));
            expect(Object.keys(manifest.dependencies).sort()).toEqual([
                '@deriv/api',
                '@deriv/shared',
                'lodash.merge',
                'mobx',
                'mobx-react-lite',
                'react',
            ]);
        });

        it('[DCR-030] should no longer advertise TClientStore as an exported type', () => {
            expect(readRepoFile('packages/stores/README.md')).not.toContain(
                '- **TClientStore**: User authentication and account management'
            );
        });
    });
});
