import { configure, runInAction } from 'mobx';

import UIStore from '../ui-store';

configure({ safeDescriptors: false });

type TMediaQueryListener = (event: { matches: boolean }) => void;

/**
 * Controllable `matchMedia('(prefers-color-scheme: dark)')` stand-in. `matches` is mutable and
 * `emit()` replays a system theme change through every registered listener, so the store can be
 * driven the way a real device does when the OS theme is switched under a running app.
 */
const mockMatchMedia = ({ matches, legacy_api = false }: { matches: boolean; legacy_api?: boolean }) => {
    const listeners: TMediaQueryListener[] = [];
    const record = jest.fn((...args: unknown[]) => {
        listeners.push(args[args.length - 1] as TMediaQueryListener);
    });

    const query: Record<string, unknown> = {
        matches,
        media: '(prefers-color-scheme: dark)',
        // Safari < 14 and older Android WebViews only expose the deprecated MediaQueryList API.
        addListener: record,
        removeListener: jest.fn(),
    };
    if (!legacy_api) {
        query.addEventListener = record;
        query.removeEventListener = jest.fn();
    }

    window.matchMedia = jest.fn(() => query) as never;

    return {
        query,
        emit: (next_matches: boolean) => {
            query.matches = next_matches;
            listeners.forEach(listener => listener({ matches: next_matches }));
        },
    };
};

const setViewportWidth = (width: number) => {
    Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
};

