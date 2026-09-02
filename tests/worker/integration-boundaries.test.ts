import { reset } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../worker/env";
import worker from "../../worker/index";
import { ScriptureService } from "../../worker/scripture/service";

const runtimeEnv = env as unknown as Env;

afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe("generation abuse gate", () => {
  it("allows three client generations in five minutes and rejects the fourth", async () => {
    if (!runtimeEnv.GENERATION_GATES) throw new Error("Missing GenerationGate binding");
    const stub = runtimeEnv.GENERATION_GATES.get(
      runtimeEnv.GENERATION_GATES.idFromName("client:test-bucket"),
    );
    const request = (leaseId: string, operation: "consume" | "release" = "consume") =>
      stub.fetch("https://generation-gate.test/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "client",
          now: 1_800_000_000_000,
          operation,
          leaseId,
        }),
      });
    for (const leaseId of ["lease-1", "lease-2", "lease-3"]) {
      expect((await request(leaseId)).status).toBe(200);
      expect((await request(leaseId, "release")).status).toBe(204);
    }
    const blocked = await request("lease-4");
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ allowed: false });
  });

  it("allows only one in-flight generation per client bucket", async () => {
    if (!runtimeEnv.GENERATION_GATES) throw new Error("Missing GenerationGate binding");
    const stub = runtimeEnv.GENERATION_GATES.get(
      runtimeEnv.GENERATION_GATES.idFromName("client:concurrency-bucket"),
    );
    const send = (leaseId: string, operation: "consume" | "release" = "consume") =>
      stub.fetch("https://generation-gate.test/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "client",
          now: 1_800_000_000_000,
          operation,
          leaseId,
        }),
      });
    expect((await send("lease-a")).status).toBe(200);
    expect((await send("lease-b")).status).toBe(429);
    expect((await send("lease-a", "release")).status).toBe(204);
    expect((await send("lease-b")).status).toBe(200);
  });
});

describe("disabled-by-default integration routes", () => {
  it("keeps Scripture and billable generation unavailable until release flags are enabled", async () => {
    const disabledEnv = Object.assign(Object.create(runtimeEnv) as Env, {
      SCRIPTURE_PROVIDER_ENABLED: "false",
      AI_QUESTION_SUGGESTIONS_ENABLED: "false",
      AI_AUTO_BALANCE_ENABLED: "false",
      QUESTION_MEDIA_ENABLED: "false",
      AI_MEDIA_ANALYSIS_ENABLED: "false",
    });
    const health = await worker.fetch(new Request("https://game.test/api/health"), disabledEnv);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({
      ok: true,
      features: {
        scripture: false,
        questionSuggestions: false,
        autoBalance: false,
        questionMedia: false,
        aiMediaAnalysis: false,
      },
    });

    const scripture = await worker.fetch(
      new Request("https://game.test/api/scripture/versions?language=vi"),
      disabledEnv,
    );
    expect(scripture.status).toBe(503);
    expect(await scripture.json()).toMatchObject({ error: { code: "SCRIPTURE_DISABLED" } });

    const lookup = await worker.fetch(
      new Request("https://game.test/api/scripture/lookup?versionId=1638&reference=JHN.3.16"),
      disabledEnv,
    );
    expect(lookup.status).toBe(503);
    expect(await lookup.json()).toMatchObject({ error: { code: "SCRIPTURE_DISABLED" } });

    const generation = await worker.fetch(
      new Request("https://game.test/api/question-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      disabledEnv,
    );
    expect(generation.status).toBe(503);
    expect(await generation.json()).toMatchObject({
      error: { code: "QUESTION_GENERATION_UNAVAILABLE" },
    });
  });
});

describe("standalone Scripture lookup route", () => {
  it("works without login or OpenAI configuration when only Scripture is enabled", async () => {
    const lookup = vi.spyOn(ScriptureService.prototype, "lookupReference").mockResolvedValue({
      version: {
        provider: "youversion",
        id: 1638,
        abbreviation: "TEST",
        localizedTitle: "Test",
        languageTag: "vi",
        copyright: "Test copyright",
        attribution: "Test copyright",
      },
      requestedScope: {
        provider: "youversion",
        bibleVersionId: 1638,
        bookUsfm: "JHN",
        chapter: 3,
        passageId: "JHN.3.16",
      },
      chunks: [],
    });
    const scriptureOnly = Object.assign(Object.create(runtimeEnv) as Env, {
      SCRIPTURE_PROVIDER_ENABLED: "true",
      YVP_APP_KEY: "test-key-not-a-secret",
      YVP_ALLOWED_BIBLE_IDS: "1638",
      OPENAI_API_KEY: undefined,
      AI_QUESTION_SUGGESTIONS_ENABLED: "false",
      AI_MEDIA_ANALYSIS_ENABLED: "false",
    });
    const response = await worker.fetch(
      new Request(
        "https://game.test/api/scripture/lookup?versionId=1638&reference=Gi%C4%83ng%203%3A16",
      ),
      scriptureOnly,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(lookup).toHaveBeenCalledWith(1638, "Giăng 3:16");
    expect(JSON.stringify(await response.json())).not.toContain("test-key-not-a-secret");
    const post = await worker.fetch(
      new Request("https://game.test/api/scripture/lookup", { method: "POST" }),
      scriptureOnly,
    );
    expect(post.status).toBe(405);
    expect(lookup).toHaveBeenCalledTimes(1);
  });
});
