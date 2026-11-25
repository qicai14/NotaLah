import type { Aspect, MusicRef, Slide } from '@notalah/shared';
import type { TrackMeta } from '../music/service';

export interface NoteInput {
  title: string;
  theme: string;
  aspect: Aspect;
  slides: Slide[];
  music: MusicRef | null;
  /** Set by the route when the track is new or has no details yet: a Jamendo lookup, or null when Jamendo could not answer. Absent means keep what is stored. */
  musicMeta?: TrackMeta | null;
  moduleId: number | null;
  hashtags: string[];
  status: 'draft' | 'published';
  visibility: 'public' | 'contacts' | null;
  aiAssisted?: boolean;
}
