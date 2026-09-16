import js from '@eslint/js';
import globals from 'globals';

export default [
	{
		ignores: [
			'node_modules/**',
			'working/**',
			'logs/**',
			'dist/**'
		]
	},
	js.configs.recommended,
	{
		files: ['**/*.js'],
		languageOptions: {
			ecmaVersion: 2023,
			sourceType: 'module',
			globals: {
				...globals.node
			}
		},
		rules: {
			// action and service methods share a common signature; not every
			// implementation uses every parameter.
			'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
			'no-empty': ['error', { allowEmptyCatch: true }]
		}
	}
];
