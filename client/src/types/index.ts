export interface ModuleRef {
  id: number;
  code: string;
  name: string;
}

export interface Slide {
  position: number;
  content: string;
}

export type Role = 'student' | 'lecturer' | 'admin';
export type UserStatus = 'active' | 'restricted' | 'suspended' | 'deleted';
export type LecturerStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: number;
  email: string;
  displayName: string;
  role: Role;
  status: UserStatus;
  lecturerStatus: LecturerStatus | null;
  programme: string | null;
}

export interface AdminUser extends Pick<User, 'id' | 'displayName' | 'email' | 'role' | 'status' | 'lecturerStatus'> {
  upheldReports: number;
  createdAt: string;
}

export type Visibility = 'public' | 'contacts';

export interface Note {
  id: number;
  title: string;
  template: string;
  status: 'draft' | 'published' | 'hidden' | 'deleted';
  visibility: Visibility | null;
  module: ModuleRef | null;
  hashtags: string[];
  slides: Slide[];
  author: { id: number; displayName: string; role: Role; isVerifiedLecturer: boolean };
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  counts: { likes: number; comments: number };
  liked: boolean;
  bookmarked: boolean;
  verified: boolean;
  /** Earliest lecturer whose Super Like counts; null when unverified. */
  verifiedBy: string | null;
  /** The viewer has Super Liked this note. */
  verifiedByMe: boolean;
}

export interface FeedPage {
  items: Note[];
  nextPage: number | null;
  asOf: string;
}

export interface DraftSummary {
  id: number;
  title: string;
  module: ModuleRef | null;
  hashtags: string[];
  updatedAt: string;
}

export interface NoteSummary {
  id: number;
  title: string;
  moduleCode: string | null;
  publishedAt: string | null;
  hashtags: string[];
  verifiedBy: string | null;
  savedAt?: string;
}

export interface CommentReply {
  id: number;
  slideNo: number | null;
  body: string;
  createdAt: string;
  author: { id: number; displayName: string; isVerifiedLecturer: boolean } | null;
  likes: number;
  likedByMe: boolean;
}

export interface Comment extends CommentReply {
  pinned: boolean;
  replies: CommentReply[];
}

export interface ReportGroup extends Omit<Note, 'counts' | 'liked' | 'bookmarked' | 'verified' | 'verifiedBy' | 'verifiedByMe'> {
  reportCount: number;
  oldestReportAt: string;
  reports: { id: number; reason: string; details: string | null; reporter: string; createdAt: string }[];
}

export interface Profile {
  id: number;
  displayName: string;
  role: Role;
  programme: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isVerifiedLecturer: boolean;
  notes: NoteSummary[];
  draftCount?: number;
}

export interface LecturerApplication {
  id: number;
  displayName: string;
  email: string;
  staffId: string | null;
  programme: string | null;
  createdAt: string;
}
