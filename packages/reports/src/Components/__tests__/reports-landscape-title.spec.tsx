import React from 'react';
import { MemoryRouter, Route } from 'react-router-dom';

import { routes } from '@deriv/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ReportsLandscapeTitle from '../reports-landscape-title';

let current_path = '';

const renderAt = (pathname: string) => {
    current_path = pathname;
    render(
        <MemoryRouter initialEntries={[pathname]}>
            <ReportsLandscapeTitle />
            <Route
                path='*'
                render={({ location }) => {
                    current_path = location.pathname;
                    return null;
                }}
            />
        </MemoryRouter>
    );
};

describe('ReportsLandscapeTitle', () => {
    it('[RLT-001] offers only Trade table and Statement — positions lives in the nav rail', async () => {
        renderAt(routes.profit);

        await userEvent.click(screen.getByText('Trade table'));

        expect(screen.getByText('Statement')).toBeInTheDocument();
        expect(screen.queryByText('Open positions')).not.toBeInTheDocument();
    });

    it('[RLT-002] routes to the page picked from the chip', async () => {
        renderAt(routes.profit);

        await userEvent.click(screen.getByText('Trade table'));
        await userEvent.click(screen.getByText('Statement'));

        expect(current_path).toBe(routes.statement);
    });

    it('[RLT-003] renders the page heading', () => {
        renderAt(routes.statement);

        expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument();
    });
});
