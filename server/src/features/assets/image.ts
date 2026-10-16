import sharp from 'sharp';
import { ASSETS, IMAGE_FORMATS } from './config';

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
}

export type ImageResult = { ok: true; image: ProcessedImage } | { ok: false; error: string };

/**
 * Decodes the upload with libvips, so the format comes from the bytes and not the filename or MIME header, then
 * auto-rotates, scales the longest edge down to the cap and re-encodes as WebP. sharp drops EXIF, GPS and ICC data
 * unless asked to keep it, and reads only the first frame of a GIF.
 */
export async function reencodeImage(input: Buffer): Promise<ImageResult> {
  try {
    const source = sharp(input, { limitInputPixels: ASSETS.maxInputPixels });
    const { format } = await source.metadata();
    if (!IMAGE_FORMATS.has(format)) return { ok: false, error: 'Only JPEG, PNG, WebP and GIF images are accepted' };
    const { data, info } = await source
      .rotate()
      .resize({ width: ASSETS.maxEdge, height: ASSETS.maxEdge, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: ASSETS.webpQuality })
      .toBuffer({ resolveWithObject: true });
    return { ok: true, image: { data, width: info.width, height: info.height } };
  } catch (err) {
    const tooLarge = err instanceof Error && /pixel limit/i.test(err.message);
    return { ok: false, error: tooLarge ? 'Image dimensions are too large' : 'Not a valid image' };
  }
}
