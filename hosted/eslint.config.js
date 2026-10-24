import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const convexMessage =
  'Payments code cannot import Convex. Persist entitlements through EntitlementStore. The Convex store lives outside this directory.';

const polarMessage = 'Import @polar-sh only from src/payments/adapters/polar.';

const sdkMessage =
  'Import a payment SDK only from that provider adapter. The payments core has no provider SDK.';

const convexRestrictions = {
  paths: [{ name: 'convex', message: convexMessage }],
  patterns: [
    {
      group: ['convex/*', 'convex/**', '@convex-dev/*', '@convex-dev/**'],
      message: convexMessage,
    },
    {
      group: ['**/convex/*', '**/convex/**'],
      message: convexMessage,
    },
  ],
};

const otherSdkRestrictions = {
  paths: [{ name: 'stripe', message: sdkMessage }],
  patterns: [
    {
      group: ['@stripe/*', '@stripe/**', '@paddle/*', '@paddle/**', '@lemonsqueezy/*', '@lemonsqueezy/**'],
      message: sdkMessage,
    },
  ],
};

const polarRestriction = {
  group: ['@polar-sh', '@polar-sh/*', '@polar-sh/**'],
  message: polarMessage,
};

const outsidePayments = {
  paths: otherSdkRestrictions.paths,
  patterns: [...otherSdkRestrictions.patterns, polarRestriction],
};

const paymentsCore = {
  paths: [...convexRestrictions.paths, ...otherSdkRestrictions.paths],
  patterns: [...convexRestrictions.patterns, ...otherSdkRestrictions.patterns, polarRestriction],
};

const polarAdapter = {
  paths: [...convexRestrictions.paths, ...otherSdkRestrictions.paths],
  patterns: [...convexRestrictions.patterns, ...otherSdkRestrictions.patterns],
};

export default tseslint.config(
  {
    ignores: ['node_modules/**'],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/payments/**'],
    rules: {
      'no-restricted-imports': ['error', outsidePayments],
    },
  },
  {
    files: ['src/payments/**/*.ts'],
    ignores: ['src/payments/adapters/polar/**'],
    rules: {
      'no-restricted-imports': ['error', paymentsCore],
    },
  },
  {
    files: ['src/payments/adapters/polar/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', polarAdapter],
    },
  },
);
