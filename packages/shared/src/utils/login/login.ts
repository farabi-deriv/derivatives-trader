import { getBrandUrl, getRedirectHostname } from '../brand';

export const getLoginUrl = (language?: string) => {
    const brandUrl = getBrandUrl();
    // getRedirectHostname() returns the hostname only when it is a known brand domain,
    const platformHostname = getRedirectHostname();
    const lang_param = language ? `?lang=${encodeURIComponent(language)}` : '';
    const redirect_param = platformHostname
        ? `${lang_param ? '&' : '?'}redirect=${encodeURIComponent(platformHostname)}`
        : '';

    return `${brandUrl}/login${lang_param}${redirect_param}`;
};

export const getSignUpUrl = (language?: string) => {
    const lang_param = language ? `?lang=${encodeURIComponent(language)}` : '';

    return `${getBrandUrl()}/signup${lang_param}`;
};

export const redirectToLogin = (language?: string) => {
    window.location.href = getLoginUrl(language);
};

export const redirectToSignUp = (language?: string) => {
    window.location.href = getSignUpUrl(language);
};
