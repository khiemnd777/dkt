import { describe, expect, it } from "vitest";
import type { GameDefinition } from "../../shared/game";
import type { MediaSafetyProvider } from "../../worker/integrations/openai/media-safety-provider";
import { OpenAiMediaSafetyProvider } from "../../worker/integrations/openai/media-safety-provider";
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
    } as unknown as R2ObjectBody;
  }

  async delete(key: string) {
    this.objects.delete(key);
  }
}

const safety: MediaSafetyProvider = {
  moderateText: async () => undefined,
  moderateImage: async () => undefined,
  transcribeAudio: async () => "Nội dung âm thanh an toàn.",
};

describe("private question media", () => {
  it("validates, stores and serves a signed image with room-scoped delivery", async () => {
    const bucket = new FakeBucket();
    const service = new QuestionMediaService(
      bucket as unknown as R2Bucket,
      "test-media-signing-key-at-least-32-characters",
      safety,
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
  });

  it("requires rights attestation and rejects forged capabilities", async () => {
    const bucket = new FakeBucket();
    const service = new QuestionMediaService(
      bucket as unknown as R2Bucket,
      "test-media-signing-key-at-least-32-characters",
      safety,
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
  });
});

describe("audio validation and OpenAI media safety", () => {
  it("measures MP3 frames instead of trusting client duration", () => {
    const frameLength = 417;
    const bytes = new Uint8Array(frameLength * 2);
    for (const offset of [0, frameLength]) bytes.set([0xff, 0xfb, 0x90, 0x00], offset);
    const result = validateMp3(bytes);
    expect(result.mimeType).toBe("audio/mpeg");
    expect(result.durationMs).toBeGreaterThan(40);
    expect(() => validateMp3(new Uint8Array([0xff, 0xfb, 0x90, 0x00]))).toThrow();
  });

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
