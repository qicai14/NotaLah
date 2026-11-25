// Mutation testing for the test cage (#151); run from server/. CI passes `--mutate <changed files>`, the nightly run
// uses the default list. Tests share one Postgres database, so mutants run one at a time.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  vitest: { configFile: 'vite.config.ts' },
  mutator: { excludedMutations: ['StringLiteral'] }, // error-message text is noise here
  mutate: ['src/features/**/*.ts', 'src/lib/**/*.ts', '!src/scripts/**', '!**/*.test.ts'],
  concurrency: 1,
  // Stryker's tsconfig rewrite needs the TypeScript 5 JS API; TypeScript 7 has none. In place needs no rewrite.
  inPlace: true,
  coverageAnalysis: 'perTest',
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',
  reporters: ['clear-text', 'json'],
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  thresholds: { high: 80, low: 60, break: 50 },
  ignorePatterns: ['reports', 'coverage', 'dist'],
};
