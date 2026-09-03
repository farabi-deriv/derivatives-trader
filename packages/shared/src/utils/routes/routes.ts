export const routes = {
    // Essential routes
    index: '/',
    unavailable: '/unavailable',
    endpoint: '/endpoint',

    // Trading routes
    menu: '/menu',
    trader_positions: '/positions',
    trader_automate: '/automate',
    contract: '/contract/:contract_id',

    // Reports routes
    reports: '/reports',
    positions: '/reports/positions',
    profit: '/reports/profit',
    statement: '/reports/statement',
    archived_statement: '/reports/archived-statement',
};

export const DISABLE_LANDSCAPE_BLOCKER_ROUTES = [
    routes.index,
    routes.reports,
    routes.endpoint,
    routes.trader_automate,
    /** because contract route has dynamic id */
    '/contract',
];

export const isDisabledLandscapeBlockerRoute = (path: string) => {
    // Root path is now the trade page
    if (path === '/') return true;
    return DISABLE_LANDSCAPE_BLOCKER_ROUTES.some(route => path.startsWith(route));
};
