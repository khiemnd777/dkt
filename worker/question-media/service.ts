import { AppError } from "../../shared/errors";
import type { BuilderMediaHandle, GameDefinition, QuestionMediaRef } from "../../shared/game";
import { LIMITS } from "../../shared/limits";
import { questionMediaRefSchema } from "../../shared/schemas";
import { createMediaCapability, verifyMediaCapability } from "./capabilities";
import { validateImage, validateMp3 } from "./media-validation";

const RETENTION_MS = 24 * 60 * 60 * 1_000;

interface AssetMetadata {
  assetId: string;
  sha256: string;
  kind: "IMAGE" | "AUDIO";
  mimeType: QuestionMediaRef["mimeType"];
  byteSize: number;
  accessibilityText: string;
  width?: number;
  height?: number;
  durationMs?: number;
  rightsSource: "USER_UPLOAD" | "APP_OWNED";
  attribution?: string;
  createdAt: number;
  expiresAt: number;
  validationStatus: "PASSED";
}

export interface MediaUploadInput {
  file: File;
  kind: "IMAGE" | "AUDIO";
  accessibilityText: string;
  rightsSource: "USER_UPLOAD" | "APP_OWNED";
  attestedByHost: boolean;
  attribution?: string;
}

function objectKey(assetId: string): string {
  return `temp/${assetId}`;
}

