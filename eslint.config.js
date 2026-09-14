const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['android/**', 'node_modules/**', 'patches/**', '.expo/**'],
  },
  {
    files: ['__tests__/**/*.ts'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['scripts/**/*.js', 'jest.setup.js', 'jest.config.js', '__mocks__/**/*.js'],
    languageOptions: {
      globals: {
        require: 'readonly',
        module: 'writable',
        process: 'readonly',
        __dirname: 'readonly',
        jest: 'readonly',
      },
    },
  },
];
