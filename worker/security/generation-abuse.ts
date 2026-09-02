import { AppError } from "../../shared/errors";
import type { Env } from "../env";

function coarseAddress(value: string | null): string {
  if (!value) return "unknown";
  if (value.includes(":")) return value.split(":").slice(0, 4).join(":");
  return value.split(".").slice(0, 3).join(".");
}

async function hmac(key: string, value: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function consume(
  stub: DurableObjectStub,
  scope: "client" | "global",
  now: number,
  leaseId?: string,
): Promise<void> {
  const response = await stub.fetch("https://generation-gate.internal/consume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope, now, operation: "consume", leaseId }),
  });
  if (response.status === 429) {
    const result = (await response.json()) as { retryAfterMs?: number };
    const retryAfterSec = Math.ceil((result.retryAfterMs ?? 60_000) / 1_000);
    throw new AppError("QUESTION_GENERATION_RATE_LIMITED", 429, undefined, retryAfterSec);
  }
  if (!response.ok) throw new AppError("QUESTION_GENERATION_UNAVAILABLE", 503);
}

export async function enforceGenerationQuota(
  request: Request,
  env: Env,
  clientGenerationId: string,
): Promise<() => Promise<void>> {
  if (!env.GENERATION_GATES || !env.GENERATION_ABUSE_HMAC_KEY) {
    throw new AppError("QUESTION_GENERATION_UNAVAILABLE", 503);
  }
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const clientBucket = await hmac(
    env.GENERATION_ABUSE_HMAC_KEY,
    `${day}\n${clientGenerationId}\n${coarseAddress(request.headers.get("CF-Connecting-IP"))}`,
  );
  const clientStub = env.GENERATION_GATES.get(
    env.GENERATION_GATES.idFromName(`client:${clientBucket.slice(0, 32)}`),
  );
  const leaseId = crypto.randomUUID();
  await consume(clientStub, "client", now, leaseId);
  const release = async () => {
    await clientStub
      .fetch("https://generation-gate.internal/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "client", now: Date.now(), operation: "release", leaseId }),
      })
      .catch(() => undefined);
  };
  try {
    await consume(
      env.GENERATION_GATES.get(env.GENERATION_GATES.idFromName(`global:${day}`)),
      "global",
      now,
    );
  } catch (error) {
    await release();
    throw error;
  }
  return release;
}
