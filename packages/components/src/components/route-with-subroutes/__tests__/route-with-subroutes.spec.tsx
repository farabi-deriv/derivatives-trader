import React from 'react';

import { act, render, screen } from '@testing-library/react';

import { RouteWithSubRoutesRender as RouteWithSubRoutes } from '../route-with-subroutes';

type TRenderProps = {
    location: {
        pathname: string;
    };
};
type TMockRoute = {
    path: string;
    render?: (props: TRenderProps) => React.ReactNode;
};

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    Route: jest.fn(({ path, render }: TMockRoute) => (
        <div>
            <span>{`path param: ${path}`}</span>
            {render?.({ location: { pathname: path } })}
        </div>
    )),
    Redirect: jest.fn(({ to }: { to: string }) => <div>{`Redirect to: ${to}`}</div>),
}));

// `requireActual` resolves through moduleNameMapper to __mocks__/translation.mock.js — the very
// module the component under test consumes — whereas `requireMock` would auto-mock it away.
const { fireLanguageChanged } = jest.requireActual('@deriv-com/translations') as {
    fireLanguageChanged: (lang?: string) => void;
};

const TestPage = () => <div>Test Page</div>;

const route_props = {
    component: TestPage,
    exact: true,
    is_logged_in: true,
    is_logging_in: false,
    path: '/test-path',
    routes: [],
    to: '',
    language: 'EN',
    Component404: () => <div>404</div>,
    should_redirect_login: false,
};

describe('<RouteWithSubRoutes />', () => {
    beforeEach(() => {
        document.title = '';
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { pathname: '/test-path' },
        });
    });

    it('sets the document title of the matched route on mount', () => {
        render(<RouteWithSubRoutes {...route_props} getTitle={() => 'Trade'} />);

        expect(screen.getByText('Test Page')).toBeInTheDocument();
        expect(document.title).toBe('Trade | Deriv');
    });

    it('re-derives the document title once a language change completes', () => {
        const getTitle = jest.fn(() => 'Trade');
        render(<RouteWithSubRoutes {...route_props} getTitle={getTitle} />);

        expect(document.title).toBe('Trade | Deriv');

        getTitle.mockReturnValue('Échanger');
        act(() => fireLanguageChanged('FR'));

        expect(document.title).toBe('Échanger | Deriv');
    });

    it('resolves nested routes to the innermost title, before and after a language change', () => {
        const getOuterTitle = jest.fn(() => 'Reports');
        const getInnerTitle = jest.fn(() => 'Statement');

        const InnerRoute = () => <RouteWithSubRoutes {...route_props} getTitle={getInnerTitle} />;

        render(<RouteWithSubRoutes {...route_props} component={InnerRoute} getTitle={getOuterTitle} />);

        expect(document.title).toBe('Statement | Deriv');

        getOuterTitle.mockReturnValue('Rapports');
        getInnerTitle.mockReturnValue('Relevé de compte');
        act(() => fireLanguageChanged('FR'));

        expect(document.title).toBe('Relevé de compte | Deriv');
    });
});
