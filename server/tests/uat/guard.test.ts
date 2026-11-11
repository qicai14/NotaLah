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
  it('OPS-TC27: UAT_RESET_DATABASE must equal the exact name and is ignored in production', () => {
    expect(() => assertTestDatabase('notalah', 'notalah')).not.toThrow();
    expect(() => assertTestDatabase('notalah', 'notalah_dev')).toThrow(/Refusing to reset/);
    expect(() => assertTestDatabase('notalah', undefined)).toThrow(/Refusing to reset/);
    const saved = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => assertTestDatabase('notalah', 'notalah')).toThrow(/Refusing to reset/);
    } finally {
      process.env.NODE_ENV = saved;
    }
  });
});
