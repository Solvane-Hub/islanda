import next from 'eslint-config-next';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Islanda ESLint configuration.
 *
 * Beyond standard linting, this config MECHANICALLY ENFORCES the layer boundaries
 * defined in Platform Architecture and Engineering Standards. These are not
 * conventions people must remember — they are build failures.
 *
 *   app/         → services/ → lib/db/        (never app/ → lib/db/ directly)
 *   lib/ai/      ✗ lib/db/, ✗ services/       (Eng. Standards §8: AI never writes)
 *   components/  ✗ services/, ✗ lib/db/       (Frontend Arch: no business logic in UI)
 */
const config = [
  ...next,
  prettier,
  {
    // Flat config requires a plugin to be registered in the same object that
    // uses its rules.
    files: ['**/*.{ts,tsx}'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx,mjs}'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Presentation layer must not reach past the services layer.
    files: ['app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/db', '@/lib/db/*'],
              message:
                'Layer violation: app/ must not query the database directly. Route through services/ (Platform Architecture — Application Services owns all business logic and writes).',
            },
          ],
        },
      ],
    },
  },
  {
    // Engineering Standards §8 — AI agents never access the database.
    files: ['lib/ai/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/db', '@/lib/db/*', '@/services', '@/services/*'],
              message:
                'Layer violation: AI agents must never access the database or services. Agents return validated JSON; Application Services perform all writes (Engineering Standards §8).',
            },
          ],
        },
      ],
    },
  },
  {
    // Frontend Architecture — the frontend holds no business logic.
    files: ['components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/services', '@/services/*', '@/lib/db', '@/lib/db/*'],
              message:
                'Layer violation: components/ is presentation only. Data must be passed in as props from a Server Component in app/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}', 'scripts/**/*.ts'],
    rules: { 'no-console': 'off', 'no-restricted-imports': 'off' },
  },
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
];

export default config;
