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
}
interface Probe {
  format: { format_name?: string; duration?: string };
  streams: Stream[];
}

const probe = async (file: string, timeoutMs: number) =>
  JSON.parse(
    await runTool(
      'ffprobe',
      ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file],
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
    const seconds = Number(found.format.duration);
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Rejected('Not a valid video');
    if (seconds > VIDEO.maxSeconds) throw new Rejected(`Video must be at most ${VIDEO.maxSeconds} seconds`);
    if (Math.max(video.width, video.height) > VIDEO.maxInputEdge) throw new Rejected('Video dimensions are too large');

    const oversize = video.width > VIDEO.maxWidth || video.height > VIDEO.maxHeight;
    const ext = isMp4 ? 'mp4' : 'webm';
    const out = path.join(workDir, `clean.${ext}`);
    const copyVideo =
      !oversize &&
      (isMp4
        ? video.codec_name === 'h264' && video.pix_fmt === 'yuv420p'
        : ['vp8', 'vp9'].includes(video.codec_name ?? ''));
    const copyAudio = !audio || audio.codec_name === (isMp4 ? 'aac' : 'opus');
    const args = ['-v', 'error', '-y', '-i', input, '-map', '0:v:0', '-map', '0:a:0?'];
    args.push('-map_metadata', '-1', '-map_chapters', '-1', '-fflags', '+bitexact', '-threads', '2');
    if (copyVideo) args.push('-c:v', 'copy');
    else {
      const fit = `scale=${VIDEO.maxWidth}:${VIDEO.maxHeight}:force_original_aspect_ratio=decrease:force_divisible_by=2`;
      args.push('-vf', fit);
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
    const cleaned = (await probe(out, timeoutMs)).streams.find((s) => s.codec_type === 'video');
    if (!cleaned?.width || !cleaned.height) throw new Rejected('Not a valid video');

    const frame = path.join(workDir, 'poster.png');
    const at = String(Math.min(1, seconds / 2));
    await runTool('ffmpeg', ['-v', 'error', '-y', '-ss', at, '-i', out, '-frames:v', '1', frame], timeoutMs);
    const poster = await reencodeImage(await readFile(frame));
    if (!poster.ok) throw new Rejected('Could not read a frame from the video');

    return {
      ok: true,
      video: {
        file: out,
        mime: isMp4 ? 'video/mp4' : 'video/webm',
        ext,
        bytes: size,
        width: cleaned.width,
        height: cleaned.height,
        durationMs: Math.min(Math.max(1, Math.round(seconds * 1000)), VIDEO.maxSeconds * 1000),
        poster: poster.image.data,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Rejected ? err.message : 'Not a valid video' };
  }
}
