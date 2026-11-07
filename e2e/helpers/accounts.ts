import { DEFAULT_UAT_PASSWORD } from '../../server/src/scripts/uat/data';

// Seeded by server/src/scripts/uat/data.ts (#82). Password is UAT_PASSWORD or the seed default.
export const PASSWORD = process.env.UAT_PASSWORD ?? DEFAULT_UAT_PASSWORD;

export const ACCOUNTS = {
  admin: 'uat.admin@mail.apu.edu.my',
  lecturer: 'uat.lecturer@mail.apu.edu.my',
  student1: 'uat.student1@mail.apu.edu.my',
  student2: 'uat.student2@mail.apu.edu.my',
  student3: 'uat.student3@mail.apu.edu.my',
} as const;

export const MODULE_CODE = 'UAT101-3-2';
export const SEED_HASHTAG = 'uat';
