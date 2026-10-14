import { describe, expect, it } from 'vitest';
import type { User } from '../types';
import { isApprovedLecturer } from './roles';

const user = (over: Partial<User>): User => ({
  id: 1,
  email: 'a@b.c',
  displayName: 'A',
  role: 'student',
  status: 'active',
  lecturerStatus: null,
  programme: null,
  ...over,
});

describe('isApprovedLecturer', () => {
  it('CLI-TC13: only an approved lecturer passes', () => {
    expect(isApprovedLecturer(user({ role: 'lecturer', lecturerStatus: 'approved' }))).toBe(true);
    expect(isApprovedLecturer(user({ role: 'lecturer', lecturerStatus: 'pending' }))).toBe(false);
    expect(isApprovedLecturer(user({ role: 'lecturer', lecturerStatus: 'rejected' }))).toBe(false);
    expect(isApprovedLecturer(user({ role: 'student', lecturerStatus: 'approved' }))).toBe(false);
    expect(isApprovedLecturer(user({ role: 'admin' }))).toBe(false);
    expect(isApprovedLecturer(null)).toBe(false);
    expect(isApprovedLecturer(undefined)).toBe(false);
  });
});