describe('UIStore theme', () => {
    const original_match_media = window.matchMedia;
    const original_inner_width = window.innerWidth;

    type TThemePreference = 'light' | 'dark' | 'system';
    type TThemeStore = InstanceType<typeof UIStore> & {
        theme_preference: TThemePreference;
        resolveTheme: () => void;
        setThemePreference: (preference: TThemePreference) => void;
        onUnmount: () => void;
    };

    let stores: TThemeStore[] = [];

    // ui-store is plain JS; only the root_store members its constructor and setDarkMode touch are needed.
    const createStore = () => {
        const ui = new UIStore({
            common: {},
            client: {},
            gtm: { pushDataLayer: jest.fn() },
        } as never) as TThemeStore;
        stores.push(ui);
        return ui;
    };

    // BaseStore schedules retrieveFromStorage() in a setTimeout(..., 0), and the theme re-resolve is
    // queued right behind it; both have run once a macrotask has elapsed.
    const flushRehydrate = () =>
        new Promise(resolve => {
            setTimeout(resolve, 0);
        });

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        document.documentElement.className = '';
        document.documentElement.removeAttribute('style');
        document.head.innerHTML = '';
    });

    // Every store queues 0ms timers and keeps live MobX reactions. Let the timers fire while this
    // test's storage and matchMedia stub are still in place, then dispose the stores — otherwise a
    // synchronous test leaves pending work that lands inside the next test's `await flushRehydrate()`
    // and makes the outcome depend on test order.
    afterEach(async () => {
        await flushRehydrate();
        stores.forEach(ui => ui.onUnmount());
        stores = [];
        window.matchMedia = original_match_media;
        setViewportWidth(original_inner_width);
    });

    describe('resolution from the system preference', () => {
        it('defaults theme_preference to "system"', () => {
            mockMatchMedia({ matches: false });
            expect(createStore().theme_preference).toBe('system');
        });

        it.each([
            ['a narrow viewport', 375],
            ['a wide viewport', 1280],
        ])('resolves dark from the system preference on %s', (_label, width) => {
            // The old implementation gated system detection behind isMobile() (innerWidth <= 600),
            // so the same device stopped following the system theme just by rotating.
            setViewportWidth(width);
            mockMatchMedia({ matches: true });

            expect(createStore().is_dark_mode_on).toBe(true);
        });

        it('resolves light when the system prefers light', () => {
            mockMatchMedia({ matches: false });

            expect(createStore().is_dark_mode_on).toBe(false);
        });

        it.each([
            ['system', true, true],
            ['system', false, false],
            ['dark', true, true],
            ['dark', false, true],
            ['light', true, false],
            ['light', false, false],
        ])('resolves is_dark_mode_on to %s/%s -> %s', (preference, system_prefers_dark, expected_dark_mode) => {
            mockMatchMedia({ matches: system_prefers_dark as boolean });
            const ui = createStore();

            runInAction(() => {
                ui.theme_preference = preference as TThemePreference;
                ui.resolveTheme();
            });

            expect(ui.is_dark_mode_on).toBe(expected_dark_mode);
        });
    });

    describe('live system theme changes', () => {
        it('follows a system change while the preference is "system"', () => {
            const media = mockMatchMedia({ matches: false });
            const ui = createStore();

            media.emit(true);

            expect(ui.is_dark_mode_on).toBe(true);
        });

        it('ignores a system change once a theme has been chosen explicitly', () => {
            const media = mockMatchMedia({ matches: false });
            const ui = createStore();

            ui.setDarkMode(false);
            media.emit(true);

            expect(ui.theme_preference).toBe('light');
            expect(ui.is_dark_mode_on).toBe(false);
        });

        it('falls back to addListener when addEventListener is unavailable', () => {
            const media = mockMatchMedia({ matches: false, legacy_api: true });
            const ui = createStore();

            expect(media.query.addListener).toHaveBeenCalled();

            media.emit(true);

            expect(ui.is_dark_mode_on).toBe(true);
        });

        it('stops listening to the system preference on unmount', () => {
            const media = mockMatchMedia({ matches: false });
            const ui = createStore();

            ui.onUnmount();

            expect(media.query.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
        });
    });

    describe('setThemePreference', () => {
        it('resolves dark when "dark" is chosen on a light-OS device', () => {
            mockMatchMedia({ matches: false });
            const ui = createStore();

            ui.setThemePreference('dark');

            expect(ui.theme_preference).toBe('dark');
            expect(ui.is_dark_mode_on).toBe(true);
        });

        it('resolves the OS theme when "system" is chosen on a dark-OS device', () => {
            mockMatchMedia({ matches: true });
            const ui = createStore();

            ui.setThemePreference('light');
            expect(ui.is_dark_mode_on).toBe(false);

            ui.setThemePreference('system');

            expect(ui.theme_preference).toBe('system');
            expect(ui.is_dark_mode_on).toBe(true);
        });

        it('ignores an invalid preference value', () => {
            mockMatchMedia({ matches: false });
            const ui = createStore();

            ui.setThemePreference('blue' as never);

            expect(ui.theme_preference).toBe('system');
            expect(ui.is_dark_mode_on).toBe(false);
        });

        it('reports the switch to GTM only when the resolved theme actually changes', () => {
            mockMatchMedia({ matches: false });
            const ui = createStore();

            // 'system' resolves light and the app is already light: no theme switch happened.
            ui.setThemePreference('light');
            expect(ui.root_store.gtm.pushDataLayer).not.toHaveBeenCalled();

            ui.setThemePreference('dark');
            expect(ui.root_store.gtm.pushDataLayer).toHaveBeenCalledWith({ event: 'switch theme' });
        });

        it('returns to following the system theme live after an explicit choice', () => {
            // The round trip that motivates the System option: explicit light on a dark OS,
            // back to system (resolves dark), then a live OS change flips it to light.
            const media = mockMatchMedia({ matches: true });
            const ui = createStore();

            ui.setThemePreference('light');
            expect(ui.is_dark_mode_on).toBe(false);

            ui.setThemePreference('system');
            expect(ui.is_dark_mode_on).toBe(true);

            media.emit(false);

            expect(ui.is_dark_mode_on).toBe(false);
        });
    });

    describe('setDarkMode', () => {
        it('delegates to setThemePreference and records the choice as explicit', () => {
            mockMatchMedia({ matches: false });
            const ui = createStore();

            expect(ui.setDarkMode(true)).toBe(true);

            expect(ui.theme_preference).toBe('dark');
            expect(ui.is_dark_mode_on).toBe(true);
        });

        it('records an explicit preference that a later system change cannot override', () => {
            const media = mockMatchMedia({ matches: false });
            const ui = createStore();

            expect(ui.setDarkMode(true)).toBe(true);
            expect(ui.theme_preference).toBe('dark');

            media.emit(false);

            expect(ui.is_dark_mode_on).toBe(true);
        });

        it('reports the theme switch to GTM', () => {
            mockMatchMedia({ matches: false });
            const ui = createStore();

            ui.setDarkMode(true);

            expect(ui.root_store.gtm.pushDataLayer).toHaveBeenCalledWith({ event: 'switch theme' });
        });
    });

    describe('reading the stored preference', () => {
        it.each([
            ['light', false],
            ['dark', true],
        ])('reads a stored %s boolean with no preference as an explicit choice', async (_label, stored_dark_mode) => {
            localStorage.setItem('ui_store', JSON.stringify({ is_dark_mode_on: stored_dark_mode }));
            // Opposite system theme: an upgrade must not let it flip the stored choice.
            mockMatchMedia({ matches: !stored_dark_mode });
            const ui = createStore();

            // Resolved from storage synchronously, before BaseStore's rehydrate timer runs — the
            // rehydrate reaction writes theme_preference back to storage, so a migration deferred
            // until after it would see an already-migrated snapshot and never fire.
            expect(ui.theme_preference).toBe(stored_dark_mode ? 'dark' : 'light');
            expect(ui.is_dark_mode_on).toBe(stored_dark_mode);

            await flushRehydrate();

            expect(ui.theme_preference).toBe(stored_dark_mode ? 'dark' : 'light');
            expect(ui.is_dark_mode_on).toBe(stored_dark_mode);
        });

        it('keeps an explicitly stored preference across rehydrate', async () => {
            localStorage.setItem('ui_store', JSON.stringify({ is_dark_mode_on: true, theme_preference: 'dark' }));
            mockMatchMedia({ matches: false });
            const ui = createStore();

            expect(ui.is_dark_mode_on).toBe(true);

            await flushRehydrate();

            expect(ui.theme_preference).toBe('dark');
            expect(ui.is_dark_mode_on).toBe(true);
        });

        it('re-resolves a stored "system" preference against the current system theme', async () => {
            // The stored boolean is stale: it was dark when the app last closed, the OS is light now.
            localStorage.setItem('ui_store', JSON.stringify({ is_dark_mode_on: true, theme_preference: 'system' }));
            mockMatchMedia({ matches: false });
            const ui = createStore();

            expect(ui.is_dark_mode_on).toBe(false);

            await flushRehydrate();

            expect(ui.theme_preference).toBe('system');
            expect(ui.is_dark_mode_on).toBe(false);
        });

        it('falls back to the system theme when the stored snapshot is unparseable', () => {
            localStorage.setItem('ui_store', '{not json');
            mockMatchMedia({ matches: true });
            const ui = createStore();
            // Cleared before the rehydrate timer fires: BaseStore.retrieveFromStorage() parses the
            // same value unguarded, which is pre-existing behaviour this test is not about.
            localStorage.clear();

            expect(ui.theme_preference).toBe('system');
            expect(ui.is_dark_mode_on).toBe(true);
        });

        it('follows the system theme on a first visit', async () => {
            mockMatchMedia({ matches: true });
            const ui = createStore();

            await flushRehydrate();

            expect(ui.theme_preference).toBe('system');
            expect(ui.is_dark_mode_on).toBe(true);
        });
    });

    describe('applying the resolved theme to the DOM', () => {
        const surface_color = { dark: '#181c25', light: '#ffffff' };

        it('keeps the <html> class in step with the theme', () => {
            mockMatchMedia({ matches: false });
            const ui = createStore();

            expect(document.documentElement).toHaveClass('light');

            ui.setDarkMode(true);

            expect(document.documentElement).toHaveClass('dark');
            expect(document.documentElement).not.toHaveClass('light');
        });

        it('declares the resolved colour scheme and follows a runtime theme switch', () => {
            mockMatchMedia({ matches: false });
            const ui = createStore();
            const { style } = document.documentElement;

            expect(style.colorScheme).toBe('light');

            ui.setDarkMode(true);

            expect(style.colorScheme).toBe('dark');

            ui.setDarkMode(false);

            expect(style.colorScheme).toBe('light');
        });

        it('clears the inline loader colours the boot script sets, so CSS owns the tokens', () => {
            // Simulate the pre-React boot script's dark-loader paint.
            document.documentElement.style.setProperty('--color-surface-primary', surface_color.dark);
            document.documentElement.style.setProperty('--color-text-primary', '#ffffff');
            mockMatchMedia({ matches: false });
            createStore();
            const { style } = document.documentElement;

            // Once the store's writer runs, the `.theme--*` stylesheet blocks are in charge —
            // a leftover inline value would shadow the brand tokens for the <html> element.
            expect(style.getPropertyValue('--color-surface-primary')).toBe('');
            expect(style.getPropertyValue('--color-text-primary')).toBe('');
        });

        it('re-asserts the <html> class when a late writer overwrites it (quill ThemeProvider race)', async () => {
            mockMatchMedia({ matches: true });
            const ui = createStore();

            expect(document.documentElement).toHaveClass('dark');

            // Simulate quill's ThemeProvider re-applying its stale previous theme after an OS flip.
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
            // MutationObserver callbacks are microtasks — let them run.
            await Promise.resolve();

            expect(document.documentElement).toHaveClass('dark');
            expect(document.documentElement).not.toHaveClass('light');
            expect(ui.is_dark_mode_on).toBe(true);
        });

        it('updates <meta name="theme-color"> to the theme surface colour', () => {
            mockMatchMedia({ matches: false });
            const ui = createStore();
            const themeColor = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content');

            expect(themeColor()).toBe(surface_color.light);

            ui.setDarkMode(true);

            expect(themeColor()).toBe(surface_color.dark);
        });
    });

    describe('a ?theme= deep link applied via setDarkMode (app.jsx)', () => {
        // Product decision: the param behaves exactly like tapping the theme switcher — it renders
        // with first priority, is recorded as the explicit preference, and the Theme menu shows it
        // as the selected option on this and subsequent launches.
        it('records the param as the explicit preference the switcher displays', async () => {
            localStorage.setItem('ui_store', JSON.stringify({ theme_preference: 'light' }));
            mockMatchMedia({ matches: false });
            const ui = createStore();
            await flushRehydrate();

            ui.setDarkMode(true); // what app.jsx does for ?theme=dark

            expect(ui.is_dark_mode_on).toBe(true);
            expect(ui.theme_preference).toBe('dark');
            expect(JSON.parse(localStorage.getItem('ui_store') as string).theme_preference).toBe('dark');
        });
    });

    describe('theme persistence shape', () => {
        it('persists the preference alone — never the derived is_dark_mode_on boolean', async () => {
            mockMatchMedia({ matches: false });
            const ui = createStore();

            // Let the persistence reaction get set up (0ms timer) before the change that fires it.
            await flushRehydrate();
            ui.setDarkMode(true);

            const snapshot = JSON.parse(localStorage.getItem('ui_store') as string);
            expect(snapshot.theme_preference).toBe('dark');
            // Persisting the derived boolean let rehydrate write back a stale value that
            // contradicted a 'system' preference whose OS theme changed between visits.
            expect(snapshot).not.toHaveProperty('is_dark_mode_on');
        });
    });
});

