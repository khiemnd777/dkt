import { describe, expect, it } from "vitest";
import {
  gameConfigFilename,
  parseGameConfig,
  serializeGameConfig,
} from "../../src/features/builder/gameConfig";
import { smallGame } from "../fixtures/games";

describe("portable builder game configuration", () => {
  it("round-trips a versioned game definition without room or session data", () => {
    const serialized = serializeGameConfig(smallGame, new Date("2026-08-01T00:00:00.000Z"));
    expect(parseGameConfig(serialized)).toEqual(smallGame);
    expect(serialized).toContain('"version": 1');
    expect(serialized).not.toContain("hostToken");
    expect(serialized).not.toContain("roomCode");
  });

  it("allows unfinished text fields but rejects unknown formats and extra data", () => {
    const unfinished = structuredClone(smallGame);
    unfinished.title = "";
    if (unfinished.items[0].type === "SINGLE_CHOICE") unfinished.items[0].prompt = "";
    expect(parseGameConfig(serializeGameConfig(unfinished))).toEqual(unfinished);

    const wrong = JSON.parse(serializeGameConfig(smallGame)) as Record<string, unknown>;
    wrong.version = 2;
    expect(() => parseGameConfig(JSON.stringify(wrong))).toThrow(/không đúng định dạng/u);
    wrong.version = 1;
    wrong.hostToken = "must-not-import";
    expect(() => parseGameConfig(JSON.stringify(wrong))).toThrow(/không đúng định dạng/u);
  });

  it("creates a portable, readable filename", () => {
    expect(gameConfigFilename("Đức Tin & Hy Vọng", new Date("2026-08-01"))).toBe(
      "do-kinh-thanh-duc-tin-hy-vong-2026-08-01.dkt.json",
    );
  });
});
