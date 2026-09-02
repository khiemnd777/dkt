import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameDefinition } from "../../shared/game";
import type { MediaSafetyProvider } from "../../worker/integrations/openai/media-safety-provider";
import { OpenAiMediaSafetyProvider } from "../../worker/integrations/openai/media-safety-provider";
import { prepareMediaInput } from "../../worker/question-intelligence/media-input";
import { validateMp3 } from "../../worker/question-media/media-validation";
import { QuestionMediaService } from "../../worker/question-media/service";

function pngFixture(width = 16, height = 12): Uint8Array {
  const bytes = new Uint8Array(45);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([73, 72, 68, 82], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes[24] = 8;
  bytes[25] = 2;
  view.setUint32(33, 0);
  bytes.set([73, 69, 78, 68], 37);
  return bytes;
}

function mp3Fixture(): Uint8Array {
  const bytes = new Uint8Array(417 * 2);
  for (const offset of [0, 417]) bytes.set([0xff, 0xfb, 0x90, 0x00], offset);
  return bytes;
}

class FakeBucket {
  readonly objects = new Map<
    string,
    { bytes: Uint8Array; customMetadata?: Record<string, string>; contentType?: string }
  >();

  async put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | ReadableStream | Blob,
    options?: R2PutOptions,
  ) {
    const bytes =
      value instanceof Uint8Array
        ? Uint8Array.from(value)
        : value instanceof ArrayBuffer
          ? new Uint8Array(value)
          : new Uint8Array(await new Response(value as BodyInit).arrayBuffer());
    this.objects.set(key, {
      bytes,
      customMetadata: options?.customMetadata,
      contentType:
        options?.httpMetadata && "contentType" in options.httpMetadata
          ? options.httpMetadata.contentType
          : undefined,
    });
    return {} as R2Object;
  }

  async head(key: string) {
    const object = this.objects.get(key);
    if (!object) return null;
    return {
      key,
      size: object.bytes.length,
      customMetadata: object.customMetadata,
    } as R2Object;
  }

  async get(key: string, options?: R2GetOptions) {
    const object = this.objects.get(key);
    if (!object) return null;
    const range = options && "range" in options ? options.range : undefined;
    const bytes =
      range && typeof range === "object" && "offset" in range
        ? object.bytes.slice(
            range.offset ?? 0,
            (range.offset ?? 0) + (range.length ?? object.bytes.length),
          )
        : object.bytes;
    return {
      key,
      size: object.bytes.length,
      customMetadata: object.customMetadata,
      body: new Response(Uint8Array.from(bytes).buffer).body,
      arrayBuffer: async () => Uint8Array.from(bytes).buffer,
    } as unknown as R2ObjectBody;
  }

  async delete(key: string) {
    this.objects.delete(key);
  }
}