describe('UIStore.toggleUrlUnavailableModal', () => {
    let ui: InstanceType<typeof UIStore>;

    beforeEach(() => {
        // ui-store is plain JS; only the root_store members its constructor touches are needed here.
        ui = new UIStore({ common: {}, client: {} } as never);
    });

    it('defaults to the trade-type reason when none is passed', () => {
        ui.toggleUrlUnavailableModal(true);
        expect(ui.isUrlUnavailableModalVisible).toBe(true);
        expect(ui.urlUnavailableModalReason).toBe('trade_type');
    });

    it('stores the reason it was opened with', () => {
        ui.toggleUrlUnavailableModal(true, 'symbol');
        expect(ui.urlUnavailableModalReason).toBe('symbol');
    });

    it('keeps the last reason when closed so a re-open is not mislabelled', () => {
        ui.toggleUrlUnavailableModal(true, 'symbol');
        ui.toggleUrlUnavailableModal(false);
        expect(ui.isUrlUnavailableModalVisible).toBe(false);
        expect(ui.urlUnavailableModalReason).toBe('symbol');
    });

    it('widens to "both" instead of rewriting the title when a second reason arrives while open', () => {
        // GRWT-9320: a second validation reporting a different invalid URL value used to replace the
        // reason, flipping "Unsupported trade type" to "Unsupported market" under the user's eyes.
        ui.toggleUrlUnavailableModal(true, 'trade_type');
        ui.toggleUrlUnavailableModal(true, 'symbol');
        expect(ui.isUrlUnavailableModalVisible).toBe(true);
        expect(ui.urlUnavailableModalReason).toBe('both');
    });

    it('is idempotent when the same reason is reported twice', () => {
        ui.toggleUrlUnavailableModal(true, 'symbol');
        ui.toggleUrlUnavailableModal(true, 'symbol');
        expect(ui.urlUnavailableModalReason).toBe('symbol');
    });
});

