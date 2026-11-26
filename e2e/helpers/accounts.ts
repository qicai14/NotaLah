import { defaultUatPassword, type UatRole } from '../../server/src/scripts/uat/data';

// Seeded by server/src/scripts/uat/data.ts (#82). Password is UAT_PASSWORD, else `${role}123`.
export const ACCOUNTS = {
  admin: 'admin@gmail.com',
  lecturer: 'aisha@gmail.com',
  student1: 'daniel@gmail.com',
  student2: 'priya@gmail.com',
  student3: 'weijie@gmail.com',
} as const;

export const passwordFor = (who: keyof typeof ACCOUNTS): string =>
  process.env.UAT_PASSWORD ?? defaultUatPassword(who.replace(/\d+$/, '') as UatRole);

export const MODULE_CODE = 'UAT101-3-2';
export const SEED_HASHTAG = 'uat';
