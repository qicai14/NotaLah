export interface ModuleRef {
  id: number;
  code: string;
  name: string;
}

export interface Slide {
  position: number;
  content: string;
}

export type Visibility = 'public' | 'contacts';

/** A note as GET /api/notes/:id and the feed return it. */
export interface Note {
  id: number;
  title: string;
  template: string;
  status: 'draft' | 'published' | 'hidden' | 'deleted';
  visibility: Visibility | null;
  module: ModuleRef | null;
  hashtags: string[];
  slides: Slide[];
  author: { id: number; displayName: string; role: string; isVerifiedLecturer: boolean };
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface FeedItem extends Note {
  counts: { likes: number; comments: number };
  liked: boolean;
  bookmarked: boolean;
  verified: boolean;
}

export interface FeedPage {
  items: FeedItem[];
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

/** Light note row used by profiles and the saved list. */
export interface NoteSummary {
  id: number;
  title: string;
  moduleCode: string | null;
  publishedAt: string | null;
  hashtags: string[];
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

export interface Profile {
  id: number;
  displayName: string;
  role: string;
  programme: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isVerifiedLecturer: boolean;
  notes: NoteSummary[];
  draftCount?: number;
}
