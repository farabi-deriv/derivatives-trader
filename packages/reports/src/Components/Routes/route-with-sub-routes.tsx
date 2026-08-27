import React from 'react';
import { RouteComponentProps } from 'react-router';
import { Redirect, Route } from 'react-router-dom';

import { useDocumentTitle } from '@deriv/components';
import { isEmptyObject, removeBranchName, routes } from '@deriv/shared';

import type { TBinaryRoutes, TRoute } from 'Types';

type TRouteWithSubRoutes = TRoute & TBinaryRoutes;

const RouteWithSubRoutes = (route: TRouteWithSubRoutes) => {
    useDocumentTitle(route.getTitle);

    const renderFactory = (props: RouteComponentProps) => {
        let result = null;
        if (route.component === Redirect) {
            let to = route.to;

            // This if clause has been added just to remove '/index' from url in localhost env.
            if (route.path === routes.index) {
                const { location } = props;
                to = location.pathname.toLowerCase().replace(route.path, '');
            }
            result = <Redirect to={to} />;
        } else {
            const default_subroute = route.routes ? route.routes.find(r => r.default) : { path: '' };
            const has_default_subroute = !isEmptyObject(default_subroute);
            const pathname = removeBranchName(location.pathname);

            const RouteComponent = route.component as React.ElementType;

            result = (
                <React.Fragment>
                    {has_default_subroute && pathname === route.path && <Redirect to={default_subroute?.path} />}
                    <RouteComponent {...props} routes={route.routes} />
                </React.Fragment>
            );
        }

        return result;
    };

    return <Route exact={route.exact} path={route.path} render={renderFactory} />;
};

export default RouteWithSubRoutes;
