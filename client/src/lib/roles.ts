import type { User } from '../types';

export const isApprovedLecturer = (user: User | null | undefined): user is User =>
  user?.role === 'lecturer' && user.lecturerStatus === 'approved';
