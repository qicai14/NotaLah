/** Architecture rules (ADR 0110, #153). Run by `vp run check`. */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular imports hide layering mistakes and break lazy loading.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'client-not-server',
      severity: 'error',
      comment: 'The client talks to the API over HTTP only (ADR 0102).',
      from: { path: '^client/' },
      to: { path: '^server/' },
    },
    {
      name: 'server-not-client',
      severity: 'error',
      from: { path: '^server/' },
      to: { path: '^client/' },
    },
    {
      name: 'shared-is-a-leaf',
      severity: 'error',
      comment: 'shared/ is used by both sides, so it may not import either (ADR 0106).',
      from: { path: '^shared/' },
      to: { path: '^(client|server)/' },
    },
    {
      name: 'no-test-code-in-production',
      severity: 'error',
      from: { path: '^(client|server|shared)/src', pathNot: '(.test.|^server/tests/)' },
      to: { path: '(.test.[cm]?[jt]sx?$|^server/tests/|^e2e/)' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|coverage|reports|.stryker-tmp)/' },
    tsConfig: { fileName: 'tsconfig.depcruise.json' },
    parser: 'swc',
  },
};
