import { ContractType } from '../contract-type';

// Characterization guards for the C5c whole-unit deletions and the session/start-date collapse:
// they never went red, they pin that the dead helpers are gone and the live derivation stays.
describe('C5c dead trader-helper removal', () => {
    it('[DCR-009] removes the dead multiplier/preview-proposal helpers and keeps proposal.ts', () => {
        expect(() => require.resolve('../multiplier')).toThrow();
        expect(() => require.resolve('../preview-proposal')).toThrow();
        expect(() => require.resolve('../proposal')).not.toThrow();
    });

    it('[DCR-010] drops the session start-date helper and getSessions while keeping the expiry derivation', () => {
        expect(() => require.resolve('../start-date')).toThrow();
        expect((ContractType as Record<string, unknown>).getSessions).toBeUndefined();
        expect(ContractType.getExpiryTime).toBeDefined();
        expect(ContractType.getExpiryDate).toBeDefined();
        expect(ContractType.getStartTime).toBeDefined();
    });
});