async function hash(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function encodeMetadata(metadata: AssetMetadata): Record<string, string> {
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
}

function decodeMetadata(input: Record<string, string> | undefined): AssetMetadata {
  if (!input) throw new AppError("QUESTION_MEDIA_EXPIRED", 404);
  const metadata: AssetMetadata = {
    assetId: input.assetId,
    sha256: input.sha256,
    kind: input.kind as AssetMetadata["kind"],
    mimeType: input.mimeType as AssetMetadata["mimeType"],
    byteSize: Number(input.byteSize),
    accessibilityText: input.accessibilityText,
    rightsSource: input.rightsSource as AssetMetadata["rightsSource"],
    createdAt: Number(input.createdAt),
    expiresAt: Number(input.expiresAt),
    // Older, already validated assets remain readable until their existing expiry.
    validationStatus: (input.validationStatus ?? input.moderationStatus) as "PASSED",
    ...(input.width ? { width: Number(input.width) } : {}),
    ...(input.height ? { height: Number(input.height) } : {}),
    ...(input.durationMs ? { durationMs: Number(input.durationMs) } : {}),
    ...(input.attribution ? { attribution: input.attribution } : {}),
  };
  if (
    !metadata.assetId ||
    !/^[a-f0-9]{64}$/u.test(metadata.sha256) ||
    !Number.isFinite(metadata.byteSize) ||
    !Number.isFinite(metadata.expiresAt) ||
    metadata.validationStatus !== "PASSED"
  ) {
    throw new AppError("QUESTION_MEDIA_EXPIRED", 404);
  }
  return metadata;
}

function toMedia(metadata: AssetMetadata): QuestionMediaRef {
  const media = {
    assetId: metadata.assetId,
    kind: metadata.kind,
    mimeType: metadata.mimeType,
    sha256: metadata.sha256,
    byteSize: metadata.byteSize,
    accessibilityText: metadata.accessibilityText,
    ...(metadata.width ? { width: metadata.width } : {}),
    ...(metadata.height ? { height: metadata.height } : {}),
    ...(metadata.durationMs ? { durationMs: metadata.durationMs } : {}),
    rights: {
      source: metadata.rightsSource,
      attestedByHost: true as const,
      ...(metadata.attribution ? { attribution: metadata.attribution } : {}),
    },
  };
  const parsed = questionMediaRefSchema.safeParse(media);
  if (!parsed.success) throw new AppError("QUESTION_MEDIA_EXPIRED", 404);
  return parsed.data;
}

function collectMedia(game: GameDefinition): QuestionMediaRef[] {
  const media: QuestionMediaRef[] = [];
  for (const item of game.items) {
    if (item.presentation?.media) media.push(item.presentation.media);
    if (item.type === "CROSSWORD") {
      for (const row of item.horizontalRows)
        if (row.presentation?.media) media.push(row.presentation.media);
    }
  }
  return [...new Map(media.map((asset) => [asset.assetId, asset])).values()];
}

export class QuestionMediaService {
  constructor(
    private readonly bucket: R2Bucket,
    private readonly signingKey: string,
  ) {
    if (!signingKey) throw new AppError("QUESTION_MEDIA_INVALID", 503);
  }

  async upload(input: MediaUploadInput): Promise<BuilderMediaHandle> {
    if (!input.attestedByHost) throw new AppError("QUESTION_MEDIA_RIGHTS_REQUIRED", 400);
    const accessibilityText = input.accessibilityText.normalize("NFC").replace(/\s+/gu, " ").trim();
    if (!accessibilityText || accessibilityText.length > 500) {
      throw new AppError("QUESTION_MEDIA_INVALID", 400);
    }
    const original = new Uint8Array(await input.file.arrayBuffer());
    const validated =
      input.kind === "IMAGE"
        ? validateImage(original, input.file.type)
        : input.file.type === "audio/mpeg"
          ? validateMp3(original)
          : undefined;
    if (!validated) throw new AppError("QUESTION_MEDIA_INVALID", 400);
    const assetId = crypto.randomUUID().replace(/-/gu, "");
    const now = Date.now();
    const metadata: AssetMetadata = {
      assetId,
      sha256: await hash(validated.bytes),
      kind: input.kind,
      mimeType: validated.mimeType,
      byteSize: validated.bytes.byteLength,
      accessibilityText,
      ...(input.kind === "IMAGE" && "width" in validated
        ? { width: validated.width, height: validated.height }
        : "durationMs" in validated
          ? { durationMs: validated.durationMs }
          : {}),
      rightsSource: input.rightsSource,
      ...(input.attribution?.trim() ? { attribution: input.attribution.trim().slice(0, 500) } : {}),
      createdAt: now,
      expiresAt: now + RETENTION_MS,
      validationStatus: "PASSED",
    };
    await this.bucket.put(objectKey(assetId), validated.bytes, {
      httpMetadata: { contentType: metadata.mimeType },
      customMetadata: encodeMetadata(metadata),
    });
    return {
      media: toMedia(metadata),
      readCapability: await createMediaCapability(
        this.signingKey,
        "read",
        assetId,
        metadata.expiresAt,
      ),
      deleteCapability: await createMediaCapability(
        this.signingKey,
        "delete",
        assetId,
        metadata.expiresAt,
      ),
      expiresAt: new Date(metadata.expiresAt).toISOString(),
    };
  }

  private async metadata(assetId: string): Promise<AssetMetadata> {
    const object = await this.bucket.head(objectKey(assetId));
    const metadata = decodeMetadata(object?.customMetadata);
    if (metadata.assetId !== assetId || metadata.expiresAt < Date.now()) {
      throw new AppError("QUESTION_MEDIA_EXPIRED", 404);
    }
    return metadata;
  }

  async read(
    assetId: string,
    token: string | undefined,
    operation: string,
    rangeHeader?: string | null,
  ): Promise<Response> {
    await verifyMediaCapability(token, this.signingKey, operation, assetId);
    const metadata = await this.metadata(assetId);
    let range: { offset: number; length: number } | undefined;
    if (rangeHeader) {
      const match = /^bytes=(\d+)-(\d*)$/u.exec(rangeHeader);
      if (!match) return new Response(null, { status: 416 });
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : metadata.byteSize - 1;
      if (start > end || end >= metadata.byteSize) return new Response(null, { status: 416 });
      range = { offset: start, length: end - start + 1 };
    }
    const object = await this.bucket.get(objectKey(assetId), range ? { range } : undefined);
    if (!object) throw new AppError("QUESTION_MEDIA_EXPIRED", 404);
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "Content-Type": metadata.mimeType,
      "X-Content-Type-Options": "nosniff",
    });
    if (range) {
      headers.set("Content-Length", String(range.length));
      headers.set(
        "Content-Range",
        `bytes ${range.offset}-${range.offset + range.length - 1}/${metadata.byteSize}`,
      );
      return new Response(object.body, { status: 206, headers });
    }
    headers.set("Content-Length", String(metadata.byteSize));
    return new Response(object.body, { headers });
  }

  async delete(assetId: string, token: string | undefined): Promise<void> {
    await verifyMediaCapability(token, this.signingKey, "delete", assetId);
    await this.bucket.delete(objectKey(assetId));
  }

  async readAsset(
    assetId: string,
    token: string | undefined,
  ): Promise<{
    media: QuestionMediaRef;
    bytes: ArrayBuffer;
  }> {
    await verifyMediaCapability(token, this.signingKey, "read", assetId);
    const metadata = await this.metadata(assetId);
    const object = await this.bucket.get(objectKey(assetId));
    if (!object) throw new AppError("QUESTION_MEDIA_EXPIRED", 404);
    return {
      media: toMedia(metadata),
      bytes: await object.arrayBuffer(),
    };
  }

  async bindRoomMedia(
    game: GameDefinition,
    capabilities: Readonly<Record<string, string>>,
    roomCode: string,
  ): Promise<Record<string, string>> {
    const media = collectMedia(game);
    if (media.length > LIMITS.maxQuestionMediaPerGame)
      throw new AppError("QUESTION_MEDIA_INVALID", 400);
    if (
      media.reduce((total, asset) => total + asset.byteSize, 0) >
      LIMITS.maxQuestionMediaBytesPerGame
    ) {
      throw new AppError("QUESTION_MEDIA_INVALID", 400);
    }
    const expiresAt = Date.now() + LIMITS.maxRoomLifetimeMs;
    const urls: Record<string, string> = {};
    for (const asset of media) {
      await verifyMediaCapability(
        capabilities[asset.assetId],
        this.signingKey,
        "read",
        asset.assetId,
      );
      const stored = toMedia(await this.metadata(asset.assetId));
      if (
        stored.sha256 !== asset.sha256 ||
        stored.mimeType !== asset.mimeType ||
        stored.byteSize !== asset.byteSize ||
        stored.accessibilityText !== asset.accessibilityText
      ) {
        throw new AppError("QUESTION_MEDIA_INVALID", 400);
      }
      const token = await createMediaCapability(
        this.signingKey,
        `room:${roomCode}`,
        asset.assetId,
        expiresAt,
      );
      urls[asset.assetId] =
        `/api/rooms/${roomCode}/media/${asset.assetId}?token=${encodeURIComponent(token)}`;
    }
    return urls;
  }
}
