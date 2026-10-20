import type { Aspect, Fill, SlideElement } from '@notalah/shared';

export interface ModuleRef {
  id: number;
  code: string;
  name: string;
}

export interface Slide {
  position: number;
  background: Fill;
  elements: SlideElement[];
  /** Private page notes; only sent to the author and edit collaborators. */
  notes?: string;
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

/** A video's place in the upload pipeline (R40); only a ready one has a file. */
export type VideoStatus = 'processing' | 'ready' | 'failed';

/** A Jamendo track as the music search returns it (R9). */
export interface MusicTrack {
  id: number;
  title: string;
  artist: string;
  cover: string;
  licenseUrl: string;
  duration: number;
  audioUrl: string;
}

export interface Note {
  id: number;
  title: string;
  theme: string;
  aspect: Aspect;
  music: {
    trackId: number;
    title: string | null;
    artist: string | null;
    cover: string | null;
    licenseUrl: string | null;
    volume: number;
  } | null;
  assets: Record<string, string>;
  /** Every video the note uses, by asset id. */
  videoStatus: Record<string, VideoStatus>;
  status: 'draft' | 'published' | 'hidden' | 'deleted';
  visibility: Visibility | null;
  module: ModuleRef | null;
  hashtags: string[];
  /** A feed card carries only the first slides; this is the note's full count (D71). */
  slideCount: number;
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
  /** Edit collaborators who have saved a change (R30); the owner is `author`. */
  coauthors?: CollabPerson[];
  /** A title or slide edit came after the verification, so it no longer counts (R30). Only on notes the viewer can read. */
  editedSinceVerification?: boolean;
  /** The viewer's role on this note; only sent by GET /notes/:id. */
  myRole?: NoteRole | null;
}

export interface CollabPerson {
  id: number;
  displayName: string;
}

export type CollabRole = 'view' | 'edit';
export type NoteRole = 'owner' | CollabRole;

/** GET /notes/:id/access (owner only): who can reach the note and by which route. Link tokens are never included. */
export interface NoteAccess {
  collaborators: { user: CollabPerson; role: CollabRole; addedAt: string }[];
  links: { role: CollabRole; createdAt: string }[];
  requests: { id: number; user: CollabPerson; message: string | null; createdAt: string }[];
}

/** The four ranking scores, each 0 to 1 (IR 2.3.4): engagement, recency, lecturer validation, hashtag match. */
export interface RankingComponents {
  E: number;
  R: number;
  V: number;
  M: number;
}

/** A Feed item carries its score; Following items are chronological and carry none. */
export interface FeedNote extends Note {
  score?: number;
  components?: RankingComponents;
}

/** The server's ranking weights (RANKING.weights): the score is the sum of each component times its weight. */
export interface RankingWeights {
  engagement: number;
  recency: number;
  lecturerValidation: number;
  relevance: number;
}

export interface FeedPage {
  items: FeedNote[];
  nextPage: number | null;
  asOf: string;
  weights: RankingWeights;
}

export interface FollowingPage {
  items: Note[];
  nextCursor: string | null;
  asOf: string;
}

export interface DraftSummary {
  id: number;
  title: string;
  module: ModuleRef | null;
  hashtags: string[];
  updatedAt: string;
  aspect: Aspect;
  slideCount: number;
  /** First slide for the thumbnail; null for a draft with no slides yet. */
  cover: Pick<Slide, 'background' | 'elements'> | null;
  assets: Record<string, string>;
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

export interface ReportGroup extends Omit<
  Note,
  'counts' | 'liked' | 'bookmarked' | 'verified' | 'verifiedBy' | 'verifiedByMe'
> {
  reportCount: number;
  oldestReportAt: string;
  reports: { id: number; reason: string; details: string | null; reporter: string; createdAt: string }[];
}

/** A row of the report queue: the review panel fetches the full ReportGroup on open. */
export type ReportSummary = Pick<
  ReportGroup,
  'id' | 'title' | 'status' | 'module' | 'reportCount' | 'oldestReportAt' | 'reports'
> & {
  author: Pick<ReportGroup['author'], 'id' | 'displayName'>;
};

/** A tile on a profile: the summary plus the first slide, drawn as the thumbnail. */
export interface ProfileNote extends NoteSummary {
  aspect: Aspect;
  likes: number;
  cover: Pick<Slide, 'background' | 'elements'> | null;
  assets: Record<string, string>;
}

export interface Profile {
  id: number;
  displayName: string;
  role: Role;
  programme: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isVerifiedLecturer: boolean;
  followerCount: number;
  followingCount: number;
  followedByMe: boolean;
  followsMe: boolean;
  /** Mutual follow (D38). */
  isFriend: boolean;
  likeCount: number;
  blockedByMe: false;
  notes: ProfileNote[];
  notesNextCursor: string | null;
  draftCount?: number;
}

/** What the server returns for someone the viewer blocked (D49, wireframe 34). */
export interface BlockedProfile {
  id: number;
  displayName: string;
  blockedByMe: true;
}

export type FollowState = Pick<Profile, 'followerCount' | 'followingCount' | 'followedByMe' | 'followsMe' | 'isFriend'>;

export interface PersonRow {
  id: number;
  displayName: string;
  role: Role;
  isVerifiedLecturer: boolean;
  followedByMe: boolean;
  isFriend: boolean;
}

export interface BlockedUser {
  id: number;
  displayName: string;
  blockedAt: string;
}

export interface LecturerApplication {
  id: number;
  displayName: string;
  email: string;
  staffId: string | null;
  programme: string | null;
  createdAt: string;
}
