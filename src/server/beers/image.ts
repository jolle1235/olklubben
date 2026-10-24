import "server-only";

import sharp from "sharp";

/**
 * A beer photo from the form → what beer_images stores (SPEC §9.5, D-158):
 * turned upright by its EXIF orientation, at most 1200 × 1200 px, WebP
 * quality 80, and no metadata (sharp drops EXIF, so a phone's GPS position
 * never reaches the database). Only JPEG, PNG, WebP, AVIF and GIF are read;
 * anything else is BeerImageError (shown at the field, in Danish).
 *
 * beerThumbnail() makes the list cards' small copy from the stored photo.
 */

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_SIDE = 1200;
/** Twice the card's 56 px, for sharp screens. */
const THUMB_SIDE = 112;
const READABLE_FORMATS = new Set(["jpeg", "png", "webp", "avif", "gif"]);

export type ProcessedBeerImage = { data: Uint8Array<ArrayBuffer>; width: number; height: number };

export class BeerImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BeerImageError";
  }
}

export async function processBeerImage(file: File): Promise<ProcessedBeerImage> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new BeerImageError("Billedet er for stort (højst 4 MB).");
  }
  const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 50_000_000 });
  try {
    const { format } = await image.metadata();
    if (!format || !READABLE_FORMATS.has(format)) throw new Error(`format ${format}`);
    const { data, info } = await image
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    return { data: new Uint8Array(data), width: info.width, height: info.height };
  } catch {
    throw new BeerImageError("Billedet kunne ikke læses. Brug et JPG- eller PNG-billede.");
  }
}

/** A square WebP thumbnail of a stored photo (cropped to the centre). */
export async function beerThumbnail(stored: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const data = await sharp(stored)
    .resize({ width: THUMB_SIDE, height: THUMB_SIDE, fit: "cover" })
    .webp({ quality: 75 })
    .toBuffer();
  return new Uint8Array(data);
}
