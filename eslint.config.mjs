import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
    {
        files: ['**/*.ts'],
    },
    {
        plugins: {
            '@typescript-eslint': typescriptEslint,
            'unused-imports': unusedImports,
        },

        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: 'module',
        },

        rules: {
            '@typescript-eslint/naming-convention': [
                'warn',
                {
                    selector: 'import',
                    format: ['camelCase', 'PascalCase'],
                },
            ],

            // Remove unused imports
            'no-unused-vars': 'off', // Turn off the base rule
            '@typescript-eslint/no-unused-vars': 'off', // Turn off TypeScript's rule
            'unused-imports/no-unused-imports': 'error', // Error on unused imports
            'unused-imports/no-unused-vars': [
                'warn',
                { 
                    vars: 'all', 
                    varsIgnorePattern: '^_', 
                    args: 'after-used', 
                    argsIgnorePattern: '^_' 
                }
            ],

            curly: 'warn',
            eqeqeq: 'warn',
            'no-throw-literal': 'warn',
            semi: 'warn',
        },
    },
    eslintConfigPrettier,
];
