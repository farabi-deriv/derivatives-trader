module.exports = {
    parser: 'postcss-scss',
    plugins: [
        {
            'postcss-preset-env': {
                // Keep logical properties native. Converted, they become paired [dir="ltr"]/[dir="rtl"] rules, and Arabic
                // on desktop and phone landscape (html rtl, body ltr — see AppContent) matches both: left and right at once.
                features: { 'logical-properties-and-values': false },
            },
        },
        // Custom PostCSS plugin to remove external @import statements
        {
            postcssPlugin: 'remove-external-imports',
            Once(root) {
                root.walkAtRules('import', rule => {
                    // Extract URL from @import statement (handles both quoted and url() syntax)
                    let importValue = rule.params.replace(/^['"]/, '').replace(/['"]$/, '');
                    importValue = importValue.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');

                    // Remove @import for external URLs (http://, https://, //)
                    if (/^https?:\/\//.test(importValue) || importValue.startsWith('//')) {
                        rule.remove();
                    }
                });
            },
        },
    ],
};
