import type { BuilderMediaHandle, GameDefinition, QuestionMediaRef } from "@shared/game";
import { LIMITS } from "@shared/limits";
import { z } from "zod";
import { api } from "../../lib/api";
import { builderDraftSchema, GAME_CONFIG_FORMAT, portableGameConfigSchema } from "./gameConfig";

const PACKAGE_FORMAT = "do-kinh-thanh-live/game-package";
const PACKAGE_VERSION = 1;
const MAX_ENTRIES = LIMITS.maxQuestionMediaPerGame + 2;
const MAX_PACKAGE_BYTES = LIMITS.maxQuestionMediaBytesPerGame + LIMITS.maxCreateBodyBytes;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

interface PackageManifestEntry {
  assetId: string;
  path: string;
  sha256: string;
  byteSize: number;
  mimeType: QuestionMediaRef["mimeType"];
}

interface PackageManifest {
  format: typeof PACKAGE_FORMAT;
  version: typeof PACKAGE_VERSION;
  entries: PackageManifestEntry[];
}

const manifestSchema = z
  .object({
    format: z.literal(PACKAGE_FORMAT),
    version: z.literal(PACKAGE_VERSION),
    entries: z
      .array(
        z
          .object({
            assetId: z
              .string()
              .min(1)
              .max(80)
              .regex(/^[A-Za-z0-9_-]+$/u),
            path: z.string().regex(/^media\/[A-Za-z0-9_-]{1,80}\.(?:jpg|png|webp|mp3)$/u),
            sha256: z.string().regex(/^[a-f0-9]{64}$/u),
            byteSize: z.number().int().positive().max(LIMITS.maxQuestionAudioBytes),
            mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "audio/mpeg"]),
          })
          .strict(),
      )
      .min(1)
      .max(LIMITS.maxQuestionMediaPerGame),
  })
  .strict();

interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function write16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function write32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function createZip(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.bytes);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    write32(localView, 0, 0x04034b50);
    write16(localView, 4, 20);
    write16(localView, 8, 0);
    write32(localView, 14, crc);
    write32(localView, 18, entry.bytes.length);
    write32(localView, 22, entry.bytes.length);
    write16(localView, 26, name.length);
    local.set(name, 30);
    localParts.push(local, entry.bytes);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    write32(centralView, 0, 0x02014b50);
    write16(centralView, 4, 20);
    write16(centralView, 6, 20);
    write32(centralView, 16, crc);
    write32(centralView, 20, entry.bytes.length);
    write32(centralView, 24, entry.bytes.length);
    write16(centralView, 28, name.length);
    write32(centralView, 42, localOffset);
    central.set(name, 46);
    centralParts.push(central);
    localOffset += local.length + entry.bytes.length;
  }
  const central = concat(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  write32(endView, 0, 0x06054b50);
  write16(endView, 8, entries.length);
  write16(endView, 10, entries.length);
  write32(endView, 12, central.length);
  write32(endView, 16, localOffset);
  return concat([...localParts, central, end]);
}

function parseZip(bytes: Uint8Array): Map<string, Uint8Array> {
  if (bytes.length > MAX_PACKAGE_BYTES) throw new Error("Gói game vượt quá giới hạn 50 MiB.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let endOffset = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new Error("Gói ZIP không hợp lệ.");
  const entryCount = view.getUint16(endOffset + 10, true);
  const centralOffset = view.getUint32(endOffset + 16, true);
  if (entryCount < 2 || entryCount > MAX_ENTRIES)
    throw new Error("Gói ZIP có số tệp không hợp lệ.");
  const entries = new Map<string, Uint8Array>();
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("Mục lục ZIP không hợp lệ.");
    }
    const method = view.getUint16(offset + 10, true);
    const expectedCrc = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    if (method !== 0 || compressedSize !== size || size > LIMITS.maxQuestionAudioBytes) {
      throw new Error("Gói ZIP dùng kiểu nén hoặc kích thước không được hỗ trợ.");
    }
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    if (
      !/^(?:game\.json|manifest\.json|media\/[A-Za-z0-9_-]{1,80}\.(?:jpg|png|webp|mp3))$/u.test(
        name,
      ) ||
      entries.has(name)
    ) {
      throw new Error("Đường dẫn trong gói ZIP không an toàn.");
    }
    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error("Tệp ZIP không hợp lệ.");
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.slice(dataOffset, dataOffset + size);
    if (data.length !== size || crc32(data) !== expectedCrc)
      throw new Error("Checksum ZIP không hợp lệ.");
    entries.set(name, data);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(new ArrayBuffer(bytes.length));
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function extension(mimeType: QuestionMediaRef["mimeType"]): string {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "audio/mpeg": "mp3" }[
    mimeType
  ];
}

function mediaRefs(game: GameDefinition): QuestionMediaRef[] {
  const result: QuestionMediaRef[] = [];
  for (const item of game.items) {
    if (item.presentation?.media) result.push(item.presentation.media);
    if (item.type === "CROSSWORD") {
      for (const row of item.horizontalRows)
        if (row.presentation?.media) result.push(row.presentation.media);
    }
  }
  return [...new Map(result.map((media) => [media.assetId, media])).values()];
}

