import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { VIDEO, type VideoProfile } from './config';
import { reencodeImage } from './image';

export interface ProcessedVideo {
  /** Path of the cleaned file inside the work directory. */
  file: string;
  bytes: number;
  width: number;
  height: number;
  durationMs: number;
  poster: Buffer;
}

export type VideoResult = { ok: true; video: ProcessedVideo } | { ok: false; error: string };

class Rejected extends Error {}

/** execFile takes an argument array (no shell) and kills the child on timeout. */
export function runTool(cmd: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, windowsHide: true }, (err, stdout) => {
      if (!err) return resolve(stdout);
      reject(new Rejected(err.killed ? 'Video processing took too long' : 'Not a valid video'));
    });
  });
}

interface Stream {
  codec_type: string;
  codec_name?: string;
  pix_fmt?: string;
  width?: number;
  height?: number;
  tags?: { rotate?: string };
  side_data_list?: { rotation?: number }[];
}
interface Probe {
  format: { format_name?: string; duration?: string };
  streams: Stream[];
}

/** Input options for every ffprobe and ffmpeg call: local files and the five containers we accept, so a playlist or concat file cannot make the tools open URLs or other files (SSRF, local reads). */
const SAFE_INPUT = ['-protocol_whitelist', 'file', '-format_whitelist', 'mov,mp4,m4a,3gp,3g2,mj2,matroska,webm'];

/** Width and height as a viewer sees them: a quarter turn in the display matrix swaps them. */
function displayed(s: Stream): { w: number; h: number } {
  const turn = s.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? Number(s.tags?.rotate ?? 0);
  const quarter = Math.abs(Math.round(turn / 90)) % 2 === 1;
  return quarter ? { w: s.height!, h: s.width! } : { w: s.width!, h: s.height! };
}

const probe = async (file: string, timeoutMs: number) =>
  JSON.parse(
    await runTool(
      'ffprobe',
      ['-v', 'error', ...SAFE_INPUT, '-print_format', 'json', '-show_format', '-show_streams', `file:${file}`],
      timeoutMs,
    ),
  ) as Probe;

interface Inspected {
  video: Stream;
  audio: Stream | undefined;
  isMp4: boolean;
  /** Width and height as displayed. */
  w: number;
  h: number;
  /** From the header; browser-recorded WebM has none. */
  durationMs: number | null;
}

/** Checks the container from the bytes with ffprobe, never the filename or MIME header, against the size, length and edge limits. */
async function inspect(file: string, timeoutMs: number): Promise<Inspected> {
  const found = await probe(file, timeoutMs);
  const video = found.streams.find((s) => s.codec_type === 'video');
  const audio = found.streams.find((s) => s.codec_type === 'audio');
  const names = (found.format.format_name ?? '').split(',');
  // MOV shares the mp4 demuxer and Matroska the webm one, so both pass here; the output is always MP4.
  const isMp4 = names.includes('mp4');
  if (!video?.width || !video.height || (!isMp4 && !names.includes('webm'))) {
    throw new Rejected('Only MP4 and WebM videos are accepted');
  }
  // Only a present duration can reject here; -t caps the rest.
  const declared = Number(found.format.duration);
  if (Number.isFinite(declared) && declared > VIDEO.maxSeconds) {
    throw new Rejected(`Video must be at most ${VIDEO.maxSeconds} seconds`);
  }
  if (Math.max(video.width, video.height) > VIDEO.maxInputEdge) throw new Rejected('Video dimensions are too large');
  const { w, h } = displayed(video);
  const durationMs = Number.isFinite(declared) && declared > 0 ? Math.max(1, Math.round(declared * 1000)) : null;
  return { video, audio, isMp4, w, h, durationMs };
}

/** The upload-time check (R40): ffprobe only, so the request returns before any encoding. */
export async function inspectVideo(
  file: string,
): Promise<{ ok: true; width: number; height: number; durationMs: number | null } | { ok: false; error: string }> {
  try {
    const { w, h, durationMs } = await inspect(file, VIDEO.toolTimeoutMs);
    return { ok: true, width: w, height: h, durationMs };
  } catch (err) {
    return { ok: false, error: err instanceof Rejected ? err.message : 'Not a valid video' };
  }
}

