import { Localize } from '@deriv-com/translations';
import { render, screen } from '@testing-library/react';

import { getContractDescription } from '../contract-description-utils';

jest.mock('AppV2/Components/Guide/Description/video-fragment', () => {
    const VideoFragment = ({ contract_type }: { contract_type: string }) => <div>video:{contract_type}</div>;
    return VideoFragment;
});

// Keyed off `text.props.i18n_default_text`, so these must be real Localize elements.
const item = (type: string, text: string) => ({ type, text: <Localize i18n_default_text={text} /> });

/** Mirrors Rise/Fall: intro, then two video-bearing sections, then a term section. */
const RISE_FALL = [
    item('paragraph', 'Rise/Fall lets you predict…'),
    item('heading', 'Rise'),
    item('paragraph', 'Earn a payout if higher.'),
    { type: 'video', text: 'Rise' },
    item('heading', 'Fall'),
    item('paragraph', 'Earn a payout if lower.'),
    { type: 'video', text: 'Fall' },
    item('heading', 'Allow equals'),
    item('paragraph', 'For Rise, earn if higher or equal.'),
];

// The sections are plain wrappers with no role or text of their own, so the class is the only handle.
// eslint-disable-next-line testing-library/no-node-access
const sections = (container: HTMLElement) => Array.from(container.querySelectorAll('.description__section'));

describe('getContractDescription sections', () => {
    it('[GDS-001] splits at each heading, with the leading copy as its own section', () => {
        const { container } = render(<div>{getContractDescription(RISE_FALL)}</div>);

        // intro, Rise, Fall, Allow equals.
        expect(sections(container)).toHaveLength(4);
    });

    const paired = (container: HTMLElement) =>
        sections(container).filter(node => node.classList.contains('description__section--paired'));

    it('[GDS-002] marks the pair of video sections, which landscape sets side by side', () => {
        const { container } = render(<div>{getContractDescription(RISE_FALL)}</div>);

        expect(paired(container)).toHaveLength(2);
    });

    it('[GDS-004] leaves a lone video section unpaired, so it spans rather than half-filling a row', () => {
        // Accumulators is the one trade type with a single video.
        const accumulators = [
            item('paragraph', 'Accumulators allow you to predict…'),
            item('heading', 'Accumulators'),
            { type: 'video', text: 'Accumulators' },
        ];

        const { container } = render(<div>{getContractDescription(accumulators)}</div>);

        expect(paired(container)).toHaveLength(0);
    });

    it('[GDS-003] renders every item, in order', () => {
        render(<div>{getContractDescription(RISE_FALL)}</div>);

        expect(screen.getByText('Rise/Fall lets you predict…')).toBeInTheDocument();
        expect(screen.getByText('Allow equals')).toBeInTheDocument();
        expect(screen.getByText(/video:Rise/)).toBeInTheDocument();
        expect(screen.getByText(/video:Fall/)).toBeInTheDocument();
    });

    it('[GDS-005] a description with no heading stays one section', () => {
        const { container } = render(<div>{getContractDescription([item('paragraph', 'Only copy.')])}</div>);

        expect(sections(container)).toHaveLength(1);
    });
});
