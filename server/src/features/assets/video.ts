import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { VIDEO } from './config';
import { reencodeImage } from './image';

export interface ProcessedVideo {
  /** Path of the cleaned file inside the work directory. */
  file: string;
  mime: 'video/mp4' | 'video/webm';
  ext: 'mp4' | 'webm';
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

/**
 * Checks the container from the bytes with ffprobe, never the filename or MIME header, then writes a cleaned copy:
 * first video and audio stream only, no metadata or chapters, H.264/AAC MP4 or VP9/Opus WebM, at most 1080p. Streams
 * that already comply are copied, not re-encoded. Also returns a WebP poster frame (R29, D59).
 */
export async function processVideo(
  input: string,
  workDir: string,
  timeoutMs: number = VIDEO.toolTimeoutMs,
): Promise<VideoResult> {
  try {
    const found = await probe(input, timeoutMs);
    const video = found.streams.find((s) => s.codec_type === 'video');
    const audio = found.streams.find((s) => s.codec_type === 'audio');
    const names = (found.format.format_name ?? '').split(',');
    // Matroska and WebM share a demuxer name, so a Matroska file passes here and leaves as WebM.
    const isMp4 = names.includes('mp4');
    if (!video?.width || !video.height || (!isMp4 && !names.includes('webm'))) {
      throw new Rejected('Only MP4 and WebM videos are accepted');
    }
    // Browser-recorded WebM has no duration in the header, so only a present duration can reject here; -t caps the rest.
    const declared = Number(found.format.duration);
    if (Number.isFinite(declared) && declared > VIDEO.maxSeconds) {
      throw new Rejected(`Video must be at most ${VIDEO.maxSeconds} seconds`);
    }
    if (Math.max(video.width, video.height) > VIDEO.maxInputEdge) throw new Rejected('Video dimensions are too large');

    const { w, h } = displayed(video);
    const longEdge = Math.max(w, h);
    const shortEdge = Math.min(w, h);
    const oversize = longEdge > VIDEO.maxWidth || shortEdge > VIDEO.maxHeight;
    const ext = isMp4 ? 'mp4' : 'webm';
    const out = path.join(workDir, `clean.${ext}`);
    const copyVideo =
      !oversize &&
      (isMp4
        ? video.codec_name === 'h264' && video.pix_fmt === 'yuv420p'
        : ['vp8', 'vp9'].includes(video.codec_name ?? ''));
    const copyAudio = !audio || audio.codec_name === (isMp4 ? 'aac' : 'opus');
    const args = ['-v', 'error', '-y', '-threads', '2', '-filter_threads', '1', ...SAFE_INPUT, '-i', `file:${input}`];
    args.push('-map', '0:v:0', '-map', '0:a:0?', '-t', String(VIDEO.maxSeconds));
    args.push('-map_metadata', '-1', '-map_chapters', '-1', '-fflags', '+bitexact', '-threads', '2');
    if (copyVideo) args.push('-c:v', 'copy');
    else {
      const box = w < h ? [VIDEO.maxHeight, VIDEO.maxWidth] : [VIDEO.maxWidth, VIDEO.maxHeight];
      args.push('-vf', `scale=${box[0]}:${box[1]}:force_original_aspect_ratio=decrease:force_divisible_by=2`);
      args.push(
        ...(isMp4
          ? ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast']
          : ['-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8', '-row-mt', '1']),
      );
    }
    args.push('-c:a', copyAudio ? 'copy' : isMp4 ? 'aac' : 'libopus');
    if (isMp4) args.push('-movflags', '+faststart');
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
        mime: isMp4 ? 'video/mp4' : 'video/webm',
        ext,
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
