import globals from 'globals';
import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                PRODUCTS: 'readonly',
                CATEGORIES: 'readonly',
                SIZE_GUIDES: 'readonly',
                ProductAPI: 'readonly',
                CartState: 'readonly',
                LaVagueAPI: 'readonly',
                LoadingManager: 'readonly',
                Toast: 'readonly',
                Validator: 'readonly',
                CurrencyConfig: 'readonly',
                SwaggerUIBundle: 'readonly',
                SwaggerUIStandalonePreset: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': [
                'warn',
                {
                    vars: 'all',
                    args: 'after-used',
                    ignoreRestSiblings: true,
                    caughtErrors: 'none'
                }
            ],
            'no-undef': 'error',
            'no-debugger': 'warn',
            eqeqeq: ['error', 'always', { null: 'ignore' }],
            'no-var': 'warn',
            'prefer-const': 'warn',
            'no-throw-literal': 'error'
        }
    },
    {
        files: ['sw.js'],
        languageOptions: {
            globals: {
                ...globals.serviceworker
            }
        }
    },
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'database.sqlite',
            '*.min.js',
            '.git/**'
        ]
    }
];