export interface EncodePlan {
  copyVideo: boolean;
  copyAudio: boolean;
  /** The scale box (width, height) for a re-encode, turned to match a portrait input. */
  box: [number, number];
}

/** Stream-copy a browser-ready H.264 MP4 that fits the profile's box; re-encode anything else into it (R40, D67). */
export function planEncode(
  { video, audio, isMp4, w, h }: Pick<Inspected, 'video' | 'audio' | 'isMp4' | 'w' | 'h'>,
  profile: Pick<VideoProfile, 'maxWidth' | 'maxHeight'>,
): EncodePlan {
  const fits = Math.max(w, h) <= profile.maxWidth && Math.min(w, h) <= profile.maxHeight;
  return {
    copyVideo: fits && isMp4 && video.codec_name === 'h264' && video.pix_fmt === 'yuv420p',
    copyAudio: !audio || audio.codec_name === 'aac',
    box: w < h ? [profile.maxHeight, profile.maxWidth] : [profile.maxWidth, profile.maxHeight],
  };
}

/**
 * The worker's step (R29, R40): checks the file again, then writes a cleaned H.264/AAC MP4 inside the profile's box:
 * first video and audio stream only, no metadata or chapters, streams that already comply copied rather than
 * re-encoded. Also returns a WebP poster frame (D59, D67).
 */
export async function processVideo(
  input: string,
  workDir: string,
  { profile, timeoutMs = VIDEO.encodeTimeoutMs }: { profile: VideoProfile; timeoutMs?: number },
): Promise<VideoResult> {
  try {
    const found = await inspect(input, timeoutMs);
    const plan = planEncode(found, profile);
    const out = path.join(workDir, 'clean.mp4');
    const args = ['-v', 'error', '-y', '-threads', '2', '-filter_threads', '1', ...SAFE_INPUT, '-i', `file:${input}`];
    args.push('-map', '0:v:0', '-map', '0:a:0?', '-t', String(VIDEO.maxSeconds));
    args.push('-map_metadata', '-1', '-map_chapters', '-1', '-fflags', '+bitexact', '-threads', '2');
    if (plan.copyVideo) args.push('-c:v', 'copy');
    else {
      args.push('-vf', `scale=${plan.box[0]}:${plan.box[1]}:force_original_aspect_ratio=decrease:force_divisible_by=2`);
      args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast');
    }
    args.push('-c:a', plan.copyAudio ? 'copy' : 'aac', '-movflags', '+faststart');
    await runTool('ffmpeg', [...args, out], timeoutMs);

    const { size } = await stat(out);
    if (size > VIDEO.maxBytes) throw new Rejected('Video is still over 50 MB after processing');
    const result = await probe(out, timeoutMs);
    const cleaned = result.streams.find((s) => s.codec_type === 'video');
    const seconds = Number(result.format.duration);
    if (!cleaned?.width || !cleaned.height || !Number.isFinite(seconds) || seconds <= 0) {
      throw new Rejected('Not a valid video');
    }
    const shown = displayed(cleaned);

    const frame = path.join(workDir, 'poster.png');
    const at = seconds >= 2 ? '1' : '0';
    await runTool(
      'ffmpeg',
      ['-v', 'error', '-y', '-ss', at, ...SAFE_INPUT, '-i', `file:${out}`, '-frames:v', '1', frame],
      timeoutMs,
    );
    const poster = await reencodeImage(await readFile(frame));
    if (!poster.ok) throw new Rejected('Could not read a frame from the video');

    return {
      ok: true,
      video: {
        file: out,
        bytes: size,
        width: shown.w,
        height: shown.h,
        durationMs: Math.min(Math.max(1, Math.round(seconds * 1000)), VIDEO.maxSeconds * 1000),
        poster: poster.image.data,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Rejected ? err.message : 'Not a valid video' };
  }
}
