import { reset } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it } from "vitest";
import type { Env } from "../../worker/env";
import worker from "../../worker/index";

const runtimeEnv = env as unknown as Env;

afterEach(async () => {
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
