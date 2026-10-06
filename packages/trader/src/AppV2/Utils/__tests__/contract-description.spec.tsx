import React from 'react';

import { Localize } from '@deriv-com/translations';
import { render, screen } from '@testing-library/react';

import {
    DESCRIPTION_VIDEO_IDS,
    getContractDescription,
    getDescriptionVideoIds,
    getTerm,
    getTermDefinition,
} from '../contract-description-utils';
import { CONTRACT_LIST } from '../trade-types-utils';

jest.mock('@deriv/stores', () => ({
    ...jest.requireActual('@deriv/stores'),
    useStore: () => ({ ui: { is_dark_mode_on: false } }),
}));

jest.mock('@lottiefiles/dotlottie-react', () => ({
    DotLottieReact: jest.fn(() => <div>DotLottieReact</div>),
}));

describe('getTermDefinition', () => {
    it('should return undefined if contract_type or term are undefined', () => {
        expect(getTermDefinition({ contract_type: undefined, term: undefined })).toBeUndefined();
        expect(getTermDefinition({ contract_type: undefined, term: getTerm().GROWTH_RATE })).toBeUndefined();
        expect(getTermDefinition({ contract_type: CONTRACT_LIST.ACCUMULATORS, term: undefined })).toBeUndefined();
    });

    it('should return correct definition for passed term and contract type', () => {
        render(
            <div>{getTermDefinition({ contract_type: CONTRACT_LIST.ACCUMULATORS, term: getTerm().GROWTH_RATE })}</div>
        );

        expect(
            screen.getByText(
                'The growth rate determines the rate at which your stake will grow with each successful tick.'
            )
        ).toBeInTheDocument();
    });

    it('should return specific for Vanillas definition for passed term "contract value"', () => {
        render(
            <div>{getTermDefinition({ contract_type: CONTRACT_LIST.VANILLAS, term: getTerm().CONTRACT_VALUE })}</div>
        );

        expect(screen.getByText(/We’ll offer to buy your contract at this price/i)).toBeInTheDocument();
    });

    it('should return default definition for passed term "contract value" if contract type is not Vanillas', () => {
        render(<div>{getTermDefinition({ contract_type: CONTRACT_LIST.TURBOS, term: getTerm().CONTRACT_VALUE })}</div>);

        expect(screen.getByText(/his is the resale value of your contract, based on/i)).toBeInTheDocument();
    });

    it('should return specific for Vanillas definition for passed term "payout"', () => {
        render(<div>{getTermDefinition({ contract_type: CONTRACT_LIST.VANILLAS, term: getTerm().PAYOUT })}</div>);

        expect(screen.getByText(/Your payout is equal/i)).toBeInTheDocument();
    });

    it('should return specific for Turbos definition for passed term "payout"', () => {
        render(<div>{getTermDefinition({ contract_type: CONTRACT_LIST.TURBOS, term: getTerm().PAYOUT })}</div>);

        expect(screen.getByText(/The payout at expiry is equal to/i)).toBeInTheDocument();
    });

    it('should return default definition for passed term "payout" if contract type is not Vanillas or Turbos', () => {
        render(<div>{getTermDefinition({ contract_type: CONTRACT_LIST.ACCUMULATORS, term: getTerm().PAYOUT })}</div>);

        expect(screen.getByText(/Payout is the sum of your initial stake and profit/i)).toBeInTheDocument();
    });

    it('should return specific for Vanillas definition for passed term "payout per point"', () => {
        render(
            <div>{getTermDefinition({ contract_type: CONTRACT_LIST.VANILLAS, term: getTerm().PAYOUT_PER_POINT })}</div>
        );

        expect(screen.getByText(/We calculate this based on/i)).toBeInTheDocument();
    });

    it('should return default definition for passed term "payout per point" if contract type is not Vanillas', () => {
        render(
            <div>{getTermDefinition({ contract_type: CONTRACT_LIST.TURBOS, term: getTerm().PAYOUT_PER_POINT })}</div>
        );

        expect(screen.getByText(/The amount you choose to receive at expiry/i)).toBeInTheDocument();
    });

    it('should return specific for Accumulators definition for passed term "slippage risk"', () => {
        render(
            <div>{getTermDefinition({ contract_type: CONTRACT_LIST.ACCUMULATORS, term: getTerm().SLIPPAGE_RISK })}</div>
        );

        expect(
            screen.getByText(/The spot price may change by the time your order reaches our servers/i)
        ).toBeInTheDocument();
    });

    it('should return default definition for passed term "slippage risk" if contract type is not Accumulators', () => {
        render(<div>{getTermDefinition({ contract_type: CONTRACT_LIST.TURBOS, term: getTerm().SLIPPAGE_RISK })}</div>);

        expect(screen.getByText(/Slippage happens when the asset price changes by the time/i)).toBeInTheDocument();
    });

    it('should return empty string if there is no match with object keys', () => {
        expect(getTermDefinition({ contract_type: CONTRACT_LIST.ACCUMULATORS, term: 'mock' })).toBe('');
    });
});

