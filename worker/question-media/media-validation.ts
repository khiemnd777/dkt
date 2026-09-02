import { AppError } from "../../shared/errors";
import { LIMITS } from "../../shared/limits";

export interface ValidatedImage {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function validateDimensions(width: number, height: number): void {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > LIMITS.maxQuestionImageDimension ||
    height > LIMITS.maxQuestionImageDimension
  ) {
    throw new AppError("QUESTION_MEDIA_INVALID", 400);
  }
}

function png(bytes: Uint8Array): ValidatedImage {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (signature.some((value, index) => bytes[index] !== value) || bytes.length < 33) {
    throw new AppError("QUESTION_MEDIA_INVALID", 400);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  validateDimensions(width, height);
  let offset = 8;
  let sawEnd = false;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = ascii(bytes, offset + 4, 4);
    if (length > bytes.length - offset - 12) throw new AppError("QUESTION_MEDIA_INVALID", 400);
    if (["acTL", "eXIf", "iTXt", "tEXt", "zTXt"].includes(type)) {
      throw new AppError("QUESTION_MEDIA_INVALID", 400);
    }
    offset += 12 + length;
    if (type === "IEND") {
      sawEnd = true;
      break;
    }
  }
  if (!sawEnd) throw new AppError("QUESTION_MEDIA_INVALID", 400);
  return { bytes, mimeType: "image/png", width, height };
}

function jpeg(bytes: Uint8Array): ValidatedImage {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new AppError("QUESTION_MEDIA_INVALID", 400);
  }
  const retained: Uint8Array[] = [bytes.slice(0, 2)];
  let width = 0;
  let height = 0;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) throw new AppError("QUESTION_MEDIA_INVALID", 400);
    const markerStart = offset;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9) {
      retained.push(bytes.slice(markerStart, offset));
      break;
    }
    if (marker === 0xda) {
      retained.push(bytes.slice(markerStart));
      offset = bytes.length;
      break;
    }
    if (offset + 2 > bytes.length) throw new AppError("QUESTION_MEDIA_INVALID", 400);
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length)
      throw new AppError("QUESTION_MEDIA_INVALID", 400);
    const end = offset + length;
    const isStartOfFrame = [
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
    ].includes(marker);
    if (isStartOfFrame) {
      if (length < 7) throw new AppError("QUESTION_MEDIA_INVALID", 400);
      height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      width = (bytes[offset + 5] << 8) | bytes[offset + 6];
    }
    const containsMetadata = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!containsMetadata) retained.push(bytes.slice(markerStart, end));
    offset = end;
  }
  validateDimensions(width, height);
  const size = retained.reduce((total, part) => total + part.length, 0);
  const sanitized = new Uint8Array(size);
  let cursor = 0;
  for (const part of retained) {
    sanitized.set(part, cursor);
    cursor += part.length;
  }
  return { bytes: sanitized, mimeType: "image/jpeg", width, height };
}

function little24(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function webp(bytes: Uint8Array): ValidatedImage {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") {
    throw new AppError("QUESTION_MEDIA_INVALID", 400);
  }
  let offset = 12;
  let width = 0;
  let height = 0;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, 4);
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0, true);
    const data = offset + 8;
    if (data + size > bytes.length) throw new AppError("QUESTION_MEDIA_INVALID", 400);
    if (type === "ANIM" || type === "ANMF" || type === "EXIF" || type === "XMP ") {
      throw new AppError("QUESTION_MEDIA_INVALID", 400);
    }
    if (type === "VP8X" && size >= 10) {
      if ((bytes[data] & 0x02) !== 0) throw new AppError("QUESTION_MEDIA_INVALID", 400);
      width = little24(bytes, data + 4) + 1;
      height = little24(bytes, data + 7) + 1;
    } else if (
      type === "VP8 " &&
      size >= 10 &&
      bytes[data + 3] === 0x9d &&
      bytes[data + 4] === 0x01 &&
      bytes[data + 5] === 0x2a
    ) {
      width = ((bytes[data + 7] << 8) | bytes[data + 6]) & 0x3fff;
      height = ((bytes[data + 9] << 8) | bytes[data + 8]) & 0x3fff;
    } else if (type === "VP8L" && size >= 5 && bytes[data] === 0x2f) {
      const b1 = bytes[data + 1];
      const b2 = bytes[data + 2];
      const b3 = bytes[data + 3];
      const b4 = bytes[data + 4];
      width = 1 + (((b2 & 0x3f) << 8) | b1);
      height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | (b2 >> 6));
    }
    offset = data + size + (size % 2);
  }
  validateDimensions(width, height);
  return { bytes, mimeType: "image/webp", width, height };
}

