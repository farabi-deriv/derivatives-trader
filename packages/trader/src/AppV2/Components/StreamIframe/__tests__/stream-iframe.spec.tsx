import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { UNIFIED_MODE_VIDEO_ID, getVideoMp4Url } from 'AppV2/Utils/video-config';

import StreamIframe from '../stream-iframe';

const video_stream_testid = 'dt_video_stream';
const dt_loader = 'square-skeleton';

const mocked_props = {
    src: UNIFIED_MODE_VIDEO_ID.accumulator_stats.light,
    test_id: video_stream_testid,
    title: 'accumulator_stats',
};

describe('StreamIframe component', () => {
    it('renders video with no controls & autoplay & looped & muted & preloaded & width and height === 100% by default', () => {
        render(<StreamIframe {...mocked_props} />);
        const video = screen.getByTestId(video_stream_testid) as HTMLVideoElement;

        expect(video.tagName).toBe('VIDEO');
        expect(video).toHaveAttribute('loop');
        expect(video.muted).toBe(true);
        expect(video).toHaveAttribute('autoplay');
        expect(video).not.toHaveAttribute('controls');
        expect(video).toHaveAttribute('preload', 'auto');
        expect(video).toHaveAttribute('src', getVideoMp4Url(UNIFIED_MODE_VIDEO_ID.accumulator_stats.light));
        expect(video).toHaveAttribute('width', '100%');
        expect(video).toHaveAttribute('height', '100%');
        expect(screen.getByTestId(dt_loader)).toBeInTheDocument();
    });

    it('renders video with controls if a proper prop was passed', () => {
        render(<StreamIframe {...mocked_props} controls />);
        const video = screen.getByTestId(video_stream_testid);

        expect(video).toHaveAttribute('controls');
    });

    it('renders video without loop if a proper prop was passed', () => {
        render(<StreamIframe {...mocked_props} loop={false} />);
        const video = screen.getByTestId(video_stream_testid);

        expect(video).not.toHaveAttribute('loop');
    });

    it('renders video without autoplay if a proper prop was passed', () => {
        render(<StreamIframe {...mocked_props} autoplay={false} />);
        const video = screen.getByTestId(video_stream_testid);

        expect(video).not.toHaveAttribute('autoplay');
    });

    it('renders video without muted if a proper prop was passed', () => {
        render(<StreamIframe {...mocked_props} muted={false} />);
        const video = screen.getByTestId(video_stream_testid) as HTMLVideoElement;

        expect(video.muted).toBe(false);
    });

    it('renders only video if the data has already loaded', () => {
        render(<StreamIframe {...mocked_props} />);

        const video = screen.getByTestId(video_stream_testid);
        fireEvent.loadedData(video);

        expect(screen.queryByTestId(dt_loader)).not.toBeInTheDocument();
        expect(video).toBeInTheDocument();
    });

    it('[TGV-003] sources the accumulator stats video from the R2 /stream/<id>.mp4 path with no Cloudflare Stream reference', () => {
        render(<StreamIframe {...mocked_props} />);
        const video = screen.getByTestId(video_stream_testid);

        const src = video.getAttribute('src') ?? '';
        expect(src).toBe(getVideoMp4Url(UNIFIED_MODE_VIDEO_ID.accumulator_stats.light));
        expect(src).toMatch(new RegExp(`/stream/${UNIFIED_MODE_VIDEO_ID.accumulator_stats.light}\\.mp4$`));
        expect(src).not.toContain('cloudflarestream.com');
    });
});
