import { describe, expect, it, vi } from "vitest";
import type { ScriptureIndex, ScriptureProvider } from "../../shared/scripture";
import { resolveScriptureReference } from "../../worker/scripture/reference";
import { ScriptureService } from "../../worker/scripture/service";

const index: ScriptureIndex = {
  provider: "youversion",
  bibleVersionId: 1638,
  books: [
    {
      id: "1SA",
      name: "Sách 1 Sa-mu-ên",
      abbreviation: "1 Sa",
      aliases: ["1 Sa-mu-ên"],
      chapters: [
        {
          id: "1SA.17",
          number: 17,
          verses: [50, 51].map((number) => ({ id: `1SA.17.${number}`, number })),
        },
      ],
    },
    {
      id: "JHN",
      name: "Phúc Âm Giăng",
      abbreviation: "Gi",
      aliases: ["Giăng"],
      chapters: [
        {
          id: "JHN.3",
          number: 3,
          verses: [16, 17, 18].map((number) => ({ id: `JHN.3.${number}`, number })),
        },
      ],
    },
  ],
};

describe("manual YouVersion reference lookup", () => {
  it.each([
    ["1 Sa-mu-ên 17:50", "1SA.17.50"],
    ["I Sa mu en 17:50–51", "1SA.17.50-51"],
    ["  giang 3:16 - 18 ", "JHN.3.16-18"],
    ["Gi 3:16", "JHN.3.16"],
    ["JHN 3", "JHN.3"],
    ["jhn.3.16", "JHN.3.16"],
  ])("resolves %s from the selected version's index", (input, expected) => {
    expect(resolveScriptureReference(1638, input, index).passageId).toBe(expected);
  });

  it.each([
    "",
    "Giăng",
    "Giăng 0:16",
    "Giăng 3:0",
    "Giăng 3:18-16",
    "Giăng 3:16-4:2",
    "Giăng 3:16,18",
    "Gian 3:16",
    "Giăng 4:16",
    "Giăng 3:15-18",
    "Khác 3:16",
    "x".repeat(121),
  ])("rejects invalid or unsupported input %s", (input) => {
    expect(() => resolveScriptureReference(1638, input, index)).toThrow();
  });

  it("rejects ambiguous aliases and a mismatched version index", () => {
    expect(() => resolveScriptureReference(449, "Giăng 3:16", index)).toThrow();
    const ambiguous = { ...index, books: [...index.books, { ...index.books[1], id: "GEN" }] };
    expect(() => resolveScriptureReference(1638, "Giăng 3:16", ambiguous)).toThrow();
  });

  it("authorizes the version, resolves a reference and returns display-only context", async () => {
    const provider: ScriptureProvider = {
      getVersion: vi.fn(async () => ({
        provider: "youversion" as const,
        id: 1638,
        abbreviation: "TEST",
        localizedTitle: "Bản dịch kiểm thử",
        languageTag: "vi",
        copyright: "Test copyright",
        attribution: "Test attribution",
      })),
      getIndex: vi.fn(async () => index),
      getPassage: vi.fn(async (reference) => ({
        reference,
        localizedReference: "1 Sa-mu-ên 17:50",
        content: "Nội dung giả lập phục vụ kiểm thử.",
        contentSha256: "a".repeat(64),
        attribution: "Test attribution",
      })),
      listVersions: vi.fn(),
      validateReference: vi.fn(),
    };
    const service = new ScriptureService(provider);
    const result = await service.lookupReference(1638, "1 Sa-mu-ên 17:50");
    expect(result.requestedScope.passageId).toBe("1SA.17.50");
    expect(result.chunks[0].content).toContain("giả lập");
    expect(provider.getPassage).toHaveBeenCalledWith(result.requestedScope);
    vi.mocked(provider.getVersion).mockRejectedValueOnce(new Error("Not licensed"));
    await expect(service.lookupReference(1638, "1 Sa-mu-ên 17:50")).rejects.toThrow("Not licensed");
    expect(provider.getPassage).toHaveBeenCalledTimes(1);
    await expect(service.lookupReference(1638, "Giăng 3:999")).rejects.toThrow();
    expect(provider.getPassage).toHaveBeenCalledTimes(1);
  });
});