export function validateImage(bytes: Uint8Array, declaredType: string): ValidatedImage {
  if (bytes.byteLength > LIMITS.maxQuestionImageBytes)
    throw new AppError("QUESTION_MEDIA_INVALID", 400);
  const validated =
    declaredType === "image/png"
      ? png(bytes)
      : declaredType === "image/jpeg"
        ? jpeg(bytes)
        : declaredType === "image/webp"
          ? webp(bytes)
          : undefined;
  if (!validated || validated.mimeType !== declaredType)
    throw new AppError("QUESTION_MEDIA_INVALID", 400);
  return validated;
}

const BITRATES = {
  mpeg1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  mpeg2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};

export function validateMp3(bytes: Uint8Array): {
  bytes: Uint8Array;
  mimeType: "audio/mpeg";
  durationMs: number;
} {
  if (bytes.byteLength > LIMITS.maxQuestionAudioBytes || bytes.byteLength < 4) {
    throw new AppError("QUESTION_MEDIA_INVALID", 400);
  }
  let offset = 0;
  if (ascii(bytes, 0, 3) === "ID3" && bytes.length >= 10) {
    const tagSize =
      ((bytes[6] & 0x7f) << 21) |
      ((bytes[7] & 0x7f) << 14) |
      ((bytes[8] & 0x7f) << 7) |
      (bytes[9] & 0x7f);
    offset = 10 + tagSize;
  }
  const audioStart = offset;
  let durationMs = 0;
  let frames = 0;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff || (bytes[offset + 1] & 0xe0) !== 0xe0) break;
    const versionBits = (bytes[offset + 1] >> 3) & 0x03;
    const layerBits = (bytes[offset + 1] >> 1) & 0x03;
    if (versionBits === 1 || layerBits !== 1) throw new AppError("QUESTION_MEDIA_INVALID", 400);
    const bitrateIndex = (bytes[offset + 2] >> 4) & 0x0f;
    const sampleIndex = (bytes[offset + 2] >> 2) & 0x03;
    if (bitrateIndex === 0 || bitrateIndex === 15 || sampleIndex === 3)
      throw new AppError("QUESTION_MEDIA_INVALID", 400);
    const mpeg1 = versionBits === 3;
    const bitrate = (mpeg1 ? BITRATES.mpeg1 : BITRATES.mpeg2)[bitrateIndex] * 1_000;
    const baseRates = [44_100, 48_000, 32_000];
    const sampleRate = baseRates[sampleIndex] / (versionBits === 2 ? 2 : versionBits === 0 ? 4 : 1);
    const padding = (bytes[offset + 2] >> 1) & 1;
    const frameLength = Math.floor(((mpeg1 ? 144 : 72) * bitrate) / sampleRate) + padding;
    if (frameLength <= 4 || offset + frameLength > bytes.length)
      throw new AppError("QUESTION_MEDIA_INVALID", 400);
    durationMs += ((mpeg1 ? 1_152 : 576) / sampleRate) * 1_000;
    frames += 1;
    offset += frameLength;
  }
  if (frames < 2 || durationMs <= 0 || durationMs > LIMITS.maxQuestionAudioDurationMs) {
    throw new AppError("QUESTION_MEDIA_INVALID", 400);
  }
  return {
    bytes: bytes.slice(audioStart, offset),
    mimeType: "audio/mpeg",
    durationMs: Math.round(durationMs),
  };
}