function rewriteMedia(
  game: GameDefinition,
  replacements: ReadonlyMap<string, QuestionMediaRef>,
): GameDefinition {
  const next = structuredClone(game);
  const rewrite = (presentation: { media?: QuestionMediaRef } | undefined) => {
    if (!presentation?.media) return presentation;
    const media = replacements.get(presentation.media.assetId);
    if (!media) throw new Error("Gói game thiếu tệp media.");
    return { media };
  };
  for (const item of next.items) {
    item.presentation = rewrite(item.presentation);
    if (item.type === "CROSSWORD") {
      for (const row of item.horizontalRows) row.presentation = rewrite(row.presentation);
    }
  }
  return next;
}

export async function createGamePackage(
  game: GameDefinition,
  handles: Readonly<Record<string, BuilderMediaHandle>>,
  exportedAt = new Date(),
): Promise<Blob> {
  const refs = mediaRefs(game);
  if (!refs.length) throw new Error("Game không có media để đóng gói.");
  const entries: ZipEntry[] = [];
  const manifestEntries: PackageManifestEntry[] = [];
  for (const media of refs) {
    const handle = handles[media.assetId];
    if (!handle)
      throw new Error("Một tệp media đã hết quyền truy cập; hãy tải lại trước khi xuất.");
    const response = await fetch(
      `/api/question-media/${media.assetId}?token=${encodeURIComponent(handle.readCapability)}`,
    );
    if (!response.ok) throw new Error("Không thể đọc media tạm thời để đóng gói.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if ((await sha256(bytes)) !== media.sha256 || bytes.length !== media.byteSize) {
      throw new Error("Media không khớp checksum đã xác thực.");
    }
    const path = `media/${media.assetId}.${extension(media.mimeType)}`;
    entries.push({ name: path, bytes });
    manifestEntries.push({
      assetId: media.assetId,
      path,
      sha256: media.sha256,
      byteSize: media.byteSize,
      mimeType: media.mimeType,
    });
  }
  const envelope = {
    format: GAME_CONFIG_FORMAT,
    version: 2,
    exportedAt: exportedAt.toISOString(),
    game: builderDraftSchema.parse(game),
  };
  const manifest: PackageManifest = {
    format: PACKAGE_FORMAT,
    version: PACKAGE_VERSION,
    entries: manifestEntries,
  };
  entries.unshift(
    { name: "game.json", bytes: encoder.encode(JSON.stringify(envelope)) },
    { name: "manifest.json", bytes: encoder.encode(JSON.stringify(manifest)) },
  );
  const zip = createZip(entries);
  if (zip.length > MAX_PACKAGE_BYTES) throw new Error("Gói game vượt quá giới hạn 50 MiB.");
  const portable = new Uint8Array(new ArrayBuffer(zip.length));
  portable.set(zip);
  return new Blob([portable.buffer], { type: "application/zip" });
}

export async function importGamePackage(
  file: File,
): Promise<{ game: GameDefinition; handles: Record<string, BuilderMediaHandle> }> {
  const entries = parseZip(new Uint8Array(await file.arrayBuffer()));
  const gameEntry = entries.get("game.json");
  const manifestEntry = entries.get("manifest.json");
  if (!gameEntry || !manifestEntry) throw new Error("Gói game thiếu game.json hoặc manifest.json.");
  const parsedEnvelope = portableGameConfigSchema.safeParse(
    JSON.parse(decoder.decode(gameEntry)) as unknown,
  );
  if (!parsedEnvelope.success) throw new Error("game.json không hợp lệ.");
  const parsedGame = builderDraftSchema.safeParse(parsedEnvelope.data.game);
  if (!parsedGame.success) throw new Error("Game trong gói không hợp lệ.");
  const parsedManifest = manifestSchema.safeParse(
    JSON.parse(decoder.decode(manifestEntry)) as unknown,
  );
  if (!parsedManifest.success) throw new Error("Manifest gói game không hợp lệ.");
  const manifest: PackageManifest = parsedManifest.data;
  const refs = new Map(mediaRefs(parsedGame.data).map((media) => [media.assetId, media]));
  if (manifest.entries.length !== refs.size) throw new Error("Manifest media không khớp game.");
  const replacements = new Map<string, QuestionMediaRef>();
  const handles: Record<string, BuilderMediaHandle> = {};
  for (const entry of manifest.entries) {
    const media = refs.get(entry.assetId);
    const bytes = entries.get(entry.path);
    if (
      !media ||
      !bytes ||
      entry.sha256 !== media.sha256 ||
      entry.byteSize !== bytes.length ||
      entry.mimeType !== media.mimeType ||
      (await sha256(bytes)) !== entry.sha256
    ) {
      throw new Error("Media trong gói không khớp manifest.");
    }
    const form = new FormData();
    form.set(
      "file",
      new File([Uint8Array.from(bytes).buffer], entry.path.split("/").at(-1) ?? "media", {
        type: entry.mimeType,
      }),
    );
    form.set("kind", media.kind);
    form.set("accessibilityText", media.accessibilityText);
    form.set("rightsSource", media.rights.source);
    form.set("attestedByHost", "true");
    if (media.rights.attribution) form.set("attribution", media.rights.attribution);
    const handle = await api.uploadQuestionMedia(form);
    replacements.set(entry.assetId, handle.media);
    handles[handle.media.assetId] = handle;
  }
  return { game: rewriteMedia(parsedGame.data, replacements), handles };
}

export function gamePackageFilename(jsonFilename: string): string {
  return jsonFilename.replace(/\.dkt\.json$/u, ".dkt.zip");
}
