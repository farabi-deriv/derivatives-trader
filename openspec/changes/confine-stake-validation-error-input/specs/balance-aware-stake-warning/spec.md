## ADDED Requirements

### Requirement: [SEC-004] Both breakpoints block Save while the warning shows; only Buy is exempt

Both stake editors SHALL block committing the drafted amount while the balance hint applies:

- On the mobile action sheet (`stake-input.tsx`), the balance hint SHALL contribute to `is_save_disabled`, so the header check published via `registerHeaderActions` is disabled for as long as the hint shows. `onSave` SHALL also treat the hint as a no-op guard, so invoking the commit handler directly (bypassing the disabled header control) SHALL NOT commit the amount either.
- On the desktop modal (`stake-input-desktop.tsx`), the balance hint SHALL contribute to the footer **Save** button's `disabled` prop, to `onSave` (as a no-op guard), and to the `handleKeyDown` Enter-to-save guard — so Save is disabled for as long as the hint shows and committing an unaffordable stake from the modal is not possible.

**Buy** is the only control exempt from the balance gate: it keeps the codebase's established "inform, don't disable" stance (`purchase-button.tsx:319-325`) — a user may still tap **Buy** on an unaffordable stake and meet the server-reported insufficient-balance gate, then deposit afterwards.

#### Scenario: The mobile header Save is disabled while the hint shows, and re-enables once affordable

- **WHEN** the balance is `4.00 USD` and the user taps a `20 USD` preset in the mobile stake sheet
- **THEN** the header action published via `registerHeaderActions` reports `is_save_disabled: true`, and invoking its `onSave` does not commit the amount or close the sheet
- **WHEN** the user then taps an affordable `1 USD` preset
- **THEN** `is_save_disabled` becomes `false` again

#### Scenario: The desktop footer Save is disabled while the hint shows, and re-enables once affordable

- **WHEN** the balance is `4.00 USD`, the user drafts `10` in the desktop stake modal, and the proposal has returned without error
- **THEN** the footer **Save** button is disabled while the balance hint shows, and invoking `onSave` directly does not commit the amount or close the modal
- **WHEN** the user then drafts an affordable `4`
- **THEN** the footer **Save** button is enabled again

## REMOVED Requirements

### Requirement: The mobile action sheet's Save is blocked while the warning shows; the desktop modal's is not

**Reason**: The desktop modal no longer diverges from mobile — both breakpoints now block Save while the balance hint shows, so the intentional-divergence requirement is replaced by the aligned one above.
**Migration**: See the added requirement "Both breakpoints block Save while the warning shows; only Buy is exempt". Only **Buy** remains exempt from the balance gate.
