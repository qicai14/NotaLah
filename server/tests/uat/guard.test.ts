import { describe, expect, it } from 'vite-plus/test';
import { assertTestDatabase } from '../../src/scripts/uat/guard';

describe('UAT reset database guard (OPS-TC27)', () => {
  it.each(['notalah', 'notalah_dev', 'xnotalah_test', 'notalah_test-x', 'notalah_testing'])(
    'OPS-TC27: refuses %s',
    (name) => {
      expect(() => assertTestDatabase(name)).toThrow(/Refusing to reset/);
    },
  );
  it.each(['notalah_test', 'notalah_test_81'])('OPS-TC27: accepts %s', (name) => {
    expect(() => assertTestDatabase(name)).not.toThrow();
  });
});
