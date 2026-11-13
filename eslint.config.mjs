// SPDX-License-Identifier: MIT
import stylistic from '@stylistic/eslint-plugin'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

const RUN_AT_ONCE = {
  selector: "CallExpression[callee.name='runAfter'][arguments.1.value=0]",
  message: 'Run work at once with runDetached of timedWork.ts, which states why it is detached.',
}

export default defineConfig({
  files: ['hooks/**/*.ts', 'hooks/**/*.tsx', 'types/**/*.ts'],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
  },
  linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
  plugins: { '@stylistic': stylistic, '@typescript-eslint': tseslint.plugin },
  rules: {
    '@stylistic/max-len': ['error', { code: 100 }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-declaration-merging': 'error',
    '@typescript-eslint/no-unsafe-enum-comparison': 'error',
    '@typescript-eslint/no-unsafe-function-type': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unsafe-type-assertion': 'error',
    '@typescript-eslint/no-unsafe-unary-minus': 'error',
    '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: false }],
    '@typescript-eslint/no-unused-vars': 'error',
    'no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 0 }],
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            regex: '(^|/)register$',
            message:
              'register.tsx is the composition root and imports every feature. Import what it ' +
              'shares from a module of its own, such as everyEvent.',
          },
        ],
      },
    ],
  },
}, {
  files: ['hooks/**/*.ts', 'hooks/**/*.tsx'],
  ignores: ['hooks/timedWork.ts'],
  rules: { 'no-restricted-syntax': ['error', RUN_AT_ONCE] },
})
