module.exports = {
    parser: 'postcss-scss',
    plugins: {
        // See packages/core/build/postcss.config.js: logical properties stay native.
        'postcss-preset-env': { features: { 'logical-properties-and-values': false } },
    },
};
