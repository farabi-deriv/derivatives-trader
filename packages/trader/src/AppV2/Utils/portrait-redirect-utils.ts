import { isPhoneLandscape, PHONE_LANDSCAPE_MEDIA_QUERY } from '@deriv/shared';

let cancelPending: (() => void) | null = null;

/** Drops a redirect queued by `redirectOnPortrait` (the rotate prompt was dismissed). */
export const cancelPortraitRedirect = () => {
    cancelPending?.();
    cancelPending = null;
};

/**
 * Opens `url` as soon as the phone leaves landscape. Module-level, not component state: rotating
 * remounts the app (and drops the nav rail), so a component would unmount before it saw portrait.
 */
export const redirectOnPortrait = (url: string) => {
    cancelPortraitRedirect();
    const media = window.matchMedia(PHONE_LANDSCAPE_MEDIA_QUERY);
    const onChange = () => {
        if (isPhoneLandscape()) return;
        cancelPortraitRedirect();
        window.location.href = url;
    };
    // iOS Safari < 14 only exposes the deprecated MediaQueryList API.
    if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', onChange);
        cancelPending = () => media.removeEventListener('change', onChange);
    } else {
        media.addListener(onChange);
        cancelPending = () => media.removeListener(onChange);
    }
};
