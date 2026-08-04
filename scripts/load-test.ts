import { AVATARS, LIMITS } from "../shared/limits";

const playerCount = Number(Bun.env.LOAD_PLAYERS ?? LIMITS.maxPlayers);
const port = 41732;
const origin = `http://127.0.0.1:${port}`;

if (!Number.isInteger(playerCount) || playerCount < 1 || playerCount > LIMITS.maxPlayers)
  throw new Error(`LOAD_PLAYERS must be between 1 and ${LIMITS.maxPlayers}.`);

interface EventEnvelope {
  type: string;
  payload: Record<string, unknown>;
}

class SocketProbe {
  readonly socket: WebSocket;
  private readonly events: EventEnvelope[] = [];
  private readonly waiters = new Map<
    string,
    Array<{
      resolve: (event: EventEnvelope) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }>
  >();

  constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.addEventListener("message", (message) => {
      const event = JSON.parse(String(message.data)) as EventEnvelope;
      const waiter = this.waiters.get(event.type)?.shift();
      if (waiter) {
        clearTimeout(waiter.timer);
        waiter.resolve(event);
      } else this.events.push(event);
    });
  }

  async opened(): Promise<void> {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise<void>((resolve, reject) => {
      this.socket.addEventListener("open", () => resolve(), { once: true });
      this.socket.addEventListener("error", () => reject(new Error("WebSocket open failed.")), {
        once: true,
      });
    });
  }

  waitFor(type: string, timeoutMs = 30_000): Promise<EventEnvelope> {
    const existing = this.events.findIndex((event) => event.type === type);
    if (existing >= 0) return Promise.resolve(this.events.splice(existing, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = {
        resolve,
        reject,
        timer: setTimeout(() => undefined, timeoutMs),
      };
      const list = this.waiters.get(type) ?? [];
      list.push(waiter);
      this.waiters.set(type, list);
      clearTimeout(waiter.timer);
      waiter.timer = setTimeout(() => {
        const pending = this.waiters.get(type);
        const index = pending?.indexOf(waiter) ?? -1;
        if (index >= 0) pending?.splice(index, 1);
        reject(new Error(`Timed out waiting for ${type}.`));
      }, timeoutMs);
    });
  }

  send(message: unknown): void {
    this.socket.send(JSON.stringify(message));
  }

  close(): void {
    this.socket.close(1000, "Load test complete");
  }
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${origin}${path}`, init);
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path} returned ${response.status}`);
  return response.json() as Promise<T>;
}

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) return;
    } catch {
      // The local Cloudflare runtime is still starting.
    }
    await Bun.sleep(250);
  }
  throw new Error("Local Cloudflare runtime did not start.");
}

async function ticket(roomCode: string, role: "HOST" | "PLAYER", token: string): Promise<string> {
  const result = await json<{ ticket: string }>(`/api/rooms/${roomCode}/ws-ticket`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ role }),
  });
  return result.ticket;
}

const server = Bun.spawn(
  ["bun", "run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { cwd: process.cwd(), stdout: "ignore", stderr: "ignore" },
);
const sockets: SocketProbe[] = [];

try {
  await waitForServer();
  const startedAt = performance.now();
  const room = await json<{ roomCode: string; hostToken: string }>("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game: {
        title: `Local load UAT ${playerCount}`,
        mode: "TURN_BASED",
        defaultDurationSec: 30,
        createdClientVersion: "load-uat",
        items: [
          {
            id: "load-choice",
            type: "SINGLE_CHOICE",
            prompt: "Ai đã đánh bại Gô-li-át?",
            options: [
              { id: "david", text: "Đa-vít" },
              { id: "moses", text: "Môi-se" },
            ],
            correctOptionId: "david",
            durationSec: 30,
          },
        ],
      },
    }),
  });

  const joined = await Promise.all(
    Array.from({ length: playerCount }, async (_, index) => {
      return json<{ playerToken: string }>(`/api/rooms/${room.roomCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: `UAT ${String(index + 1).padStart(3, "0")}`,
          avatarId: AVATARS[index % AVATARS.length],
        }),
      });
    }),
  );
  const joinedAt = performance.now();

  const hostTicket = await ticket(room.roomCode, "HOST", room.hostToken);
  const host = new SocketProbe(
    `${origin.replace("http", "ws")}/api/rooms/${room.roomCode}/ws?ticket=${encodeURIComponent(hostTicket)}`,
  );
  sockets.push(host);
  await host.opened();
  await host.waitFor("room.snapshot");

  const players = await Promise.all(
    joined.map(async ({ playerToken }) => {
      const playerTicket = await ticket(room.roomCode, "PLAYER", playerToken);
      const player = new SocketProbe(
        `${origin.replace("http", "ws")}/api/rooms/${room.roomCode}/ws?ticket=${encodeURIComponent(playerTicket)}`,
      );
      sockets.push(player);
      await player.opened();
      await player.waitFor("room.snapshot");
      return player;
    }),
  );
  const connectedAt = performance.now();

  host.send({ type: "host.start_game" });
  const openedEvents = await Promise.all(players.map((player) => player.waitFor("round.opened")));
  const roundId = (openedEvents[0].payload.round as { roundId: string }).roundId;
  for (const [index, player] of players.entries()) {
    player.send({
      type: "player.submit_answer",
      payload: {
        roundId,
        submissionId: `load-${index}-${crypto.randomUUID()}`,
        answer: { type: "OPTION", optionId: "david" },
      },
    });
  }
  await Promise.all(players.map((player) => player.waitFor("answer.accepted")));
  const locked = await host.waitFor("round.locked", 60_000);
  if (locked.payload.answeredCount !== playerCount)
    throw new Error(
      `Expected ${playerCount} answers, received ${String(locked.payload.answeredCount)}.`,
    );
  const answeredAt = performance.now();

  host.send({ type: "host.reveal_answer" });
  await host.waitFor("round.revealed", 60_000);
  host.send({ type: "host.delete_room" });
  await host.waitFor("room.deleted");

  console.info(
    JSON.stringify(
      {
        players: playerCount,
        joinedMs: Math.round(joinedAt - startedAt),
        connectedMs: Math.round(connectedAt - joinedAt),
        answeredAndLockedMs: Math.round(answeredAt - connectedAt - LIMITS.countdownMs),
        acceptedAnswers: locked.payload.answeredCount,
        result: "pass",
      },
      null,
      2,
    ),
  );
} finally {
  for (const socket of sockets) socket.close();
  server.kill();
  await server.exited;
}
