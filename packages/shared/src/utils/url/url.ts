import { getDocumentsUrl, getTrustedDomainName } from '../brand';
import { routes } from '../routes';

let location_url: Location, default_language: string;

export const urlForLanguage = (lang: string, url: string = window.location.href) => {
    const current_url = new URL(url);

    if (lang === 'EN') {
        current_url.searchParams.delete('lang');
    } else {
        current_url.searchParams.set('lang', lang);
    }

    return `${current_url}`;
};

export const reset = () => {
    location_url = window?.location ?? location_url;
};

export const params = (href?: string | URL) => {
    const arr_params = [];
    const parsed = ((href ? new URL(href) : location_url).search || '').substr(1).split('&');
    let p_l = parsed.length;
    while (p_l--) {
        const param = parsed[p_l].split('=');
        arr_params.push(param);
    }
    return arr_params;
};

/**
 * @deprecated Please use 'URLUtils.normalizePath' from '@deriv-com/utils' instead of this.
 */
const normalizePath = (path: string) => (path ? path.replace(/(^\/|\/$|[^a-zA-Z0-9-_./()#])/g, '') : '');

export const getUrlBase = (path = '') => {
    const l = window.location;

    if (!/^\/(br_)/.test(l.pathname)) return path;

    return `/${l.pathname.split('/')[1]}${/^\//.test(path) ? path : `/${path}`}`;
};

export const removeBranchName = (path = '') => {
    return path.replace(/^\/br_.*?\//, '/');
};

export const setUrlLanguage = (lang: string) => {
    default_language = lang;
};

// TODO: cleanup options param usage
// eslint-disable-next-line no-unused-vars
/**
 * @deprecated Please use 'URLUtils.getDerivStaticURL' from '@deriv-com/utils' instead of this.
 */
export const getStaticUrl = (path = '', is_document = false) => {
    // Documents (T&C PDFs and other legal files) are served from the docs subdomain.
    // The content site only 301-redirects there, and that redirect is not reachable
    // everywhere, so build the link on the documents host directly.
    if (is_document) return `${getDocumentsUrl()}/${normalizePath(path)}`;

    // Static content (T&C, help centre, responsible trading, etc.) is served from the deriv.com
    // content site — NOT the home dashboard returned by getBrandUrl() (e.g. home.deriv.com/dashboard).
    // Build the host from the current brand domain so links resolve on deriv.com/.be/.me.
    const host = `https://${getTrustedDomainName()}`;
    let lang = default_language?.toLowerCase();

    if (lang && lang !== 'en') {
        lang = `/${lang}`;
    } else {
        lang = '';
    }

    // Deriv.com supports languages separated by '-' not '_'
    if (lang.includes('_')) {
        lang = lang.replace('_', '-');
    }

    return `${host}${lang}/${normalizePath(path)}`;
};

export const getPath = (route_path: string, parameters = {}) =>
    Object.keys(parameters).reduce(
        (p, name) => p.replace(`:${name}`, parameters[name as keyof typeof parameters]),
        route_path
    );

export const getContractPath = (contract_id?: number) => getPath(routes.contract, { contract_id });

/**
 * Filters query string. Returns filtered query (without '/?')
 * @param {string} search_param window.location.search
 * @param {Array<string>} allowed_keys array of string of allowed query string keys
 */
export const filterUrlQuery = (search_param: string, allowed_keys: string[]) => {
    const search_params = new URLSearchParams(search_param);
    const filtered_queries = [...search_params].filter(kvp => allowed_keys.includes(kvp[0]));
    return new URLSearchParams(filtered_queries || '').toString();
};
