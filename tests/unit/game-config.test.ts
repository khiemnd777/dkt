import { afterEach, describe, expect, it, vi } from "vitest";
import {
  gameConfigFilename,
  parseGameConfig,
  serializeGameConfig,
} from "../../src/features/builder/gameConfig";
import {
  createGamePackage,
  gamePackageFilename,
  importGamePackage,
} from "../../src/features/builder/gamePackage";
import { api } from "../../src/lib/api";
import { smallGame } from "../fixtures/games";

describe("portable builder game configuration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it("round-trips a versioned game definition without room or session data", () => {
    const serialized = serializeGameConfig(smallGame, new Date("2026-08-01T00:00:00.000Z"));
    expect(parseGameConfig(serialized)).toEqual(smallGame);
    expect(serialized).toContain('"version": 2');
    expect(serialized).not.toContain("hostToken");
    expect(serialized).not.toContain("roomCode");
  });

  it("allows unfinished text fields but rejects unknown formats and extra data", () => {
    const unfinished = structuredClone(smallGame);
    unfinished.title = "";
    if (unfinished.items[0].type === "SINGLE_CHOICE") unfinished.items[0].prompt = "";
    expect(parseGameConfig(serializeGameConfig(unfinished))).toEqual(unfinished);

    const wrong = JSON.parse(serializeGameConfig(smallGame)) as Record<string, unknown>;
    const legacy = { ...wrong, version: 1 };
    expect(parseGameConfig(JSON.stringify(legacy))).toEqual(smallGame);

    wrong.version = 3;
    expect(() => parseGameConfig(JSON.stringify(wrong))).toThrow(/không đúng định dạng/u);
    wrong.version = 2;
    wrong.hostToken = "must-not-import";
    expect(() => parseGameConfig(JSON.stringify(wrong))).toThrow(/không đúng định dạng/u);
  });

  it("creates a portable, readable filename", () => {
    expect(gameConfigFilename("Đức Tin & Hy Vọng", new Date("2026-08-01"))).toBe(
      "do-kinh-thanh-duc-tin-hy-vong-2026-08-01.dkt.json",
    );
  });

  it("uses a hash-verified ZIP package for games with media", async () => {
    const mediaBytes = new TextEncoder().encode("validated-image-bytes");
    const digest = await crypto.subtle.digest("SHA-256", mediaBytes);
    const sha256 = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const withMedia = structuredClone(smallGame);
    const originalMedia = {
      assetId: "old_asset",
      kind: "IMAGE" as const,
      mimeType: "image/png" as const,
      sha256,
      byteSize: mediaBytes.length,
      width: 10,
      height: 10,
      accessibilityText: "Ảnh minh họa thử nghiệm",
      rights: { source: "USER_UPLOAD" as const, attestedByHost: true as const },
    };
    withMedia.items[0].presentation = {
      media: originalMedia,
    };
    expect(() => serializeGameConfig(withMedia)).toThrow(/\.dkt\.zip/u);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(Uint8Array.from(mediaBytes).buffer)),
    );
    const blob = await createGamePackage(withMedia, {
      old_asset: {
        media: originalMedia,
        readCapability: "read-capability-value-that-is-long-enough",
        deleteCapability: "delete-capability-value-that-is-long-enough",
        expiresAt: "2026-09-03T00:00:00.000Z",
      },
    });
    expect(gamePackageFilename("quiz.dkt.json")).toBe("quiz.dkt.zip");
    const replacement = {
      ...originalMedia,
      assetId: "new_asset",
    };
    vi.spyOn(api, "uploadQuestionMedia").mockResolvedValue({
      media: replacement,
      readCapability: "new-read-capability-value-that-is-long-enough",
      deleteCapability: "new-delete-capability-value-that-is-long-enough",
      expiresAt: "2026-09-03T00:00:00.000Z",
    });
    const imported = await importGamePackage(
      new File([await blob.arrayBuffer()], "quiz.dkt.zip", { type: "application/zip" }),
    );
    expect(imported.game.items[0].presentation?.media?.assetId).toBe("new_asset");
    expect(imported.handles.new_asset.media.sha256).toBe(sha256);
  });
});
