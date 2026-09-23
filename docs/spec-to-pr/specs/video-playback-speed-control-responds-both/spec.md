## ADDED Requirements

### Requirement: [PBRC-001] Playback speed control does not open on hover

The video player's playback speed control (`PlaybackRateControl` in `packages/components/src/components/video-player/playback-rate-control.tsx`, rendering the shared `Dropdown` from `packages/components/src/components/dropdown/dropdown.tsx`) must not pass `should_open_on_hover` to `Dropdown`, so `Dropdown`'s `mouseover`/`mouseleave` branch in `handleVisibility` never fires `setIsListVisible` for this control, regardless of `is_mobile`.

#### Scenario: Hovering the speed control on desktop

- **WHEN** a user moves the pointer over the playback speed control (triggering `mouseover`) without clicking
- **THEN** the speed options list stays closed (`is_list_visible` remains `false`)

#### Scenario: Moving the pointer away after opening via click

- **WHEN** a user clicks the playback speed control to open the list, then moves the pointer away (triggering `mouseleave`) without clicking again
- **THEN** the speed options list stays open

### Requirement: [PBRC-002] Playback speed control opens and closes only via click

The playback speed control must continue to toggle its options list exclusively through the existing `onClick` path on `Dropdown`'s display element, unaffected by removing hover support.

#### Scenario: Clicking the speed control toggles the list

- **WHEN** a user clicks the playback speed control
- **THEN** the speed options list opens, and clicking it again closes the list

#### Scenario: Selecting a speed option via click still changes playback rate

- **WHEN** a user clicks the playback speed control to open the list and clicks a different speed option
- **THEN** `onPlaybackRateChange` is called with the selected rate and the list closes