describe('getContractDescription', () => {
    const mock_content = [
        { type: 'heading', text: <Localize i18n_default_text='Even' /> },
        {
            type: 'paragraph',
            text: (
                <Localize i18n_default_text='If you select “Even”, you will win the payout if the last digit of the last tick is an even number (i.e. 2, 4, 6, 8, or 0).' />
            ),
        },
        { type: 'general', text: <Localize i18n_default_text='Some general text' /> },
        {
            type: 'video',
            text: CONTRACT_LIST.ACCUMULATORS,
        },
    ];

    // The layout tests read the returned sections without rendering, so plain items are enough.
    const paragraph = (text: string) => ({ type: 'paragraph', text: <p>{text}</p> });
    const heading = (text: string) => ({ type: 'heading', text: <h4>{text}</h4> });
    const video = { type: 'video', text: CONTRACT_LIST.MULTIPLIERS };
    const layoutOf = (content: Parameters<typeof getContractDescription>[0]) =>
        getContractDescription(content).map(({ props: { className, children } }) => ({
            paired: className.includes('description__section--paired'),
            items: React.Children.count(children),
        }));

    it('should parse passed content', () => {
        render(<div>{getContractDescription(mock_content)}</div>);

        expect(screen.getByText(/If you select “Even”/i)).toBeInTheDocument();
        expect(screen.getByText(/Some general text/i)).toBeInTheDocument();
    });

    it('sets copy after the second video of a pair full width, not under that video alone', () => {
        // Multipliers' shape: the shared explanation runs on after the "Down" video with no heading.
        const content = [
            paragraph('Intro'),
            heading('Up'),
            paragraph('Up copy'),
            video,
            heading('Down'),
            paragraph('Down copy'),
            video,
            paragraph('Shared copy'),
            paragraph('More shared copy'),
        ];

        expect(layoutOf(content)).toEqual([
            { paired: false, items: 1 },
            { paired: true, items: 3 },
            { paired: true, items: 3 },
            { paired: false, items: 2 },
        ]);
    });

    it('leaves a single-video description as one section, since nothing is paired', () => {
        // Accumulators' shape: splitting here would only add a grid gap under the video.
        const content = [paragraph('Intro'), video, paragraph('After the video')];

        expect(layoutOf(content)).toEqual([{ paired: false, items: 3 }]);
    });
});

describe('DESCRIPTION_VIDEO_IDS', () => {
    it('should return an id for Vanillas description video in light theme', () => {
        expect(getDescriptionVideoIds(CONTRACT_LIST.VANILLAS, false)).toEqual(
            DESCRIPTION_VIDEO_IDS[CONTRACT_LIST.VANILLAS].light
        );
    });
    it('should return an id for Accumulator description video in light theme', () => {
        expect(getDescriptionVideoIds(CONTRACT_LIST.ACCUMULATORS, false)).toEqual(
            DESCRIPTION_VIDEO_IDS[CONTRACT_LIST.ACCUMULATORS].light
        );
    });
    it('should return an id for High/Low description video in light theme', () => {
        expect(getDescriptionVideoIds(CONTRACT_LIST.HIGHER_LOWER, false)).toEqual(
            DESCRIPTION_VIDEO_IDS[CONTRACT_LIST.HIGHER_LOWER].light
        );
    });
    it('should return an id for Matches/Differs description video in light theme', () => {
        expect(getDescriptionVideoIds(CONTRACT_LIST.MATCHES_DIFFERS, false)).toEqual(
            DESCRIPTION_VIDEO_IDS[CONTRACT_LIST.MATCHES_DIFFERS].light
        );
    });
    it('should return an id for Over/Under description video in light theme', () => {
        expect(getDescriptionVideoIds(CONTRACT_LIST.OVER_UNDER, false)).toEqual(
            DESCRIPTION_VIDEO_IDS[CONTRACT_LIST.OVER_UNDER].light
        );
    });
    it('should return an id for Rise/Fall description video in light theme', () => {
        expect(getDescriptionVideoIds(CONTRACT_LIST.RISE_FALL, false)).toEqual(
            DESCRIPTION_VIDEO_IDS[CONTRACT_LIST.RISE_FALL].light
        );
    });
    it('should return an id for Multipliers description video in dark theme', () => {
        expect(getDescriptionVideoIds(CONTRACT_LIST.MULTIPLIERS, true)).toEqual(
            DESCRIPTION_VIDEO_IDS[CONTRACT_LIST.MULTIPLIERS].dark
        );
    });
    it('should return an id for Touch/No Touch description video in light theme', () => {
        expect(getDescriptionVideoIds(CONTRACT_LIST.TOUCH_NO_TOUCH, false)).toEqual(
            DESCRIPTION_VIDEO_IDS[CONTRACT_LIST.TOUCH_NO_TOUCH].light
        );
    });
    it('should return an id for Even/Odd description video in dark theme', () => {
        expect(getDescriptionVideoIds(CONTRACT_LIST.EVEN_ODD, true)).toEqual(
            DESCRIPTION_VIDEO_IDS[CONTRACT_LIST.EVEN_ODD].dark
        );
    });
    it('should return an id for Turbos description video in dark theme', () => {
        expect(getDescriptionVideoIds(CONTRACT_LIST.TURBOS, true)).toEqual(
            DESCRIPTION_VIDEO_IDS[CONTRACT_LIST.TURBOS].dark
        );
    });
    it('should return undefined when called with empty arguments', () => {
        expect(getDescriptionVideoIds()).toEqual(undefined);
    });
});
