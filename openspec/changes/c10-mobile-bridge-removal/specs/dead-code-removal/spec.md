## MODIFIED Requirements

### Requirement: [DCR-007] Remote-config chat gating keys are removed, tracking flags kept

`cs_chat_intercom` and `cs_chat_whatsapp` SHALL be removed from the `FeatureFlags` interface AND the `isFeatureFlags` guard in `packages/core/src/types/feature-flags.ts`, and both keys SHALL be removed from `packages/api/src/remote_config.json`. `tracking_rudderstack` and `tracking_posthog` SHALL be kept. (`native_app_allowed_trade_types` was kept by C1 but is removed by the c10 mobile-bridge-removal change; it is no longer a "kept" key here.) This is the remote-config chat gating only — a distinct subsystem from the `FeatureFlagsStore`/`useFeatureFlags` store subsystem, which was reserved for C7 and is removed by DCR-013. `packages/core/src/types/feature-flags.ts` and `packages/core/src/Utils/Analytics/index.ts` survive DCR-013 unchanged.

#### Scenario: Only chat keys removed from remote config

- **WHEN** the C1d feature-flags phase lands
- **THEN** `cs_chat_intercom` and `cs_chat_whatsapp` are gone from the interface, the `isFeatureFlags` guard and `remote_config.json`, while `tracking_rudderstack` and `tracking_posthog` remain

#### Scenario: The two feature-flag subsystems stay separate

- **WHEN** the C7 store-subsystem removal (DCR-013) lands
- **THEN** the remote-config `FeatureFlags` interface, its guard and its analytics consumers are untouched, and only the `FeatureFlagsStore`/`useFeatureFlags` surfaces are deleted
