module.exports = {
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],

  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],

  root: true,

  rules: {
    'comma-dangle': ['warn', 'always-multiline'],
    'indent': ['error', 2],
    'no-tabs': 'warn',
    'no-trailing-spaces': 'warn',
    'prefer-const': 'off',
  },
};
