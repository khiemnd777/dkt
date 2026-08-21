import { reset, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it } from "vitest";
import type { GameDefinition } from "../../shared/game";
import type { Player, RoomProgress } from "../../shared/room";
import type { Env } from "../../worker/env";
import worker from "../../worker/index";
import { crosswordGame, smallGame } from "../fixtures/games";

const runtimeEnv = env as unknown as Env;

const pageEnv = {
  GAME_ROOMS: runtimeEnv.GAME_ROOMS,
  APP_ENV: "development",
  TURNSTILE_EXPECTED_ACTION: "create-room",
  ASSETS: {
    fetch: async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      const pathname = new URL(request.url).pathname;
      if (pathname === "/" || pathname === "/index.html" || pathname === "/app-shell.html") {
        return new Response(
          '<!doctype html><html lang="vi"><head><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><title>Ứng dụng phòng chơi | Đố Kinh Thánh Live</title></head><body><div id="root"></div></body></html>',
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
      }
      if (pathname === "/robots.txt") {
        return new Response("User-agent: OAI-SearchBot\nAllow: /\n", {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      if (pathname === "/sw.js") {
        return new Response("game-service-worker", {
          headers: { "Content-Type": "application/javascript; charset=utf-8" },
        });
      }
      return new Response("Not found", { status: 404 });
    },
  } as unknown as Fetcher,
} satisfies Env;

async function request(path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(new Request(`https://game.test${path}`, init), runtimeEnv);
}

async function pageRequest(host: string, path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(new Request(`https://${host}${path}`, init), pageEnv);
}

async function createRoom(game: GameDefinition = smallGame) {
  const response = await request("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ game }),
  });
  expect(response.status).toBe(201);
  return response.json() as Promise<{
    roomCode: string;
    hostToken: string;
    screenToken: string;
  }>;
}

async function joinPlayer(roomCode: string) {
  const response = await request(`/api/rooms/${roomCode}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: "Người chơi", avatarId: "🦁" }),
  });
  expect(response.status).toBe(201);
  return response.json() as Promise<{ playerId: string; playerToken: string }>;
}

async function websocket(
  roomCode: string,
  role: "HOST" | "PLAYER" | "SCREEN",
  token: string,
): Promise<WebSocket> {
  const ticketResponse = await request(`/api/rooms/${roomCode}/ws-ticket`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ role }),
  });
  expect(ticketResponse.status).toBe(200);
  const { ticket } = (await ticketResponse.json()) as { ticket: string };
  const response = await request(`/api/rooms/${roomCode}/ws?ticket=${encodeURIComponent(ticket)}`, {
    headers: { Upgrade: "websocket" },
  });
  expect(response.status).toBe(101);
  const socket = response.webSocket;
  if (!socket) throw new Error("No client WebSocket");
  socket.accept();
  return socket;
}

function nextMessage(socket: WebSocket): Promise<{ type: string; payload: unknown }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WebSocket message timeout")), 2_000);
    socket.addEventListener(
      "message",
      (event) => {
        clearTimeout(timeout);
        resolve(JSON.parse(String(event.data)) as { type: string; payload: unknown });
      },
      { once: true },
    );
  });
}

function messageInbox(socket: WebSocket) {
  type Message = { type: string; payload: unknown };
  const queued: Message[] = [];
  const waiting: Array<(message: Message) => void> = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as Message;
    const resolve = waiting.shift();
    if (resolve) resolve(message);
    else queued.push(message);
  });
  const next = () =>
    new Promise<Message>((resolve, reject) => {
      const existing = queued.shift();
      if (existing) return resolve(existing);
      const timeout = setTimeout(() => reject(new Error("WebSocket message timeout")), 2_000);
      waiting.push((message) => {
        clearTimeout(timeout);
        resolve(message);
      });
    });
  return {
    async nextType(type: string): Promise<Message> {
      for (;;) {
        const message = await next();
        if (message.type === type) return message;
      }
    },
  };
}

async function forceOpenRound(roomCode: string): Promise<void> {
  const stub = runtimeEnv.GAME_ROOMS.get(runtimeEnv.GAME_ROOMS.idFromName(roomCode));
  await runInDurableObject(stub, async (instance, state) => {
    const progress = await state.storage.get<RoomProgress>("room:progress");
    if (!progress) throw new Error("Missing room progress");
    progress.countdownEndsAt = Date.now() - 1;
    await state.storage.put("room:progress", progress);
    await (instance as unknown as { alarm(): Promise<void> }).alarm();
  });
}

afterEach(async () => {
  await reset();
});

describe("host-aware indexing and status policy", () => {
  it("redirects the public root and legacy game routes to their canonical hosts", async () => {
    const root = await pageRequest("dokinhthanh.io.vn", "/");
    expect(root.status).toBe(308);
    expect(root.headers.get("location")).toBe("https://dokinhthanh.io.vn/vi/");

    const builder = await pageRequest("dokinhthanh.io.vn", "/create");
    expect(builder.status).toBe(308);
    expect(builder.headers.get("location")).toBe("https://game.dokinhthanh.io.vn/create");

    const www = await pageRequest("www.dokinhthanh.io.vn", "/en/features/");
    expect(www.status).toBe(301);
    expect(www.headers.get("location")).toBe("https://dokinhthanh.io.vn/en/features/");
  });

  it("returns a generic noindex shell for builder and active room routes", async () => {
    const builder = await pageRequest("game.dokinhthanh.io.vn", "/create");
    expect(builder.status).toBe(200);
    expect(builder.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive, nosnippet");
    expect(builder.headers.get("cache-control")).toBe("no-store");

    const room = await createRoom();
    const join = await pageRequest("game.dokinhthanh.io.vn", `/join/${room.roomCode}`);
    expect(join.status).toBe(200);
    expect(join.headers.get("x-robots-tag")).toContain("noindex");
    const html = await join.text();
    expect(html).not.toContain(smallGame.title);
    expect(html).not.toContain(room.roomCode);
  });

  it("returns 410 for a missing valid room and 404 for malformed or unknown paths", async () => {
    const gone = await pageRequest("game.dokinhthanh.io.vn", "/join/ABC234");
    expect(gone.status).toBe(410);
    expect(gone.headers.get("x-robots-tag")).toContain("noindex");
    expect(gone.headers.get("cache-control")).toBe("no-store");

    expect((await pageRequest("game.dokinhthanh.io.vn", "/join/not-valid")).status).toBe(404);
    expect((await pageRequest("game.dokinhthanh.io.vn", "/unrelated-path")).status).toBe(404);
    expect((await pageRequest("dokinhthanh.io.vn", "/unrelated-path")).status).toBe(404);
  });

  it("keeps public APIs unavailable and private API responses uncached", async () => {
    const publicApi = await pageRequest("dokinhthanh.io.vn", "/api/health");
    expect(publicApi.status).toBe(404);
    expect(publicApi.headers.get("cache-control")).toBe("no-store");

    const gameApi = await pageRequest("game.dokinhthanh.io.vn", "/api/health");
    expect(gameApi.status).toBe(200);
    expect(gameApi.headers.get("cache-control")).toBe("no-store");
  });

  it("retires the legacy public service worker without changing the game worker", async () => {
    const publicWorker = await pageRequest("dokinhthanh.io.vn", "/sw.js");
    expect(publicWorker.status).toBe(200);
    expect(publicWorker.headers.get("cache-control")).toBe("no-cache, no-store, must-revalidate");
    expect(publicWorker.headers.get("content-type")).toContain("application/javascript");
    expect(publicWorker.headers.get("service-worker-allowed")).toBe("/");
    const cleanup = await publicWorker.text();
    expect(cleanup).toContain("caches.delete");
    expect(cleanup).toContain("registration.unregister");

    const gameWorker = await pageRequest("game.dokinhthanh.io.vn", "/sw.js");
    expect(gameWorker.status).toBe(200);
    expect(await gameWorker.text()).toBe("game-service-worker");
  });
});

describe("GameRoom integration", () => {
  it("initializes atomically, exposes only public metadata, and rejects a collision", async () => {
    const code = "ABC234";
    const stub = runtimeEnv.GAME_ROOMS.get(runtimeEnv.GAME_ROOMS.idFromName(code));
    const initialize = () =>
      stub.fetch(
        new Request("https://game.test/api/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-room-code": code },
          body: JSON.stringify({ game: smallGame }),
        }),
      );
    expect((await initialize()).status).toBe(201);
    expect((await initialize()).status).toBe(409);

    const metadata = await stub.fetch(new Request(`https://game.test/api/rooms/${code}/public`));
    const body = (await metadata.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      exists: true,
      gameTitle: smallGame.title,
      playerCount: 0,
      canJoin: true,
    });
    expect(JSON.stringify(body)).not.toContain("correctOptionId");
  });

  it("joins players with readable duplicate suffixes and authenticates role-bound one-time tickets", async () => {
    const room = await createRoom();
    const join = () =>
      request(`/api/rooms/${room.roomCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "An", avatarId: "🦁" }),
      });
    const first = (await (await join()).json()) as { playerToken: string; displayName: string };
    const second = (await (await join()).json()) as { playerToken: string; displayName: string };
    expect(first.displayName).toBe("An");
    expect(second.displayName).toBe("An (2)");

    const ticketResponse = await request(`/api/rooms/${room.roomCode}/ws-ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${first.playerToken}` },
      body: JSON.stringify({ role: "PLAYER" }),
    });
    const { ticket } = (await ticketResponse.json()) as { ticket: string };
    const upgrade = () =>
      request(`/api/rooms/${room.roomCode}/ws?ticket=${encodeURIComponent(ticket)}`, {
        headers: { Upgrade: "websocket" },
      });
    const firstUpgrade = await upgrade();
    expect(firstUpgrade.status).toBe(101);
    expect((await upgrade()).status).toBe(401);

    const wrongRole = await request(`/api/rooms/${room.roomCode}/ws-ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${first.playerToken}` },
      body: JSON.stringify({ role: "HOST" }),
    });
    expect(wrongRole.status).toBe(401);
  });

  it("preserves every player identity during a concurrent join burst", async () => {
    const room = await createRoom();
    const joined = await Promise.all(
      Array.from({ length: 40 }, (_, index) =>
        request(`/api/rooms/${room.roomCode}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: `Burst ${String(index + 1).padStart(2, "0")}`,
            avatarId: "🦁",
          }),
        }),
      ),
    );
    expect(joined.every((response) => response.status === 201)).toBe(true);
    const sessions = await Promise.all(
      joined.map((response) => response.json() as Promise<{ playerToken: string }>),
    );
    const tickets = await Promise.all(
      sessions.map(({ playerToken }) =>
        request(`/api/rooms/${room.roomCode}/ws-ticket`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${playerToken}`,
          },
          body: JSON.stringify({ role: "PLAYER" }),
        }),
      ),
    );
    expect(tickets.every((response) => response.status === 200)).toBe(true);
    const metadata = (await (await request(`/api/rooms/${room.roomCode}/public`)).json()) as {
      playerCount: number;
    };
    expect(metadata.playerCount).toBe(40);
  });

  it("uses hibernatable attachments, distinct host controls, and deleteAll cleanup", async () => {
    const room = await createRoom();
    const socket = await websocket(room.roomCode, "HOST", room.hostToken);
    const snapshot = await nextMessage(socket);
    expect(snapshot.type).toBe("room.snapshot");

    const stub = runtimeEnv.GAME_ROOMS.get(runtimeEnv.GAME_ROOMS.idFromName(room.roomCode));
    const attachment = await runInDurableObject(stub, (_instance, state) => {
      const sockets = state.getWebSockets("HOST");
      return sockets[0]?.deserializeAttachment() as { role?: string; protocolVersion?: number };
    });
    expect(attachment).toMatchObject({ role: "HOST", protocolVersion: 1 });

    const deleted = nextMessage(socket);
    socket.send(JSON.stringify({ type: "host.delete_room" }));
    expect((await deleted).type).toBe("room.deleted");
    const metadata = await request(`/api/rooms/${room.roomCode}/public`);
    expect(metadata.status).toBe(404);
  });

  it("awards one hidden vertical guess during a horizontal round and decreases later value", async () => {
    const game = structuredClone(crosswordGame);
    game.mode = "TURN_BASED";
    const room = await createRoom(game);
    const player = await joinPlayer(room.roomCode);
    const hostSocket = await websocket(room.roomCode, "HOST", room.hostToken);
    const hostInbox = messageInbox(hostSocket);
    await hostInbox.nextType("room.snapshot");
    const playerSocket = await websocket(room.roomCode, "PLAYER", player.playerToken);
    const playerInbox = messageInbox(playerSocket);
    expect((await playerInbox.nextType("room.snapshot")).payload).toMatchObject({ totalRounds: 3 });

    hostSocket.send(JSON.stringify({ type: "host.start_game" }));
    await playerInbox.nextType("game.countdown_started");
    await forceOpenRound(room.roomCode);
    const opened = await playerInbox.nextType("round.opened");
    expect(opened.payload).toMatchObject({ crosswordVerticalPoints: 2000 });
    expect(JSON.stringify(opened.payload)).toContain("Điều còn lại lớn nhất?");

    playerSocket.send(
      JSON.stringify({
        type: "player.submit_crossword_vertical",
        payload: {
          roundId: "crossword-1:h:r1",
          submissionId: "vertical-guess-1",
          value: "TIN",
        },
      }),
    );
    expect(
      (await playerInbox.nextType("crossword.vertical_answer_accepted")).payload,
    ).toMatchObject({
      itemId: "crossword-1",
    });

    playerSocket.send(
      JSON.stringify({
        type: "player.submit_crossword_vertical",
        payload: {
          roundId: "crossword-1:h:r1",
          submissionId: "vertical-guess-2",
          value: "TIN",
        },
      }),
    );
    expect((await playerInbox.nextType("answer.rejected")).payload).toMatchObject({
      code: "DUPLICATE_CROSSWORD_VERTICAL",
    });

    playerSocket.send(
      JSON.stringify({
        type: "player.submit_answer",
        payload: {
          roundId: "crossword-1:h:r1",
          submissionId: "horizontal-answer-1",
          answer: { type: "TEXT", value: "TÔ-MA" },
        },
      }),
    );
    await playerInbox.nextType("answer.accepted");
    await playerInbox.nextType("round.locked");

    const stub = runtimeEnv.GAME_ROOMS.get(runtimeEnv.GAME_ROOMS.idFromName(room.roomCode));
    const stored = await runInDurableObject(stub, async (_instance, state) => {
      const players = await state.storage.get<Record<string, Player>>("room:players");
      const guesses = await state.storage.get<
        Record<string, Record<string, { awardedPoints: number; bonusApplied: boolean }>>
      >("room:crossword-vertical-submissions");
      return {
        currentPlayer: players?.[player.playerId],
        guess: guesses?.["crossword-1"]?.[player.playerId],
      };
    });
    expect(stored.currentPlayer).toMatchObject({ totalScore: 3000, correctCount: 2 });
    expect(stored.guess).toMatchObject({ awardedPoints: 2000, bonusApplied: true });

    hostSocket.send(JSON.stringify({ type: "host.reveal_answer" }));
    const reveal = await playerInbox.nextType("round.revealed");
    expect(reveal.payload).toMatchObject({
      reveal: { answer: "TÔ-MA" },
      verticalResult: { isCorrect: true, awardedPoints: 2000 },
      totalScore: 3000,
    });
    expect(JSON.stringify(reveal.payload)).not.toContain('"answer":"TIN"');

    const reconnectedSocket = await websocket(room.roomCode, "PLAYER", player.playerToken);
    const reconnectedInbox = messageInbox(reconnectedSocket);
    expect((await reconnectedInbox.nextType("room.snapshot")).payload).toMatchObject({
      self: {
        totalScore: 3000,
        crosswordVerticalGuess: {
          itemId: "crossword-1",
          submitted: true,
          result: { isCorrect: true, awardedPoints: 2000 },
        },
      },
    });

    hostSocket.send(JSON.stringify({ type: "host.show_leaderboard" }));
    await playerInbox.nextType("leaderboard.updated");
    hostSocket.send(JSON.stringify({ type: "host.continue" }));
    await playerInbox.nextType("game.countdown_started");
    await forceOpenRound(room.roomCode);
    expect((await playerInbox.nextType("round.opened")).payload).toMatchObject({
      crosswordVerticalPoints: 1330,
    });
  });
});
