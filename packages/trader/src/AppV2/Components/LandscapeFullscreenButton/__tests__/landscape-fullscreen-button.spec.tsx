import { isPhoneLandscape } from '@deriv/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';

import LandscapeFullscreenButton from '../landscape-fullscreen-button';

jest.mock('@deriv/shared', () => ({ ...jest.requireActual('@deriv/shared'), isPhoneLandscape: jest.fn(() => true) }));
const mockIsPhoneLandscape = isPhoneLandscape as jest.Mock;

// jsdom implements none of the Fullscreen API, so each test states what the browser offers.
const stubFullscreen = ({ enabled = true } = {}) => {
    let element: Element | null = null;
    const settle = (next: Element | null) => {
        element = next;
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
    };
    const requestFullscreen = jest.fn(() => settle(document.documentElement));
    const exitFullscreen = jest.fn(() => settle(null));
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, get: () => enabled });
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => element });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exitFullscreen });
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
        configurable: true,
        value: requestFullscreen,
    });
    return { requestFullscreen, exitFullscreen };
};

describe('LandscapeFullscreenButton', () => {
    it('renders nothing where the Fullscreen API is missing, as on iPhone', () => {
        stubFullscreen({ enabled: false });
        render(<LandscapeFullscreenButton />);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('enters fullscreen with the navigation UI hidden, then exits on a second tap', () => {
        const { requestFullscreen, exitFullscreen } = stubFullscreen();
        render(<LandscapeFullscreenButton />);

        expect(screen.getByTestId('dt_landscape_fullscreen_toggle')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
        expect(requestFullscreen).toHaveBeenCalledWith({ navigationUI: 'hide' });

        fireEvent.click(screen.getByRole('button', { name: 'Exit full screen' }));
        expect(exitFullscreen).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('button', { name: 'Full screen' })).toBeInTheDocument();
    });

    it('follows an exit the browser made itself, such as the back gesture', () => {
        stubFullscreen();
        render(<LandscapeFullscreenButton />);
        fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
        expect(screen.getByRole('button', { name: 'Exit full screen' })).toBeInTheDocument();

        act(() => {
            document.exitFullscreen();
        });

        expect(screen.getByRole('button', { name: 'Full screen' })).toBeInTheDocument();
    });

    it('leaves fullscreen when a rotation to portrait unmounts it, since portrait has no way out', () => {
        const { exitFullscreen } = stubFullscreen();
        const { unmount } = render(<LandscapeFullscreenButton />);
        fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));

        mockIsPhoneLandscape.mockReturnValue(false);
        unmount();

        expect(exitFullscreen).toHaveBeenCalledTimes(1);
        mockIsPhoneLandscape.mockReturnValue(true);
    });

    it('stays in fullscreen when navigating away in landscape, e.g. to Reports', () => {
        const { exitFullscreen } = stubFullscreen();
        const { unmount } = render(<LandscapeFullscreenButton />);
        fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));

        unmount();

        expect(exitFullscreen).not.toHaveBeenCalled();
    });
});
