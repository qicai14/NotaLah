import type { User } from '../types';

export const isApprovedLecturer = (user: User | null | undefined): boolean =>
  user?.role === 'lecturer' && user.lecturerStatus === 'approved';