describe("private question media", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Media must not call any provider")),
    );
  });
  afterEach(() => {
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("validates, stores and serves a signed image with room-scoped delivery", async () => {
    const bucket = new FakeBucket();
    const service = new QuestionMediaService(
      bucket as unknown as R2Bucket,
      "test-media-signing-key-at-least-32-characters",
    );
    const handle = await service.upload({
      file: new File([Uint8Array.from(pngFixture()).buffer], "question.png", {
        type: "image/png",
      }),
      kind: "IMAGE",
      accessibilityText: "Một cuốn Kinh Thánh đang mở.",
      rightsSource: "USER_UPLOAD",
      attestedByHost: true,
    });
    expect(handle.media).toMatchObject({
      kind: "IMAGE",
      mimeType: "image/png",
      width: 16,
      height: 12,
    });
    expect(handle.readCapability).not.toContain(handle.media.assetId);

    const game: GameDefinition = {
      title: "Media game",
      mode: "TURN_BASED",
      defaultDurationSec: 20,
      createdClientVersion: "test",
      items: [
        {
          id: "q1",
          type: "TRUE_FALSE",
          statement: "Đây là một cuốn Kinh Thánh.",
          correctValue: true,
          presentation: { media: handle.media },
        },
      ],
    };
    const urls = await service.bindRoomMedia(
      game,
      { [handle.media.assetId]: handle.readCapability },
      "ABC234",
    );
    expect(urls[handle.media.assetId]).toContain("/api/rooms/ABC234/media/");
    const token =
      new URL(urls[handle.media.assetId], "https://game.test").searchParams.get("token") ??
      undefined;
    const response = await service.read(handle.media.assetId, token, "room:ABC234", "bytes=0-7");
    expect(response.status).toBe(206);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-range")).toContain("bytes 0-7/");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pngFixture().slice(0, 8));
    await expect(service.read(handle.media.assetId, token, "room:OTHER2")).rejects.toMatchObject({
      code: "QUESTION_MEDIA_EXPIRED",
    });
    expect(bucket.objects.get(`temp/${handle.media.assetId}`)?.customMetadata).toMatchObject({
      validationStatus: "PASSED",
    });
    expect(bucket.objects.get(`temp/${handle.media.assetId}`)?.customMetadata).not.toHaveProperty(
      "moderationStatus",
    );
  });

  it("requires rights attestation and rejects forged capabilities", async () => {
    const bucket = new FakeBucket();
    const service = new QuestionMediaService(
      bucket as unknown as R2Bucket,
      "test-media-signing-key-at-least-32-characters",
    );
    await expect(
      service.upload({
        file: new File([Uint8Array.from(pngFixture()).buffer], "question.png", {
          type: "image/png",
        }),
        kind: "IMAGE",
        accessibilityText: "Ảnh thử nghiệm",
        rightsSource: "USER_UPLOAD",
        attestedByHost: false,
      }),
    ).rejects.toMatchObject({ code: "QUESTION_MEDIA_RIGHTS_REQUIRED" });
    const handle = await service.upload({
      file: new File([Uint8Array.from(pngFixture()).buffer], "question.png", {
        type: "image/png",
      }),
      kind: "IMAGE",
      accessibilityText: "Ảnh thử nghiệm",
      rightsSource: "USER_UPLOAD",
      attestedByHost: true,
    });
    await expect(
      service.read(handle.media.assetId, `${handle.readCapability}x`, "read"),
    ).rejects.toMatchObject({ code: "QUESTION_MEDIA_EXPIRED", status: 404 });
    await expect(service.delete(handle.media.assetId, handle.readCapability)).rejects.toMatchObject(
      {
        code: "QUESTION_MEDIA_EXPIRED",
      },
    );
    await service.delete(handle.media.assetId, handle.deleteCapability);
    expect(bucket.objects.size).toBe(0);
  });

  it("uploads and reads MP3 without transcription, and rejects expired assets", async () => {
    const service = new QuestionMediaService(
      new FakeBucket() as unknown as R2Bucket,
      "test-media-signing-key-at-least-32-characters",
    );
    const handle = await service.upload({
      file: new File([Uint8Array.from(mp3Fixture()).buffer], "question.mp3", {
        type: "audio/mpeg",
      }),
      kind: "AUDIO",
      accessibilityText: "Một đoạn nhạc cho câu hỏi",
      rightsSource: "USER_UPLOAD",
      attestedByHost: true,
    });
    expect(handle.media.kind).toBe("AUDIO");
    expect(handle.media.durationMs).toBeGreaterThan(40);
    const asset = await service.readAsset(handle.media.assetId, handle.readCapability);
    expect(new Uint8Array(asset.bytes)).toEqual(mp3Fixture());
    vi.spyOn(Date, "now").mockReturnValue(Date.parse(handle.expiresAt) + 1);
    await expect(
      service.readAsset(handle.media.assetId, handle.readCapability),
    ).rejects.toMatchObject({
      code: "QUESTION_MEDIA_EXPIRED",
    });
  });

  it("still rejects invalid file signatures and excessive image dimensions before storage", async () => {
    const bucket = new FakeBucket();
    const service = new QuestionMediaService(
      bucket as unknown as R2Bucket,
      "test-media-signing-key-at-least-32-characters",
    );
    for (const bytes of [new Uint8Array([1, 2, 3]), pngFixture(4097, 12)]) {
      await expect(
        service.upload({
          file: new File([Uint8Array.from(bytes).buffer], "invalid.png", { type: "image/png" }),
          kind: "IMAGE",
          accessibilityText: "Ảnh không hợp lệ",
          rightsSource: "USER_UPLOAD",
          attestedByHost: true,
        }),
      ).rejects.toMatchObject({ code: "QUESTION_MEDIA_INVALID" });
    }
    expect(bucket.objects.size).toBe(0);
  });

  it("reads previously accepted assets without reprocessing them and rejects unvalidated metadata", async () => {
    const bucket = new FakeBucket();
    const service = new QuestionMediaService(
      bucket as unknown as R2Bucket,
      "test-media-signing-key-at-least-32-characters",
    );
    const handle = await service.upload({
      file: new File([Uint8Array.from(pngFixture()).buffer], "question.png", { type: "image/png" }),
      kind: "IMAGE",
      accessibilityText: "Ảnh đã được tải lên",
      rightsSource: "USER_UPLOAD",
      attestedByHost: true,
    });
    const metadata = bucket.objects.get(`temp/${handle.media.assetId}`)?.customMetadata;
    if (!metadata) throw new Error("Missing asset metadata");
    delete metadata.validationStatus;
    metadata.moderationStatus = "PASSED";
    expect((await service.read(handle.media.assetId, handle.readCapability, "read")).status).toBe(
      200,
    );
    metadata.moderationStatus = "FAILED";
    await expect(
      service.readAsset(handle.media.assetId, handle.readCapability),
    ).rejects.toMatchObject({
      code: "QUESTION_MEDIA_EXPIRED",
    });
  });
});

