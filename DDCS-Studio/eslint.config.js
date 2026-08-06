// t1567 — a CORRECTNESS check, not a style pass: the one rule that would have caught the drill `items` bug
// (an undeclared variable is valid syntax, so `node --check` cannot see it; there was no linter in this repo
// before this file). Deliberately narrow — only `no-undef`, nothing else. Everything else in this repo's style
// stays whatever it already is; this file does not opine on it.
import globals from 'globals';

export default [
    {
        // t1567 — web/wizards/_svgPreview.bak.js is dead: nothing IMPORTS it (only a comment in wizardManager.js
        // mentions its NAME as a note on where the old SVG-thumbnail code was archived). Excluded so this
        // config reports on code the app actually runs, not an unreachable backup file.
        ignores: [
            'node_modules/**', 'web/vendor/**', 'web/assets/vendor/**', 'test-results/**', 'playwright-report/**',
            'web/wizards/_svgPreview.bak.js',
        ],
    },
    {
        files: ['web/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.es2021,
                // t1567 — the one non-module vendor script (three.min.js is loaded via a plain <script src>, not
                // an ES import — see web/index.html). Declared here (not suppressed) because it IS a real,
                // legitimate reference — the point of this config is to tell no-undef what's genuinely global
                // vs what's a vanished declaration.
                THREE: 'readonly',
            },
        },
        rules: {
            'no-undef': 'error',
        },
    },
    {
        // t1567 — these two files run under Node (data/bmp.js's Buffer fallback is a deliberate dual-environment
        // guard behind `typeof btoa === 'function'`; import_vars.js is a Node CLI script — see its own npm
        // script `generate-vars`). Scoped narrowly so a real `process`/`Buffer` reference in actual BROWSER code
        // elsewhere would still be caught as the bug it would be.
        files: ['web/data/bmp.js', 'web/data/import_vars.js'],
        languageOptions: { globals: { ...globals.node } },
    },
];
