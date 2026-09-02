import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";

interface Counter {
  startedAt: number;
  count: number;
}

interface GateInput {
  scope: "client" | "global";
  now: number;
  operation?: "consume" | "release";
  leaseId?: string;
}

interface Lease {
  id: string;
  expiresAt: number;
}

const WINDOW_MS = 5 * 60 * 1_000;
const RETENTION_MS = 26 * 60 * 60 * 1_000;
const LEASE_MS = 2 * 60 * 1_000;

export class GenerationGate extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return new Response(null, { status: 405 });
    let input: GateInput;
    try {
      input = (await request.json()) as GateInput;
    } catch {
      return Response.json({ allowed: false }, { status: 400 });
    }
    if ((input.scope !== "client" && input.scope !== "global") || !Number.isFinite(input.now)) {
      return Response.json({ allowed: false }, { status: 400 });
    }
    if (input.operation === "release") {
      if (input.scope !== "client" || !input.leaseId) {
        return Response.json({ allowed: false }, { status: 400 });
      }
      await this.ctx.storage.transaction(async (storage) => {
        const lease = await storage.get<Lease>("lease");
        if (lease?.id === input.leaseId) await storage.delete("lease");
      });
      return new Response(null, { status: 204 });
    }
    if (input.scope === "client" && !input.leaseId) {
      return Response.json({ allowed: false }, { status: 400 });
    }
    const day = new Date(input.now).toISOString().slice(0, 10);
    const windowLimit = input.scope === "client" ? 3 : 120;
    const dayLimit = input.scope === "client" ? 20 : 1_000;
    const result = await this.ctx.storage.transaction(async (storage) => {
      const [window, daily] = await Promise.all([
        storage.get<Counter>("quota:window"),
        storage.get<Counter & { day: string }>("quota:day"),
      ]);
      const lease = input.scope === "client" ? await storage.get<Lease>("lease") : undefined;
      if (lease && lease.expiresAt > input.now && lease.id !== input.leaseId) {
        return { allowed: false, retryAfterMs: lease.expiresAt - input.now };
      }
      const nextWindow =
        !window || input.now - window.startedAt >= WINDOW_MS
          ? { startedAt: input.now, count: 0 }
          : window;
      const nextDay = !daily || daily.day !== day ? { day, startedAt: input.now, count: 0 } : daily;
      if (nextWindow.count >= windowLimit || nextDay.count >= dayLimit) {
        return {
          allowed: false,
          retryAfterMs: Math.max(1_000, nextWindow.startedAt + WINDOW_MS - input.now),
        };
      }
      nextWindow.count += 1;
      nextDay.count += 1;
      await Promise.all([
        storage.put("quota:window", nextWindow),
        storage.put("quota:day", nextDay),
        ...(input.scope === "client" && input.leaseId
          ? [storage.put("lease", { id: input.leaseId, expiresAt: input.now + LEASE_MS })]
          : []),
        storage.setAlarm(input.now + RETENTION_MS),
      ]);
      return {
        allowed: true,
        remaining: Math.min(windowLimit - nextWindow.count, dayLimit - nextDay.count),
      };
    });
    return Response.json(result, { status: result.allowed ? 200 : 429 });
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}
