let static_hash;
const getStaticHash = () => {
    static_hash =
        static_hash || (document.querySelector('script[src*="main"]').getAttribute('src') || '').split('.')[1];
    return static_hash;
};

// TODO: [duplicate_code] - Move this to shared package
// eu countries to support
const eu_countries = [
    'it',
    'de',
    'fr',
    'lu',
    'gr',
    'mf',
    'es',
    'sk',
    'lt',
    'nl',
    'at',
    'bg',
    'si',
    'cy',
    'be',
    'ro',
    'hr',
    'pt',
    'pl',
    'lv',
    'ee',
    'cz',
    'fi',
    'hu',
    'dk',
    'se',
    'ie',
    'im',
    'gb',
    'mt',
];
// TODO: [duplicate_code] - Move this to shared package
// check if client is from EU
const isEuCountry = country => eu_countries.includes(country);

const getRegion = (landing_company_shortcode, residence) => {
    if (landing_company_shortcode === 'virtual') {
        return isEuCountry(residence) ? 'eu' : 'row';
    }
    return landing_company_shortcode === 'svg' ? 'row' : 'eu';
};

module.exports = {
    getStaticHash,
    isEuCountry,
    getRegion,
};