describe('UIStore frozen chart controls removed', () => {
    const buildUi = () =>
        new UIStore({ common: {}, client: {} } as never) as InstanceType<typeof UIStore> & {
            is_chart_layout_default?: unknown;
            is_chart_countdown_visible?: unknown;
            is_chart_asset_info_visible?: unknown;
            setChartLayout?: unknown;
            setChartCountdown?: unknown;
            local_storage_properties: string[];
        };

    it('[ABF-011] no longer exposes the frozen chart layout/countdown observables, setters, or persisted keys', () => {
        const store = buildUi();

        expect(store.is_chart_layout_default).toBeUndefined();
        expect(store.is_chart_countdown_visible).toBeUndefined();
        expect(store.setChartLayout).toBeUndefined();
        expect(store.setChartCountdown).toBeUndefined();
        expect(store.local_storage_properties).not.toContain('is_chart_layout_default');
        expect(store.local_storage_properties).not.toContain('is_chart_countdown_visible');
    });

    it('[ABF-013] no longer persists the dead chart asset-info key', () => {
        const store = buildUi();

        expect(store.is_chart_asset_info_visible).toBeUndefined();
        expect(store.local_storage_properties).not.toContain('is_chart_asset_info_visible');
    });
});

describe('UIStore frozen chart controls removed', () => {
    const buildUi = () =>
        new UIStore({ common: {}, client: {} } as never) as InstanceType<typeof UIStore> & {
            is_chart_layout_default?: unknown;
            is_chart_countdown_visible?: unknown;
            is_chart_asset_info_visible?: unknown;
            setChartLayout?: unknown;
            setChartCountdown?: unknown;
            local_storage_properties: string[];
        };

    it('[ABF-011] no longer exposes the frozen chart layout/countdown observables, setters, or persisted keys', () => {
        const store = buildUi();

        expect(store.is_chart_layout_default).toBeUndefined();
        expect(store.is_chart_countdown_visible).toBeUndefined();
        expect(store.setChartLayout).toBeUndefined();
        expect(store.setChartCountdown).toBeUndefined();
        expect(store.local_storage_properties).not.toContain('is_chart_layout_default');
        expect(store.local_storage_properties).not.toContain('is_chart_countdown_visible');
    });

    it('[ABF-013] no longer persists the dead chart asset-info key', () => {
        const store = buildUi();

        expect(store.is_chart_asset_info_visible).toBeUndefined();
        expect(store.local_storage_properties).not.toContain('is_chart_asset_info_visible');
    });
});
