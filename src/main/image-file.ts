import { open } from 'node:fs/promises';
import path from 'node:path';

export type SupportedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export async function verifiedImageMime(
  imagePath: string,
): Promise<SupportedImageMime | null> {
  const handle = await open(imagePath, 'r').catch(() => null);
  if (!handle) {
    return null;
  }
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const detected = detectMime(header.subarray(0, bytesRead));
    return detected && extensionMatches(path.extname(imagePath), detected)
      ? detected
      : null;
  } finally {
    await handle.close();
  }
}

function detectMime(header: Buffer): SupportedImageMime | null {
  if (
    header.length >= 8 &&
    header.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return 'image/png';
  }
  if (
    header.length >= 3 &&
    header[0] === 0xff &&
    header[1] === 0xd8 &&
    header[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    header.length >= 12 &&
    header.subarray(0, 4).toString('ascii') === 'RIFF' &&
    header.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

function extensionMatches(
  extension: string,
  mime: SupportedImageMime,
): boolean {
  const normalized = extension.toLowerCase();
  if (mime === 'image/png') {
    return normalized === '.png';
  }
  if (mime === 'image/jpeg') {
    return normalized === '.jpg' || normalized === '.jpeg';
  }
  return normalized === '.webp';
}
