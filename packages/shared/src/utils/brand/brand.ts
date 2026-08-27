// eslint-disable-next-line import/no-relative-packages
import config_data from '../../../../../brand.config.json';
import { appendLangParam } from '../url/helpers';

export const getBrandDomains = (): readonly string[] => {
    return config_data.brand_domains;
};

export const getBrandName = () => {
    return config_data.brand_name;
};

export const getBrandLogo = () => {
    return config_data.brand_logo;
};

/**
 * Runtime production check based on window.location.hostname.
 */
export const isProduction = (): boolean => {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname;
    return (config_data.brand_domains as string[]).some(domain => {
        const pattern = new RegExp(`^(www\\.)?(beta-)?dtrader\\.${domain.replaceAll('.', '\\.')}$`, 'i');
        return pattern.test(hostname);
    });
};

export const getBrandHostname = () => {
    const hostname = isProduction() ? config_data.brand_hostname.production : config_data.brand_hostname.staging;
    return substituteDerivDomain(hostname);
};

export const getBrandUrl = () => {
    const hostname = isProduction() ? config_data.brand_hostname.production : config_data.brand_hostname.staging;
    return `https://${substituteDerivDomain(hostname)}`;
};

/**
 * Host that serves legal documents (T&C PDFs, key information documents, etc.).
 * These live on the docs subdomain — the content site only 301-redirects there —
 * so link straight to it instead of relying on the redirect.
 */
export const getDocumentsUrl = () => {
    return `https://${substituteDerivDomain(config_data.documents_hostname)}`;
};

export const getBrandHomeUrl = (language?: string) => {
    const baseUrl = `${getBrandUrl()}/home`;
    return appendLangParam(baseUrl, language);
};

export const getBrandLoginUrl = (language?: string) => {
    const baseUrl = `${getBrandUrl()}/login`;
    return appendLangParam(baseUrl, language);
};

export const getBrandSignupUrl = (language?: string) => {
    const baseUrl = `${getBrandUrl()}/signup`;
    return appendLangParam(baseUrl, language);
};

export const getPlatformName = () => {
    return config_data.platform.name;
};

export const getPlatformLogo = () => {
    return config_data.platform.logo;
};

export const getDomainName = () => {
    if (typeof window === 'undefined') return '';
    const hostname = window.location.hostname;
    if (!hostname) return '';
    // Split the hostname into parts
    const domainParts = hostname.split('.');

    // Ensure we have at least two parts (SLD and TLD)
    if (domainParts.length >= 2) {
        // Combine the SLD and TLD
        const domain = `${domainParts[domainParts.length - 2]}.${domainParts[domainParts.length - 1]}`;
        return domain;
    }

    return '';
};

/**
 * Replaces "deriv.com" in a URL with the current domain (e.g. deriv.be, deriv.me).
 * Returns the URL unchanged when running on localhost or an unrecognised hostname.
 */
const substituteDerivDomain = (url: string): string => {
    const domain = getDomainName();
    if (!domain || !(config_data.brand_domains as string[]).includes(domain)) return url;
    try {
        // Parse the URL so we only rewrite the hostname — not query params or path segments
        const parsed = new URL(url);
        parsed.hostname = parsed.hostname.replace(/deriv\.com$/, domain);
        return parsed.toString();
    } catch {
        // Fallback for non-absolute strings (e.g. "api-core.deriv.com", "home.deriv.com/dashboard")
        return url.replace(/deriv\.com/, domain);
    }
};

/**
 * Returns the current TLD (e.g. "deriv.be") only when it is a known brand domain.
 * Falls back to "deriv.com" on unrecognised hostnames to keep cookies on a trusted domain.
 */
export const getTrustedDomainName = (): string => {
    const domain = getDomainName();
    return (config_data.brand_domains as string[]).includes(domain) ? domain : 'deriv.com';
};

/**
 * Returns window.location.hostname for use as an OAuth redirect parameter,
 * but only if the current hostname belongs to a known brand domain or a
 * recognised Cloudflare Pages preview deployment.
 * Returns empty string on unrecognised hostnames to prevent open-redirect
 * attacks where an attacker-controlled copy of the app injects a redirect
 * back to their domain after authentication.
 */
const CLOUDFLARE_PAGES_PATTERN = /^[a-zA-Z0-9-]+\.derivatives-trader\.pages\.dev$/;
export const getRedirectHostname = (): string => {
    if (typeof window === 'undefined') return '';
    const hostname = window.location.hostname;
    const domain = getDomainName();
    if ((config_data.brand_domains as string[]).includes(domain)) return hostname;
    if (CLOUDFLARE_PAGES_PATTERN.test(hostname)) return hostname;
    return '';
};

/**
 * Gets the WebSocket server URL with base path
 * @returns WebSocket server URL with base path (e.g., "staging-api-core.deriv.com/options/v1/ws")
 */
export const getWebSocketURL = (): string => {
    const base = isProduction() ? config_data.api_core.production : config_data.api_core.staging;
    return `${substituteDerivDomain(base)}/options/v1/ws`;
};

/**
 * Gets the whoami endpoint URL
 * @returns Whoami endpoint URL (e.g., "https://auth.deriv.com/sessions/whoami")
 */
export const getWhoAmIURL = (): string => {
    const base = isProduction() ? config_data.auth.production : config_data.auth.staging;
    return substituteDerivDomain(`${base}/sessions/whoami`);
};

/**
 * Gets the logout endpoint URL
 * @returns Logout endpoint URL (e.g., "https://auth.deriv.com/self-service/logout/browser")
 */
export const getLogoutURL = (): string => {
    const base = isProduction() ? config_data.auth.production : config_data.auth.staging;
    return substituteDerivDomain(`${base}/self-service/logout/browser`);
};

/**
 * Gets the API Core URL based on environment
 * @returns API Core base URL (without protocol)
 */
export const getApiCoreUrl = (): string => {
    const url = isProduction() ? config_data.api_core.production : config_data.api_core.staging;
    return substituteDerivDomain(url);
};

/**
 * Gets the full API Core URL with protocol
 * @returns Full API Core URL with https://
 */
export const getApiCoreBaseUrl = (): string => {
    return `https://${getApiCoreUrl()}`;
};

/**
 * Gets the API URL for account_list based on environment
 * @returns API base URL (without protocol), e.g. "api.deriv.be"
 */
export const getApiUrl = (): string => {
    const url = isProduction() ? config_data.api.production : config_data.api.staging;
    return substituteDerivDomain(url);
};

/**
 * Gets the full API URL for account_list with protocol
 * @returns Full API URL with https://, e.g. "https://api.deriv.be"
 */
export const getApiBaseUrl = (): string => {
    return `https://${getApiUrl()}`;
};

/**
 * Gets the Help Centre URL on the deriv.com content site, which owns the
 * regional information architecture and routes its own visitors between the
 * global (/help-centre/) and EU (/eu/helpcentre/) help centres. Linking it
 * directly — rather than via the former trade.deriv.com hop, which discarded
 * that decision — keeps EU/non-EU routing delegated to the content site.
 * @returns Help Centre URL (e.g., "https://deriv.com/helpcentre/deriv-trader")
 */
export const getHelpCentreUrl = (): string => {
    return substituteDerivDomain(config_data.platform.help_centre_url);
};
