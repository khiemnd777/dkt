import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../shared/errors";
import { YouVersionRestProvider } from "../../worker/integrations/youversion/rest-provider";
import { parseScriptureReference, passageIsWithin } from "../../worker/scripture/reference";
import { ScriptureService } from "../../worker/scripture/service";

const version = {
  id: 449,
  abbreviation: "NVB",
  localized_abbreviation: "NVB",
  title: "Vietnamese Bible",
  localized_title: "Kinh Thánh Tiếng Việt",
  language_tag: "vi",
  copyright: "Bản quyền thử nghiệm",
  publisher_url: "https://example.com",
  organization_id: 1,
  youversion_deep_link: "https://www.bible.com/versions/449",
};

const index = {
  books: [
    {
      id: "JHN",
      title: "Giăng",
      full_title: "Phúc Âm Giăng",
      abbreviation: "Gi",
      chapters: [
        {
          id: "3",
          passage_id: "JHN.3",
          title: "3",
          verses: [16, 17, 18].map((number) => ({
            id: String(number),
            passage_id: `JHN.3.${number}`,
            title: String(number),
          })),
        },
      ],
    },
  ],
};

describe("canonical Scripture references", () => {
  it("normalizes chapter and same-chapter verse ranges", () => {
    expect(parseScriptureReference(449, " jhn.3.16-18 ")).toMatchObject({
      bookUsfm: "JHN",
      chapter: 3,
      verseStart: 16,
      verseEnd: 18,
      passageId: "JHN.3.16-18",
    });
    expect(parseScriptureReference(449, "1sa.17").passageId).toBe("1SA.17");
    expect(() => parseScriptureReference(449, "JHN.3.18-16")).toThrow(AppError);
    expect(() => parseScriptureReference(449, "JHN.3.0")).toThrow(AppError);
  });

  it("checks candidate evidence remains inside the requested scope", () => {
    const scope = parseScriptureReference(449, "JHN.3.16-18");
    expect(passageIsWithin("JHN.3.16", scope)).toBe(true);
    expect(passageIsWithin("JHN.3.15-17", scope)).toBe(false);
    expect(passageIsWithin("JHN.4.1", scope)).toBe(false);
  });
});

describe("YouVersion REST provider", () => {
  it("maps official version/index/passage contracts and never exposes the App Key", async () => {
    const requests: Request[] = [];
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request);
      const url = new URL(request.url);
      if (url.pathname === "/v1/bibles") return Response.json({ data: [version] });
      if (url.pathname === "/v1/bibles/449") return Response.json(version);
      if (url.pathname.endsWith("/index")) return Response.json(index);
      if (url.pathname.includes("/passages/")) {
        return Response.json({
          id: "JHN.3.16-18",
          content: "Vì Đức Chúa Trời yêu thương thế gian.",
          reference: "Giăng 3:16–18",
        });
      }
      return new Response(null, { status: 404 });
    };
    const provider = new YouVersionRestProvider({
      appKey: "test-secret",
      allowedBibleIds: new Set([449]),
      fetcher,
      sleep: async () => undefined,
    });
    const service = new ScriptureService(provider);
    const versions = await service.listVersions("vi");
    expect(versions[0]).toMatchObject({ id: 449, abbreviation: "NVB", languageTag: "vi" });
    expect(requests[0].headers.get("x-yvp-app-key")).toBe("test-secret");
    expect(requests[0].url).toContain("/v1/bibles/449");

    expect((await provider.getIndex(449)).books[0].aliases).toContain("Giăng");

    const context = await service.getContext(449, "JHN.3.16-18");
    expect(context.version.attribution).toContain("NVB");
    expect(context.chunks[0]).toMatchObject({
      localizedReference: "Giăng 3:16–18",
      content: "Vì Đức Chúa Trời yêu thương thế gian.",
    });
    expect(context.chunks[0].contentSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(context)).not.toContain("test-secret");
  });

  it("returns no versions when the App Key has no licensed Bible access", async () => {
    const provider = new YouVersionRestProvider({
      appKey: "test-secret",
      fetcher: async () => new Response(null, { status: 204 }),
    });

    await expect(provider.listVersions({ languageRanges: ["vi"] })).resolves.toEqual([]);
  });

  it("accepts the nullable publisher URL returned by licensed VCB metadata", async () => {
    const provider = new YouVersionRestProvider({
      appKey: "test-secret",
      fetcher: async () => Response.json({ ...version, publisher_url: null }),
    });
    const result = await provider.getVersion(449);
    expect(result.id).toBe(449);
    expect(result.publisherUrl).toBeUndefined();
  });

  it("honors Retry-After and maps provider throttling to a stable error", async () => {
    const sleep = vi.fn(async () => undefined);
    const provider = new YouVersionRestProvider({
      appKey: "test-secret",
      fetcher: async () => new Response(null, { status: 429, headers: { "Retry-After": "1" } }),
      sleep,
    });
    await expect(provider.getVersion(449)).rejects.toMatchObject({
      code: "SCRIPTURE_PROVIDER_RATE_LIMITED",
      status: 429,
    });
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it("rejects disallowed versions and malformed upstream JSON", async () => {
    const disallowed = new YouVersionRestProvider({
      appKey: "test-secret",
      allowedBibleIds: new Set([449]),
      fetcher: async () => Response.json(version),
    });
    await expect(disallowed.getVersion(1)).rejects.toMatchObject({
      code: "SCRIPTURE_VERSION_UNAVAILABLE",
      status: 404,
    });
    const malformed = new YouVersionRestProvider({
      appKey: "test-secret",
      fetcher: async () => Response.json({ id: 449 }),
    });
    await expect(malformed.getVersion(449)).rejects.toMatchObject({
      code: "SCRIPTURE_VERSION_UNAVAILABLE",
      status: 503,
    });
  });
});
