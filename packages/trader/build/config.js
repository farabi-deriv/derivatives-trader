const path = require('path');
const stylelintFormatter = require('stylelint-formatter-pretty');

const cssConfig = () => ({
    filename: 'trader/css/trader.main.[contenthash].css',
    chunkFilename: 'trader/css/trader.[name].[contenthash].css',
});

const stylelintConfig = () => ({
    configFile: path.resolve(__dirname, '../.stylelintrc.js'),
    formatter: stylelintFormatter,
    files: 'sass/**/*.s?(a|c)ss',
    failOnError: false, // Even though it's false, it will fail on error, and we need this to be false to display trace
});

module.exports = {
    cssConfig,
    stylelintConfig,
};