describe("audio validation and opt-in AI media analysis", () => {
  it("measures MP3 frames instead of trusting client duration", () => {
    const frameLength = 417;
    const bytes = new Uint8Array(frameLength * 2);
    for (const offset of [0, frameLength]) bytes.set([0xff, 0xfb, 0x90, 0x00], offset);
    const result = validateMp3(bytes);
    expect(result.mimeType).toBe("audio/mpeg");
    expect(result.durationMs).toBeGreaterThan(40);
    expect(() => validateMp3(new Uint8Array([0xff, 0xfb, 0x90, 0x00]))).toThrow();
  });

  it.each(["IMAGE", "AUDIO"] as const)(
    "prepares %s only through the explicit AI helper",
    async (kind) => {
      const service = new QuestionMediaService(
        new FakeBucket() as unknown as R2Bucket,
        "test-media-signing-key-at-least-32-characters",
      );
      const handle = await service.upload({
        file: new File(
          [Uint8Array.from(kind === "IMAGE" ? pngFixture() : mp3Fixture()).buffer],
          "question",
          {
            type: kind === "IMAGE" ? "image/png" : "audio/mpeg",
          },
        ),
        kind,
        accessibilityText: "Nội dung câu hỏi",
        rightsSource: "USER_UPLOAD",
        attestedByHost: true,
      });
      const safety: MediaSafetyProvider = {
        moderateImage: vi.fn().mockResolvedValue(undefined),
        moderateText: vi.fn().mockResolvedValue(undefined),
        transcribeAudio: vi.fn().mockResolvedValue("Bản phiên âm kiểm thử"),
      };
      await expect(
        prepareMediaInput(service, safety, handle.media.assetId, "forged", "test-transcriber"),
      ).rejects.toMatchObject({ code: "QUESTION_MEDIA_EXPIRED" });
      expect(safety.moderateImage).not.toHaveBeenCalled();
      expect(safety.transcribeAudio).not.toHaveBeenCalled();
      const input = await prepareMediaInput(
        service,
        safety,
        handle.media.assetId,
        handle.readCapability,
        "test-transcriber",
      );
      expect(input.media).toEqual(handle.media);
      if (kind === "IMAGE") {
        expect(input.image?.mimeType).toBe("image/png");
        expect(safety.moderateImage).toHaveBeenCalledTimes(1);
        expect(safety.transcribeAudio).not.toHaveBeenCalled();
        vi.mocked(safety.moderateImage).mockRejectedValueOnce(new Error("AI input rejected"));
      } else {
        expect(input.audioTranscript).toBe("Bản phiên âm kiểm thử");
        expect(safety.transcribeAudio).toHaveBeenCalledWith(
          expect.objectContaining({ model: "test-transcriber" }),
        );
        expect(safety.moderateText).toHaveBeenCalledWith("Nội dung câu hỏi\nBản phiên âm kiểm thử");
        expect(safety.moderateImage).not.toHaveBeenCalled();
        vi.mocked(safety.moderateText).mockRejectedValueOnce(new Error("AI input rejected"));
      }
      await expect(
        prepareMediaInput(
          service,
          safety,
          handle.media.assetId,
          handle.readCapability,
          "test-transcriber",
        ),
      ).rejects.toThrow("AI input rejected");
    },
  );

  it("uses multimodal moderation and a separate transcription endpoint", async () => {
    const requests: Array<{ url: string; body?: BodyInit | null }> = [];
    const provider = new OpenAiMediaSafetyProvider("test-openai-key", async (input, init) => {
      const url = String(input);
      requests.push({ url, body: init?.body });
      if (url.endsWith("/moderations")) {
        return Response.json({ results: [{ flagged: false }] });
      }
      return Response.json({ text: "Một câu đọc Kinh Thánh." });
    });
    await provider.moderateImage({
      bytes: pngFixture(),
      mimeType: "image/png",
      accessibilityText: "Một cuốn sách đang mở.",
    });
    expect(JSON.stringify(JSON.parse(String(requests[0].body)))).toContain("data:image/png;base64");
    const transcript = await provider.transcribeAudio({
      bytes: new Uint8Array([1, 2, 3]),
      model: "gpt-transcribe",
      contextTerms: ["Giăng"],
    });
    expect(transcript).toBe("Một câu đọc Kinh Thánh.");
    expect(requests[1].url).toContain("/audio/transcriptions");
    expect(JSON.stringify(requests)).not.toContain("test-openai-key");
  });
});
