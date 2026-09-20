import globals from 'globals';
import js from '@eslint/js';

const browserAppGlobals = {
    CATEGORIES: 'readonly',
    SIZE_GUIDES: 'readonly',
    ProductAPI: 'readonly',
    CartState: 'readonly',
    LaVagueAPI: 'readonly',
    LoadingManager: 'readonly',
    Toast: 'readonly',
    Validator: 'readonly',
    CurrencyConfig: 'readonly',
    InputMasks: 'readonly',
    FormValidation: 'readonly',
    ButtonState: 'readonly',
    SearchHelper: 'readonly',
    initRevealAnimations: 'readonly',
    Sentry: 'readonly',
    SwaggerUIBundle: 'readonly',
    SwaggerUIStandalonePreset: 'readonly',

    // Classic-script admin actions are attached to window and referenced by
    // DOM listeners created by the admin dashboard.
    viewOrder: 'readonly',
    saveOrderStatus: 'readonly',
    editProduct: 'readonly',
    deleteProduct: 'readonly',
    editInventory: 'readonly',
    closeProductModal: 'readonly',
    removeImage: 'readonly',
    removeColor: 'readonly',
    removeSize: 'readonly',
    updateInventoryValue: 'readonly',
    closeInventoryModal: 'readonly',
    viewCustomer: 'readonly'
};

const testGlobals = {
    describe: 'readonly',
    it: 'readonly',
    test: 'readonly',
    expect: 'readonly',
    beforeAll: 'readonly',
    afterAll: 'readonly',
    beforeEach: 'readonly',
    afterEach: 'readonly',
    vi: 'readonly'
};

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                ...browserAppGlobals
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
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-useless-escape': 'warn',
            eqeqeq: ['error', 'always', { null: 'ignore' }],
            'no-var': 'warn',
            'prefer-const': 'warn',
            'no-throw-literal': 'error'
        }
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                ...testGlobals,
                ...browserAppGlobals
            }
        }
    },
    {
        files: ['public/sw.js'],
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
            '**/*.d.ts',
            'database.sqlite',
            '*.min.js',
            '.git/**'
        ]
    }
];
