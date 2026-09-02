import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CONTRACT_LIST } from 'AppV2/Utils/trade-types-utils';

import VideoPreview from '../video-preview';

const mock_props = {
    contract_type: CONTRACT_LIST.ACCUMULATORS,
    toggleVideoPlayer: jest.fn(),
    video_src: 'test_video_id',
};

let mock_is_mobile = true;

jest.mock('@deriv-com/ui', () => ({
    ...jest.requireActual('@deriv-com/ui'),
    useDevice: () => ({ isMobile: mock_is_mobile }),
}));

jest.mock('@deriv/components', () => ({
    VideoPlayer: () => <div data-testid='dt_video_player_component' />,
}));

jest.mock('AppV2/Utils/video-config', () => ({
    getVideoMp4Url: (src: string) => `https://media.deriv.com/stream/${src}.mp4`,
}));

describe('VideoPreview', () => {
    describe('mobile', () => {
        beforeEach(() => {
            mock_is_mobile = true;
        });

        it('should render component', () => {
            render(<VideoPreview {...mock_props} />);
            expect(screen.getByText(/Watch this video to learn about this trade type/i)).toBeInTheDocument();
        });

        it('[TGV-002] should render a video still frame (with #t=0.1 src), not an image, on mobile', () => {
            render(<VideoPreview {...mock_props} />);

            const video = screen.getByTestId('dt_video_preview_thumbnail');
            expect(video.tagName).toBe('VIDEO');
            expect(video).toHaveAttribute('src', 'https://media.deriv.com/stream/test_video_id.mp4#t=0.1');
            expect(screen.queryByAltText('video thumbnail')).not.toBeInTheDocument();
        });
    });

    describe('desktop', () => {
        beforeEach(() => {
            mock_is_mobile = false;
        });

        it('should render thumbnail preview with play button', () => {
            render(<VideoPreview {...mock_props} />);
            expect(screen.getByTestId('dt_video_preview')).toBeInTheDocument();
        });

        it('[TGV-002] should render a video still frame (with #t=0.1 src), not an image, on desktop', () => {
            render(<VideoPreview {...mock_props} />);

            const video = screen.getByTestId('dt_video_preview_thumbnail');
            expect(video.tagName).toBe('VIDEO');
            expect(video).toHaveAttribute('src', 'https://media.deriv.com/stream/test_video_id.mp4#t=0.1');
            expect(screen.queryByAltText('video thumbnail')).not.toBeInTheDocument();
        });

        it('[TGV-002] should switch to video player when play button is clicked', async () => {
            render(<VideoPreview {...mock_props} />);
            await userEvent.click(screen.getByTestId('dt_video_preview'));
            expect(screen.getByTestId('dt_video_player')).toBeInTheDocument();
        });
    });
});
