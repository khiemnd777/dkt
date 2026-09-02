import { DurableObject } from "cloudflare:workers";
import { AppError, errorResponse } from "../shared/errors";
import type { CrosswordItem, PlayerAnswer, RuntimeRound } from "../shared/game";
import { LIMITS, PROTOCOL_VERSION } from "../shared/limits";
import type { ClientMessage, ServerEventType } from "../shared/protocol";
import { clientMessageSchema } from "../shared/protocol";
import type {
  CrosswordVerticalSubmissionRecord,
  Player,
  RoomGame,
  RoomMeta,
  RoomProgress,
  RoomSecrets,
  RoomSnapshot,
  SessionRole,
  SubmissionRecord,
  WebSocketTicket,
} from "../shared/room";
import { initializeRoomSchema, joinRoomSchema, ticketRequestSchema } from "../shared/schemas";
import { normalizeAnswer, normalizeDisplayName } from "../shared/text";
import type { Env } from "./env";
import { scheduleNextAlarm } from "./room/alarm-scheduler";
import { authenticateSession } from "./room/authentication";
import { rankPlayers } from "./room/ranking";
import { compileGame } from "./room/round-compiler";
import { calculateCrosswordVerticalScore, calculateScore, isCorrectAnswer } from "./room/scoring";
import { filterRoundForPublic } from "./room/snapshot-filter";
import { assertTransition } from "./room/state-machine";
import { bearerToken, hashToken, randomToken } from "./security/crypto";

const KEYS = {
  meta: "room:meta",
  secrets: "room:secrets",
  game: "room:game",
  players: "room:players",
  progress: "room:progress",
  submissions: "room:current-submissions",
  crosswordVerticalSubmissions: "room:crossword-vertical-submissions",
  tickets: "room:tickets",
  finalResult: "room:final-result",
  sequenceLease: "room:sequence-lease",
} as const;

interface RoomState {
  meta: RoomMeta;
  secrets: RoomSecrets;
  game: RoomGame;
  players: Record<string, Player>;
  progress: RoomProgress;
  submissions: Record<string, SubmissionRecord>;
  crosswordVerticalSubmissions: Record<string, Record<string, CrosswordVerticalSubmissionRecord>>;
  tickets: Record<string, WebSocketTicket>;
}

interface ConnectionAttachment {
  connectionId: string;
  role: SessionRole;
  playerId?: string;
  connectedAt: number;
  protocolVersion: number;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export class GameRoom extends DurableObject<Env> {
  private readonly rateWindows = new Map<string, { startedAt: number; count: number }>();
  private pendingCountBroadcast: ReturnType<typeof setTimeout> | undefined;
  private deleted = false;
  private sequenceCursor?: number;
  private sequenceLeaseEnd?: number;
  private operationTail: Promise<void> = Promise.resolve();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  private async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.operationTail;
    let release: () => void = () => undefined;
    this.operationTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      if (path === "/api/rooms" && request.method === "POST")
        return await this.runExclusive(() => this.initialize(request));
      if (path.endsWith("/public") && request.method === "GET")
        return await this.runExclusive(() => this.publicMetadata());
      if (path.endsWith("/join") && request.method === "POST")
        return await this.runExclusive(() => this.join(request));
      if (path.endsWith("/ws-ticket") && request.method === "POST")
        return await this.runExclusive(() => this.createTicket(request));
      if (path.endsWith("/ws") && request.method === "GET")
        return await this.runExclusive(() => this.upgradeWebSocket(request, url));
      if (path.endsWith("/leave") && request.method === "POST")
        return await this.runExclusive(() => this.leave(request));
      return errorResponse("BAD_REQUEST", 404);
    } catch (error) {
      if (error instanceof AppError) return errorResponse(error.code, error.status);
      return errorResponse("INTERNAL_ERROR", 500);
    }
  }

  private async load(): Promise<RoomState | undefined> {
    if (this.deleted) return undefined;
    const [
      meta,
      secrets,
      game,
      players,
      progress,
      submissions,
      crosswordVerticalSubmissions,
      tickets,
    ] = await Promise.all([
      this.ctx.storage.get<RoomMeta>(KEYS.meta),
      this.ctx.storage.get<RoomSecrets>(KEYS.secrets),
      this.ctx.storage.get<RoomGame>(KEYS.game),
      this.ctx.storage.get<Record<string, Player>>(KEYS.players),
      this.ctx.storage.get<RoomProgress>(KEYS.progress),
      this.ctx.storage.get<Record<string, SubmissionRecord>>(KEYS.submissions),
      this.ctx.storage.get<Record<string, Record<string, CrosswordVerticalSubmissionRecord>>>(
        KEYS.crosswordVerticalSubmissions,
      ),
      this.ctx.storage.get<Record<string, WebSocketTicket>>(KEYS.tickets),
    ]);
    if (!meta || !secrets || !game || !players || !progress) return undefined;
    return {
      meta,
      secrets,
      game,
      players,
      progress,
      submissions: submissions ?? {},
      crosswordVerticalSubmissions: crosswordVerticalSubmissions ?? {},
      tickets: tickets ?? {},
    };
  }

  private async parseBody(request: Request, maximum = LIMITS.maxCreateBodyBytes): Promise<unknown> {
    const text = await request.text();
    if (byteLength(text) > maximum) throw new AppError("BODY_TOO_LARGE", 413);
    try {
      return JSON.parse(text);
    } catch {
      throw new AppError("BAD_REQUEST", 400);
    }
  }

  private async initialize(request: Request): Promise<Response> {
    this.deleted = false;
    if (await this.ctx.storage.get(KEYS.meta)) return errorResponse("ROOM_COLLISION", 409);
    const parsed = initializeRoomSchema.safeParse(await this.parseBody(request));
    if (!parsed.success)
      return json(
        {
          error: { code: "BAD_REQUEST", message: "Game chưa hợp lệ.", issues: parsed.error.issues },
        },
        400,
      );
    const roomCode = request.headers.get("x-room-code");
    if (!roomCode) throw new AppError("BAD_REQUEST", 400);
    const rounds = compileGame(parsed.data.game, parsed.data.roomMediaUrls);
    const hostToken = randomToken();
    const screenToken = randomToken();
    const now = Date.now();
    const meta: RoomMeta = {
      roomCode,
      status: "ACTIVE",
      createdAt: now,
      hardExpiresAt: now + LIMITS.maxRoomLifetimeMs,
      inactivityExpiresAt: now + LIMITS.inactivityLifetimeMs,
      lastHostActivityAt: now,
      protocolVersion: PROTOCOL_VERSION,
      stateVersion: 1,
      sequence: 0,
    };
    const secrets: RoomSecrets = {
      hostTokenHash: await hashToken(hostToken),
      screenTokenHash: await hashToken(screenToken),
    };
    const progress: RoomProgress = {
      phase: "LOBBY",
      currentRoundIndex: -1,
      revealedRoundIds: [],
      nextAction: "START_GAME",
    };
    const game: RoomGame = { definition: parsed.data.game, rounds };
    await this.ctx.storage.transaction(async (transaction) => {
      if (await transaction.get(KEYS.meta)) throw new AppError("ROOM_COLLISION", 409);
      await transaction.put({
        [KEYS.meta]: meta,
        [KEYS.secrets]: secrets,
        [KEYS.game]: game,
        [KEYS.players]: {},
        [KEYS.progress]: progress,
        [KEYS.submissions]: {},
        [KEYS.crosswordVerticalSubmissions]: {},
        [KEYS.tickets]: {},
        [KEYS.sequenceLease]: 0,
      });
    });
    await scheduleNextAlarm(this.ctx.storage, meta, progress);
    const origin = new URL(request.url).origin;
    return json(
      {
        roomCode,
        hostToken,
        screenToken,
        hostUrl: `${origin}/host/${roomCode}#token=${encodeURIComponent(hostToken)}`,
        joinUrl: `${origin}/join/${roomCode}`,
        screenUrl: `${origin}/screen/${roomCode}#token=${encodeURIComponent(screenToken)}`,
        expiresAt: meta.hardExpiresAt,
      },
      201,
    );
  }

  private async publicMetadata(): Promise<Response> {
    const state = await this.load();
    if (!state) return errorResponse("ROOM_NOT_FOUND", 404);
    const playerCount = Object.values(state.players).filter((player) => !player.removed).length;
    return json({
      exists: true,
      status: state.meta.status,
      gameTitle: state.game.definition.title,
      mode: state.game.definition.mode,
      playerCount,
      canJoin: state.meta.status === "ACTIVE" && playerCount < LIMITS.maxPlayers,
    });
  }

  private allow(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const current = this.rateWindows.get(key);
    if (!current || now - current.startedAt >= windowMs) {
      this.rateWindows.set(key, { startedAt: now, count: 1 });
      return true;
    }
    current.count += 1;
    return current.count <= limit;
  }

  private async join(request: Request): Promise<Response> {
    if (!this.allow("join", 120, 30_000)) throw new AppError("RATE_LIMITED", 429);
    const state = await this.load();
    if (!state) throw new AppError("ROOM_NOT_FOUND", 404);
    if (state.meta.status !== "ACTIVE") throw new AppError("ROOM_CLOSED", 409);
    const parsed = joinRoomSchema.safeParse(await this.parseBody(request, 8 * 1024));
    if (!parsed.success) throw new AppError("BAD_REQUEST", 400);
    if (parsed.data.reconnectToken) {
      const hash = await hashToken(parsed.data.reconnectToken);
      const existing = Object.values(state.players).find(
        (player) => !player.removed && player.playerTokenHash === hash,
      );
      if (existing) {
        existing.lastSeenAt = Date.now();
        await this.ctx.storage.put(KEYS.players, state.players);
        return json({
          playerId: existing.playerId,
          playerToken: parsed.data.reconnectToken,
          reconnected: true,
        });
      }
    }
    const active = Object.values(state.players).filter((player) => !player.removed);
    if (active.length >= LIMITS.maxPlayers) throw new AppError("ROOM_FULL", 409);
    const baseName = parsed.data.displayName.trim().replace(/\s+/gu, " ");
    const existingNames = new Set(active.map((player) => player.normalizedDisplayName));
    let displayName = baseName;
    let suffix = 2;
    while (existingNames.has(normalizeDisplayName(displayName))) {
      displayName = `${baseName} (${suffix})`;
      suffix += 1;
    }
    const playerToken = randomToken();
    const playerId = crypto.randomUUID();
    const now = Date.now();
    const player: Player = {
      playerId,
      displayName,
      normalizedDisplayName: normalizeDisplayName(displayName),
      avatarId: parsed.data.avatarId,
      playerTokenHash: await hashToken(playerToken),
      joinedAt: now,
      eligibleFromRoundIndex:
        state.progress.phase === "LOBBY" ? 0 : state.progress.currentRoundIndex + 1,
      totalScore: 0,
      correctCount: 0,
      totalCorrectResponseMs: 0,
      lastSeenAt: now,
      removed: false,
    };
    state.players[playerId] = player;
    state.meta.stateVersion += 1;
    await this.ctx.storage.put({ [KEYS.players]: state.players, [KEYS.meta]: state.meta });
    await this.broadcastEvent(
      state.meta,
      "room.player_joined",
      { playerId, displayName, avatarId: player.avatarId, playerCount: active.length + 1 },
      ["HOST", "SCREEN"],
    );
    return json(
      { playerId, playerToken, displayName, eligibleFromRoundIndex: player.eligibleFromRoundIndex },
      201,
    );
  }

  private async createTicket(request: Request): Promise<Response> {
    if (!this.allow("ticket", 240, 30_000)) throw new AppError("RATE_LIMITED", 429);
    const state = await this.load();
    if (!state) throw new AppError("ROOM_NOT_FOUND", 404);
    const token = bearerToken(request);
    if (!token) throw new AppError("UNAUTHORIZED", 401);
    const parsed = ticketRequestSchema.safeParse(await this.parseBody(request, 1024));
    if (!parsed.success) throw new AppError("BAD_REQUEST", 400);
    const session = await authenticateSession(
      token,
      parsed.data.role,
      state.secrets,
      state.players,
    );
    if (!session) throw new AppError("UNAUTHORIZED", 401);
    const rawTicket = randomToken(24);
    const ticketHash = await hashToken(rawTicket);
    const now = Date.now();
    state.tickets = Object.fromEntries(
      Object.entries(state.tickets).filter(([, ticket]) => ticket.expiresAt > now),
    );
    state.tickets[ticketHash] = {
      ticketHash,
      role: session.role,
      playerId: session.playerId,
      expiresAt: now + LIMITS.ticketLifetimeMs,
    };
    if (session.role === "HOST") await this.touchHost(state);
    await this.ctx.storage.put(KEYS.tickets, state.tickets);
    return json({ ticket: rawTicket, expiresAt: now + LIMITS.ticketLifetimeMs });
  }

  private async upgradeWebSocket(request: Request, url: URL): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      throw new AppError("BAD_REQUEST", 400);
    const state = await this.load();
    if (!state) throw new AppError("ROOM_NOT_FOUND", 404);
    const rawTicket = url.searchParams.get("ticket");
    if (!rawTicket) throw new AppError("INVALID_TICKET", 401);
    const ticketHash = await hashToken(rawTicket);
    const ticket = state.tickets[ticketHash];
    if (!ticket || ticket.expiresAt < Date.now()) throw new AppError("INVALID_TICKET", 401);
    delete state.tickets[ticketHash];
    await this.ctx.storage.put(KEYS.tickets, state.tickets);
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const tags: string[] = [ticket.role];
    if (ticket.playerId) tags.push(`player:${ticket.playerId}`);
    this.ctx.acceptWebSocket(server, tags);
    const attachment: ConnectionAttachment = {
      connectionId: crypto.randomUUID(),
      role: ticket.role,
      playerId: ticket.playerId,
      connectedAt: Date.now(),
      protocolVersion: PROTOCOL_VERSION,
    };
    server.serializeAttachment(attachment);
    await this.sendSnapshot(state, server, attachment);
    if (ticket.role === "PLAYER" && ticket.playerId) {
      const player = state.players[ticket.playerId];
      if (player)
        await this.broadcastEvent(
          state.meta,
          "room.player_updated",
          { playerId: player.playerId, connected: true },
          ["HOST", "SCREEN"],
        );
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  private async leave(request: Request): Promise<Response> {
    const state = await this.load();
    if (!state) throw new AppError("ROOM_NOT_FOUND", 404);
    const token = bearerToken(request);
    if (!token) throw new AppError("UNAUTHORIZED", 401);
    const session = await authenticateSession(token, "PLAYER", state.secrets, state.players);
    if (!session?.playerId) throw new AppError("UNAUTHORIZED", 401);
    await this.removePlayer(state, session.playerId, "left");
    return new Response(null, { status: 204 });
  }

  async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.runExclusive(() => this.handleWebSocketMessage(webSocket, message));
  }

  private async handleWebSocketMessage(
    webSocket: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const attachment = webSocket.deserializeAttachment() as ConnectionAttachment | null;
    if (!attachment) return webSocket.close(4401, "Missing session");
    const size = typeof message === "string" ? byteLength(message) : message.byteLength;
    if (size > LIMITS.maxWebSocketMessageBytes) return webSocket.close(4409, "Message too large");
    if (typeof message !== "string")
      return this.sendError(webSocket, "BAD_REQUEST", "Chỉ chấp nhận JSON.");
    if (!this.allow(`ws:${attachment.connectionId}`, 30, 2_000))
      return webSocket.close(4429, "Rate limit");
    let raw: unknown;
    try {
      raw = JSON.parse(message);
    } catch {
      return this.sendError(webSocket, "BAD_REQUEST", "Tin nhắn không hợp lệ.");
    }
    const parsed = clientMessageSchema.safeParse(raw);
    if (!parsed.success) return this.sendError(webSocket, "BAD_REQUEST", "Lệnh không hợp lệ.");
    const state = await this.load();
    if (!state) return webSocket.close(4404, "Room deleted");
    try {
      await this.handleMessage(state, webSocket, attachment, parsed.data);
    } catch (error) {
      if (error instanceof AppError)
        await this.sendError(webSocket, error.code, error.message, state.meta);
      else
        await this.sendError(webSocket, "INTERNAL_ERROR", "Không thể xử lý thao tác.", state.meta);
    }
  }

  private async handleMessage(
    state: RoomState,
    ws: WebSocket,
    attachment: ConnectionAttachment,
    message: ClientMessage,
  ): Promise<void> {
    if (message.type === "client.request_snapshot") return this.sendSnapshot(state, ws, attachment);
    if (message.type === "client.leave") {
      if (attachment.role !== "PLAYER" || !attachment.playerId)
        throw new AppError("UNAUTHORIZED", 403);
      await this.removePlayer(state, attachment.playerId, "left");
      ws.close(1000, "Left room");
      return;
    }
    if (message.type === "player.submit_answer") {
      if (attachment.role !== "PLAYER" || !attachment.playerId)
        throw new AppError("UNAUTHORIZED", 403);
      return this.submitAnswer(state, ws, attachment.playerId, message.payload);
    }
    if (message.type === "player.submit_crossword_vertical") {
      if (attachment.role !== "PLAYER" || !attachment.playerId)
        throw new AppError("UNAUTHORIZED", 403);
      return this.submitCrosswordVertical(state, ws, attachment.playerId, message.payload);
    }
    if (attachment.role !== "HOST") throw new AppError("UNAUTHORIZED", 403);
    await this.touchHost(state);
    switch (message.type) {
      case "host.start_game":
      case "host.open_next_round":
        await this.startCountdown(state);
        break;
      case "host.media_ready":
        await this.activatePreparedMedia(state, message.payload.roundId, message.payload.mode);
        break;
      case "host.pause_round":
        await this.pauseRound(state);
        break;
      case "host.resume_round":
        await this.resumeRound(state);
        break;
      case "host.lock_round":
        await this.lockRound(state);
        break;
      case "host.reveal_answer":
        await this.revealRound(state);
        break;
      case "host.show_leaderboard":
        await this.showLeaderboard(state);
        break;
      case "host.continue":
        await this.continueGame(state);
        break;
      case "host.finish_game":
        await this.finishGame(state);
        break;
      case "host.delete_room":
        await this.deleteRoom(state, "host");
        break;
      case "host.remove_player":
        await this.removePlayer(state, message.payload.playerId, "removed");
        break;
      default:
        throw new AppError("BAD_REQUEST", 400);
    }
  }

  private async touchHost(state: RoomState): Promise<void> {
    const now = Date.now();
    state.meta.lastHostActivityAt = now;
    state.meta.inactivityExpiresAt = Math.min(
      state.meta.hardExpiresAt,
      now + LIMITS.inactivityLifetimeMs,
    );
    await this.ctx.storage.put(KEYS.meta, state.meta);
    await scheduleNextAlarm(this.ctx.storage, state.meta, state.progress);
  }

  private eligiblePlayers(state: RoomState): Player[] {
    return Object.values(state.players).filter(
      (player) =>
        !player.removed && player.eligibleFromRoundIndex <= state.progress.currentRoundIndex,
    );
  }

  private currentRound(state: RoomState): RuntimeRound {
    const round = state.game.rounds[state.progress.currentRoundIndex];
    if (!round) throw new AppError("INVALID_PHASE", 409);
    return round;
  }

  private crosswordVerticalSubmission(
    state: RoomState,
    itemId: string,
    playerId: string,
  ): CrosswordVerticalSubmissionRecord | undefined {
    return state.crosswordVerticalSubmissions[itemId]?.[playerId];
  }

  private crosswordItem(state: RoomState, itemId: string): CrosswordItem | undefined {
    const item = state.game.definition.items.find((candidate) => candidate.id === itemId);
    return item?.type === "CROSSWORD" ? item : undefined;
  }

  private isLastCrosswordHorizontalRound(state: RoomState, round: RuntimeRound): boolean {
    if (round.kind !== "CROSSWORD_HORIZONTAL") return false;
    const horizontalRounds = state.game.rounds.filter(
      (candidate) => candidate.itemId === round.itemId && candidate.kind === "CROSSWORD_HORIZONTAL",
    );
    return horizontalRounds.at(-1)?.roundId === round.roundId;
  }

  private crosswordVerticalReveal(
    state: RoomState,
    round: RuntimeRound,
  ): RoomSnapshot["crosswordVerticalReveal"] {
    if (!this.isLastCrosswordHorizontalRound(state, round)) return undefined;
    const item = this.crosswordItem(state, round.itemId);
    if (!item) return undefined;
    return {
      clue: item.verticalClue,
      answer: item.verticalAnswer,
      bibleReference: item.bibleReference,
      explanation: item.explanation,
    };
  }

  private revealedCrosswordCells(state: RoomState, itemId: string): number {
    return state.game.rounds.filter(
      (candidate) =>
        candidate.itemId === itemId &&
        candidate.kind === "CROSSWORD_HORIZONTAL" &&
        state.progress.revealedRoundIds.includes(candidate.roundId),
    ).length;
  }

  private crosswordVerticalPoints(state: RoomState, round: RuntimeRound): number | undefined {
    const totalCells = round.publicPayload.crossword?.rowCount;
    if (!round.groupId || !totalCells) return undefined;
    return calculateCrosswordVerticalScore({
      isCorrect: true,
      revealedCells: this.revealedCrosswordCells(state, round.itemId),
      totalCells,
    });
  }

  private hasAnsweredCurrentRound(
    state: RoomState,
    _round: RuntimeRound,
    playerId: string,
  ): boolean {
    return Boolean(state.submissions[playerId]);
  }

  private answeredCount(state: RoomState, round = this.currentRound(state)): number {
    return this.eligiblePlayers(state).filter((player) =>
      this.hasAnsweredCurrentRound(state, round, player.playerId),
    ).length;
  }

  private async startCountdown(state: RoomState): Promise<void> {
    if (!["LOBBY", "ANSWER_REVEAL", "LEADERBOARD"].includes(state.progress.phase))
      throw new AppError("INVALID_PHASE", 409);
    const nextIndex = state.progress.currentRoundIndex + 1;
    if (nextIndex >= state.game.rounds.length) return this.finishGame(state);
    assertTransition(state.progress.phase, "COUNTDOWN");
    state.progress = {
      ...state.progress,
      phase: "COUNTDOWN",
      currentRoundIndex: nextIndex,
      countdownEndsAt: Date.now() + LIMITS.countdownMs,
      mediaReadyDeadlineAt: undefined,
      mediaStartAt: undefined,
      answerOpenedAt: undefined,
      openedAt: undefined,
      deadlineAt: undefined,
      nextAction: "WAIT_FOR_QUESTION",
      pausedRemainingMs: undefined,
      elapsedBeforePauseMs: 0,
    };
    state.submissions = {};
    state.meta.stateVersion += 1;
    await this.ctx.storage.put({
      [KEYS.meta]: state.meta,
      [KEYS.progress]: state.progress,
      [KEYS.submissions]: state.submissions,
    });
    await scheduleNextAlarm(this.ctx.storage, state.meta, state.progress);
    await this.broadcastEvent(state.meta, "game.countdown_started", {
      currentRoundIndex: nextIndex,
      countdownEndsAt: state.progress.countdownEndsAt,
    });
  }

  private async beginMediaPrepare(state: RoomState): Promise<void> {
    if (state.progress.phase !== "COUNTDOWN") return;
    const round = this.currentRound(state);
    const media = round.publicPayload.media;
    if (!media) return this.openRound(state);
    assertTransition("COUNTDOWN", "MEDIA_PREPARE");
    const now = Date.now();
    state.progress.phase = "MEDIA_PREPARE";
    state.progress.countdownEndsAt = undefined;
    state.progress.mediaReadyDeadlineAt = now + LIMITS.mediaReadyTimeoutMs;
    state.progress.mediaStartAt = undefined;
    state.progress.answerOpenedAt = undefined;
    state.progress.nextAction = "WAIT_FOR_MEDIA_READY";
    state.meta.stateVersion += 1;
    await this.ctx.storage.put({ [KEYS.meta]: state.meta, [KEYS.progress]: state.progress });
    await scheduleNextAlarm(this.ctx.storage, state.meta, state.progress);
    await this.broadcastEvent(state.meta, "round.media_started", {
      round: filterRoundForPublic(round),
      mediaReadyDeadlineAt: state.progress.mediaReadyDeadlineAt,
    });
  }

  private async activatePreparedMedia(
    state: RoomState,
    roundId: string,
    mode: "READY" | "FALLBACK",
  ): Promise<void> {
    if (state.progress.phase !== "MEDIA_PREPARE" || state.progress.answerOpenedAt) return;
    const round = this.currentRound(state);
    if (round.roundId !== roundId) throw new AppError("BAD_REQUEST", 400);
    const now = Date.now();
    const prepareMs =
      mode === "FALLBACK"
        ? 250
        : round.publicPayload.media?.kind === "AUDIO"
          ? (round.publicPayload.media.durationMs ?? 0)
          : LIMITS.imagePrepareMs;
    state.progress.mediaReadyDeadlineAt = undefined;
    state.progress.mediaStartAt = now;
    state.progress.answerOpenedAt = now + Math.max(prepareMs, 250);
    state.progress.nextAction = "WAIT_FOR_MEDIA";
    state.meta.stateVersion += 1;
    await this.ctx.storage.put({ [KEYS.meta]: state.meta, [KEYS.progress]: state.progress });
    await scheduleNextAlarm(this.ctx.storage, state.meta, state.progress);
    await this.broadcastEvent(state.meta, "round.media_started", {
      round: filterRoundForPublic(round),
      mediaStartAt: state.progress.mediaStartAt,
      answerOpenedAt: state.progress.answerOpenedAt,
      fallback: mode === "FALLBACK",
    });
  }

  private async openRound(state: RoomState): Promise<void> {
    if (state.progress.phase !== "COUNTDOWN" && state.progress.phase !== "MEDIA_PREPARE") return;
    assertTransition(state.progress.phase, "QUESTION_OPEN");
    const round = this.currentRound(state);
    const now = Date.now();
    state.progress.phase = "QUESTION_OPEN";
    state.progress.countdownEndsAt = undefined;
    state.progress.mediaReadyDeadlineAt = undefined;
    state.progress.mediaStartAt = undefined;
    state.progress.answerOpenedAt = undefined;
    state.progress.openedAt = now;
    state.progress.deadlineAt = now + round.durationSec * 1000;
    state.progress.pausedRemainingMs = undefined;
    state.progress.elapsedBeforePauseMs = 0;
    state.progress.nextAction = "LOCK_ROUND";
    state.meta.stateVersion += 1;
    await this.ctx.storage.put({ [KEYS.meta]: state.meta, [KEYS.progress]: state.progress });
    await scheduleNextAlarm(this.ctx.storage, state.meta, state.progress);
    const eligibleCount = this.eligiblePlayers(state).length;
    const answeredCount = this.answeredCount(state, round);
    await this.broadcastEvent(state.meta, "round.opened", {
      round: filterRoundForPublic(round),
      openedAt: state.progress.openedAt,
      deadlineAt: state.progress.deadlineAt,
      eligibleCount,
      answeredCount,
      crosswordVerticalPoints: this.crosswordVerticalPoints(state, round),
    });
    if (eligibleCount > 0 && answeredCount >= eligibleCount) await this.lockRound(state);
  }

  private async submitAnswer(
    state: RoomState,
    ws: WebSocket,
    playerId: string,
    payload: { roundId: string; submissionId: string; answer: PlayerAnswer },
  ): Promise<void> {
    if (state.progress.phase !== "QUESTION_OPEN") throw new AppError("INVALID_PHASE", 409);
    const round = this.currentRound(state);
    if (payload.roundId !== round.roundId) throw new AppError("BAD_REQUEST", 400);
    const player = state.players[playerId];
    if (!player || player.removed) throw new AppError("UNAUTHORIZED", 403);
    if (player.eligibleFromRoundIndex > state.progress.currentRoundIndex)
      throw new AppError("NOT_ELIGIBLE", 409);
    const receivedAt = Date.now();
    if (
      !state.progress.deadlineAt ||
      !state.progress.openedAt ||
      receivedAt > state.progress.deadlineAt
    ) {
      throw new AppError("LATE_ANSWER", 409);
    }
    const previous = state.submissions[playerId];
    if (previous) {
      if (previous.submissionId === payload.submissionId) {
        await this.sendEvent(state.meta, ws, "answer.accepted", {
          roundId: round.roundId,
          submissionId: previous.submissionId,
        });
        return;
      }
      throw new AppError("DUPLICATE_ANSWER", 409);
    }
    const correct = isCorrectAnswer(round, payload.answer);
    const responseMs = Math.min(
      round.durationSec * 1_000,
      Math.max(
        0,
        (state.progress.elapsedBeforePauseMs ?? 0) + (receivedAt - state.progress.openedAt),
      ),
    );
    const scoringOpenedAt = receivedAt - responseMs;
    const record: SubmissionRecord = {
      roundId: round.roundId,
      playerId,
      submissionId: payload.submissionId,
      isCorrect: correct,
      awardedPoints: calculateScore({
        mode: state.game.definition.mode,
        isCorrect: correct,
        openedAt: scoringOpenedAt,
        deadlineAt: scoringOpenedAt + round.durationSec * 1_000,
        receivedAt,
        multiplier: round.scoreMultiplier,
      }),
      responseMs,
      submittedAt: receivedAt,
    };
    state.submissions[playerId] = record;
    await this.ctx.storage.put({
      [KEYS.submissions]: state.submissions,
      [KEYS.crosswordVerticalSubmissions]: state.crosswordVerticalSubmissions,
    });
    await this.sendEvent(state.meta, ws, "answer.accepted", {
      roundId: round.roundId,
      submissionId: record.submissionId,
    });
    this.scheduleAnswerCount();
    if (this.answeredCount(state, round) >= this.eligiblePlayers(state).length)
      await this.lockRound(state);
  }

  private async submitCrosswordVertical(
    state: RoomState,
    ws: WebSocket,
    playerId: string,
    payload: { roundId: string; submissionId: string; value: string },
  ): Promise<void> {
    if (state.progress.phase !== "QUESTION_OPEN") throw new AppError("INVALID_PHASE", 409);
    const round = this.currentRound(state);
    if (round.kind !== "CROSSWORD_HORIZONTAL" || payload.roundId !== round.roundId)
      throw new AppError("BAD_REQUEST", 400);
    const crossword = this.crosswordItem(state, round.itemId);
    const totalCells = round.publicPayload.crossword?.rowCount;
    if (!crossword || !totalCells) throw new AppError("BAD_REQUEST", 400);
    const player = state.players[playerId];
    if (!player || player.removed) throw new AppError("UNAUTHORIZED", 403);
    if (player.eligibleFromRoundIndex > state.progress.currentRoundIndex)
      throw new AppError("NOT_ELIGIBLE", 409);
    const receivedAt = Date.now();
    if (
      !state.progress.deadlineAt ||
      !state.progress.openedAt ||
      receivedAt > state.progress.deadlineAt
    ) {
      throw new AppError("LATE_ANSWER", 409);
    }
    const previous = this.crosswordVerticalSubmission(state, round.itemId, playerId);
    if (previous) {
      if (previous.submissionId === payload.submissionId) {
        await this.sendEvent(state.meta, ws, "crossword.vertical_answer_accepted", {
          itemId: round.itemId,
          submissionId: previous.submissionId,
        });
        return;
      }
      throw new AppError("DUPLICATE_CROSSWORD_VERTICAL", 409);
    }
    const correct = normalizeAnswer(crossword.verticalAnswer) === normalizeAnswer(payload.value);
    const responseMs = Math.min(
      round.durationSec * 1_000,
      Math.max(
        0,
        (state.progress.elapsedBeforePauseMs ?? 0) + (receivedAt - state.progress.openedAt),
      ),
    );
    const record: CrosswordVerticalSubmissionRecord = {
      roundId: `${round.itemId}:vertical`,
      itemId: round.itemId,
      contextRoundId: round.roundId,
      playerId,
      submissionId: payload.submissionId,
      isCorrect: correct,
      awardedPoints: calculateCrosswordVerticalScore({
        isCorrect: correct,
        revealedCells: this.revealedCrosswordCells(state, round.itemId),
        totalCells,
      }),
      responseMs,
      submittedAt: receivedAt,
      bonusApplied: false,
    };
    const itemSubmissions = state.crosswordVerticalSubmissions[round.itemId] ?? {};
    itemSubmissions[playerId] = record;
    state.crosswordVerticalSubmissions[round.itemId] = itemSubmissions;
    await this.ctx.storage.put(
      KEYS.crosswordVerticalSubmissions,
      state.crosswordVerticalSubmissions,
    );
    await this.sendEvent(state.meta, ws, "crossword.vertical_answer_accepted", {
      itemId: round.itemId,
      submissionId: record.submissionId,
    });
  }

  private scheduleAnswerCount(): void {
    if (this.pendingCountBroadcast) return;
    this.pendingCountBroadcast = setTimeout(() => {
      this.pendingCountBroadcast = undefined;
      void this.runExclusive(() => this.broadcastAnswerCount());
    }, 250);
  }

  private async pauseRound(state: RoomState): Promise<void> {
    if (state.progress.phase !== "QUESTION_OPEN") throw new AppError("INVALID_PHASE", 409);
    const now = Date.now();
    if (!state.progress.openedAt || !state.progress.deadlineAt)
      throw new AppError("INVALID_PHASE", 409);
    if (now >= state.progress.deadlineAt) return this.lockRound(state);
    assertTransition("QUESTION_OPEN", "QUESTION_PAUSED");
    const round = this.currentRound(state);
    state.progress.elapsedBeforePauseMs = Math.min(
      round.durationSec * 1_000,
      (state.progress.elapsedBeforePauseMs ?? 0) + (now - state.progress.openedAt),
    );
    state.progress.pausedRemainingMs = Math.max(1, state.progress.deadlineAt - now);
    state.progress.phase = "QUESTION_PAUSED";
    state.progress.openedAt = undefined;
    state.progress.deadlineAt = undefined;
    state.progress.nextAction = "RESUME_ROUND";
    state.meta.stateVersion += 1;
    await this.ctx.storage.put({ [KEYS.meta]: state.meta, [KEYS.progress]: state.progress });
    await scheduleNextAlarm(this.ctx.storage, state.meta, state.progress);
    await this.broadcastEvent(state.meta, "round.paused", {
      remainingMs: state.progress.pausedRemainingMs,
    });
  }

  private async resumeRound(state: RoomState): Promise<void> {
    if (state.progress.phase !== "QUESTION_PAUSED") throw new AppError("INVALID_PHASE", 409);
    const remainingMs = state.progress.pausedRemainingMs;
    if (!remainingMs || remainingMs < 1) throw new AppError("INVALID_PHASE", 409);
    assertTransition("QUESTION_PAUSED", "QUESTION_OPEN");
    const now = Date.now();
    state.progress.phase = "QUESTION_OPEN";
    state.progress.openedAt = now;
    state.progress.deadlineAt = now + remainingMs;
    state.progress.pausedRemainingMs = undefined;
    state.progress.nextAction = "LOCK_ROUND";
    state.meta.stateVersion += 1;
    await this.ctx.storage.put({ [KEYS.meta]: state.meta, [KEYS.progress]: state.progress });
    await scheduleNextAlarm(this.ctx.storage, state.meta, state.progress);
    await this.broadcastEvent(state.meta, "round.resumed", {
      openedAt: state.progress.openedAt,
      deadlineAt: state.progress.deadlineAt,
    });
  }

  private async broadcastAnswerCount(): Promise<void> {
    const fresh = await this.load();
    if (fresh?.progress.phase !== "QUESTION_OPEN") return;
    await this.broadcastEvent(
      fresh.meta,
      "round.answer_count",
      {
        answeredCount: this.answeredCount(fresh),
        eligibleCount: this.eligiblePlayers(fresh).length,
      },
      ["HOST", "SCREEN"],
    );
  }

  private async lockRound(state: RoomState): Promise<void> {
    if (state.progress.phase !== "QUESTION_OPEN") throw new AppError("INVALID_PHASE", 409);
    if (this.pendingCountBroadcast) {
      clearTimeout(this.pendingCountBroadcast);
      this.pendingCountBroadcast = undefined;
    }
    assertTransition("QUESTION_OPEN", "QUESTION_LOCKED");
    const round = this.currentRound(state);
    for (const submission of Object.values(state.submissions)) {
      const player = state.players[submission.playerId];
      if (!player || player.removed) continue;
      player.totalScore += submission.awardedPoints;
      if (submission.isCorrect) {
        player.correctCount += 1;
        player.totalCorrectResponseMs += submission.responseMs;
      }
    }
    if (round.kind === "CROSSWORD_HORIZONTAL") {
      const itemSubmissions = state.crosswordVerticalSubmissions[round.itemId] ?? {};
      for (const submission of Object.values(itemSubmissions)) {
        if (submission.contextRoundId !== round.roundId || submission.bonusApplied) continue;
        const player = state.players[submission.playerId];
        submission.bonusApplied = true;
        if (!player || player.removed) continue;
        player.totalScore += submission.awardedPoints;
        if (submission.isCorrect) {
          player.correctCount += 1;
          player.totalCorrectResponseMs += submission.responseMs;
        }
      }
    }
    state.progress.phase = "QUESTION_LOCKED";
    state.progress.nextAction = "REVEAL_ANSWER";
    state.meta.stateVersion += 1;
    await this.ctx.storage.put({
      [KEYS.meta]: state.meta,
      [KEYS.players]: state.players,
      [KEYS.progress]: state.progress,
      [KEYS.crosswordVerticalSubmissions]: state.crosswordVerticalSubmissions,
    });
    await scheduleNextAlarm(this.ctx.storage, state.meta, state.progress);
    await this.broadcastEvent(state.meta, "round.locked", {
      answeredCount: this.answeredCount(state, round),
      eligibleCount: this.eligiblePlayers(state).length,
    });
  }

  private async revealRound(state: RoomState): Promise<void> {
    if (state.progress.phase !== "QUESTION_LOCKED") throw new AppError("INVALID_PHASE", 409);
    assertTransition("QUESTION_LOCKED", "ANSWER_REVEAL");
    const round = this.currentRound(state);
    state.progress.phase = "ANSWER_REVEAL";
    state.progress.nextAction = "SHOW_LEADERBOARD";
    if (!state.progress.revealedRoundIds.includes(round.roundId))
      state.progress.revealedRoundIds.push(round.roundId);
    state.meta.stateVersion += 1;
    await this.ctx.storage.put({ [KEYS.meta]: state.meta, [KEYS.progress]: state.progress });
    const crosswordVerticalReveal = this.crosswordVerticalReveal(state, round);
    const correct = Object.values(state.submissions).filter((submission) => submission.isCorrect);
    const fastestAt = correct.length
      ? Math.min(...correct.map((submission) => submission.submittedAt))
      : undefined;
    const fastestPlayerIds = correct
      .filter((submission) => fastestAt !== undefined && submission.submittedAt - fastestAt <= 150)
      .map((submission) => submission.playerId);
    await this.broadcastEvent(
      state.meta,
      "round.revealed",
      {
        roundId: round.roundId,
        reveal: round.revealPayload,
        crosswordVerticalReveal,
        correctCount: correct.length,
        fastestPlayerIds: state.game.definition.mode === "SPEED_RACE" ? fastestPlayerIds : [],
      },
      ["HOST", "SCREEN"],
    );
    for (const player of this.eligiblePlayers(state)) {
      const result = state.submissions[player.playerId];
      const verticalSubmission = this.crosswordVerticalSubmission(
        state,
        round.itemId,
        player.playerId,
      );
      const verticalResult =
        round.kind === "CROSSWORD_HORIZONTAL" &&
        verticalSubmission?.contextRoundId === round.roundId
          ? {
              isCorrect: verticalSubmission.isCorrect,
              awardedPoints: verticalSubmission.awardedPoints,
            }
          : undefined;
      for (const socket of this.ctx.getWebSockets(`player:${player.playerId}`)) {
        await this.sendEvent(state.meta, socket, "round.revealed", {
          roundId: round.roundId,
          reveal: round.revealPayload,
          crosswordVerticalReveal,
          result: result
            ? {
                isCorrect: result.isCorrect,
                awardedPoints: result.awardedPoints,
              }
            : { isCorrect: false, awardedPoints: 0 },
          verticalResult,
          totalScore: player.totalScore,
          fastest: fastestPlayerIds.includes(player.playerId),
        });
      }
    }
    if (round.kind.startsWith("CROSSWORD")) {
      await this.broadcastEvent(state.meta, "crossword.board_updated", {
        revealedRoundIds: state.progress.revealedRoundIds,
        crosswordVerticalPoints: this.crosswordVerticalPoints(state, round),
      });
    }
  }

  private leaderboard(state: RoomState) {
    return rankPlayers(Object.values(state.players), state.game.definition.mode).map((entry) => ({
      playerId: entry.playerId,
      displayName: entry.displayName,
      avatarId: entry.avatarId,
      rank: entry.rank,
      totalScore: entry.totalScore,
      correctCount: entry.correctCount,
      totalCorrectResponseMs: entry.totalCorrectResponseMs,
    }));
  }

  private async showLeaderboard(state: RoomState): Promise<void> {
    if (state.progress.phase !== "ANSWER_REVEAL") throw new AppError("INVALID_PHASE", 409);
    assertTransition("ANSWER_REVEAL", "LEADERBOARD");
    state.progress.phase = "LEADERBOARD";
    state.progress.nextAction =
      state.progress.currentRoundIndex + 1 < state.game.rounds.length
        ? "NEXT_ROUND"
        : "FINISH_GAME";
    state.meta.stateVersion += 1;
    const leaderboard = this.leaderboard(state);
    await this.ctx.storage.put({
      [KEYS.meta]: state.meta,
      [KEYS.progress]: state.progress,
      [KEYS.finalResult]: leaderboard,
    });
    await this.broadcastEvent(state.meta, "leaderboard.updated", { leaderboard });
  }

  private async continueGame(state: RoomState): Promise<void> {
    if (state.progress.phase === "QUESTION_LOCKED") return this.revealRound(state);
    if (state.progress.phase === "ANSWER_REVEAL") return this.showLeaderboard(state);
    if (state.progress.phase === "LEADERBOARD") {
      if (state.progress.currentRoundIndex + 1 >= state.game.rounds.length)
        return this.finishGame(state);
      return this.startCountdown(state);
    }
    throw new AppError("INVALID_PHASE", 409);
  }

  private async finishGame(state: RoomState): Promise<void> {
    if (state.progress.phase === "QUESTION_OPEN") await this.lockRound(state);
    if (state.progress.phase === "DELETING" || state.progress.phase === "FINISHED")
      throw new AppError("INVALID_PHASE", 409);
    state.progress.phase = "FINISHED";
    state.progress.nextAction = "DELETE_ROOM";
    state.meta.status = "FINISHED";
    state.meta.finishedDeleteAt = Date.now() + LIMITS.finishedRetentionMs;
    state.meta.stateVersion += 1;
    const leaderboard = this.leaderboard(state);
    await this.ctx.storage.put({
      [KEYS.meta]: state.meta,
      [KEYS.progress]: state.progress,
      [KEYS.finalResult]: leaderboard,
    });
    await scheduleNextAlarm(this.ctx.storage, state.meta, state.progress);
    await this.broadcastEvent(state.meta, "game.finished", {
      leaderboard,
      finishedDeleteAt: state.meta.finishedDeleteAt,
    });
  }

  private async removePlayer(
    state: RoomState,
    playerId: string,
    reason: "left" | "removed",
  ): Promise<void> {
    const player = state.players[playerId];
    if (!player || player.removed) return;
    player.removed = true;
    state.meta.stateVersion += 1;
    await this.ctx.storage.put({ [KEYS.players]: state.players, [KEYS.meta]: state.meta });
    for (const socket of this.ctx.getWebSockets(`player:${playerId}`)) socket.close(4403, reason);
    const playerCount = Object.values(state.players).filter(
      (candidate) => !candidate.removed,
    ).length;
    await this.broadcastEvent(state.meta, "room.player_left", { playerId, reason, playerCount }, [
      "HOST",
      "SCREEN",
    ]);
  }

  private async deleteRoom(
    state: RoomState,
    reason: "host" | "expired" | "finished",
  ): Promise<void> {
    state.progress.phase = "DELETING";
    state.meta.status = "DELETING";
    state.meta.stateVersion += 1;
    await this.ctx.storage.put({ [KEYS.meta]: state.meta, [KEYS.progress]: state.progress });
    await this.broadcastEvent(state.meta, "room.deleted", { reason });
    for (const socket of this.ctx.getWebSockets()) socket.close(4404, "Room deleted");
    await this.ctx.storage.deleteAll();
    this.deleted = true;
    this.sequenceCursor = undefined;
    this.sequenceLeaseEnd = undefined;
  }

  private async sendSnapshot(
    state: RoomState,
    socket: WebSocket,
    attachment: ConnectionAttachment,
  ): Promise<void> {
    const round = state.game.rounds[state.progress.currentRoundIndex];
    const revealVisible = ["ANSWER_REVEAL", "LEADERBOARD", "FINISHED"].includes(
      state.progress.phase,
    );
    const eligible = this.eligiblePlayers(state);
    const leaderboard = this.leaderboard(state);
    const snapshot: RoomSnapshot = {
      roomCode: state.meta.roomCode,
      gameTitle: state.game.definition.title,
      mode: state.game.definition.mode,
      phase: state.progress.phase,
      currentRoundIndex: state.progress.currentRoundIndex,
      totalRounds: state.game.rounds.length,
      playerCount: Object.values(state.players).filter((player) => !player.removed).length,
      eligibleCount: eligible.length,
      answeredCount: round ? this.answeredCount(state, round) : 0,
      openedAt: state.progress.openedAt,
      deadlineAt: state.progress.deadlineAt,
      countdownEndsAt: state.progress.countdownEndsAt,
      mediaReadyDeadlineAt: state.progress.mediaReadyDeadlineAt,
      mediaStartAt: state.progress.mediaStartAt,
      answerOpenedAt: state.progress.answerOpenedAt,
      pausedRemainingMs: state.progress.pausedRemainingMs,
      currentRound:
        round && state.progress.phase !== "LOBBY" ? filterRoundForPublic(round) : undefined,
      reveal: round && revealVisible ? round.revealPayload : undefined,
      crosswordVerticalReveal:
        round && revealVisible ? this.crosswordVerticalReveal(state, round) : undefined,
      leaderboard: ["LEADERBOARD", "FINISHED"].includes(state.progress.phase)
        ? leaderboard
        : undefined,
      revealedRoundIds: state.progress.revealedRoundIds,
      crosswordReveals: Object.fromEntries(
        state.game.rounds
          .filter(
            (candidate) =>
              candidate.kind.startsWith("CROSSWORD") &&
              state.progress.revealedRoundIds.includes(candidate.roundId),
          )
          .map((candidate) => [candidate.roundId, candidate.revealPayload]),
      ),
      crosswordVerticalPoints: round ? this.crosswordVerticalPoints(state, round) : undefined,
      finishedDeleteAt: state.meta.finishedDeleteAt,
    };
    if (attachment.role === "HOST") {
      snapshot.players = Object.values(state.players).map((player) => ({
        playerId: player.playerId,
        displayName: player.displayName,
        avatarId: player.avatarId,
        removed: player.removed,
        connected: this.ctx.getWebSockets(`player:${player.playerId}`).length > 0,
        answered: round ? this.hasAnsweredCurrentRound(state, round, player.playerId) : false,
      }));
    }
    if (attachment.role === "PLAYER" && attachment.playerId) {
      const player = state.players[attachment.playerId];
      const result = state.submissions[attachment.playerId];
      const verticalSubmission = round?.groupId
        ? this.crosswordVerticalSubmission(state, round.itemId, attachment.playerId)
        : undefined;
      if (player) {
        snapshot.self = {
          playerId: player.playerId,
          displayName: player.displayName,
          avatarId: player.avatarId,
          totalScore: player.totalScore,
          correctCount: player.correctCount,
          eligibleFromRoundIndex: player.eligibleFromRoundIndex,
          submitted: Boolean(result),
          currentResult:
            revealVisible && result
              ? {
                  isCorrect: result.isCorrect,
                  awardedPoints: result.awardedPoints,
                }
              : undefined,
          crosswordVerticalGuess: verticalSubmission
            ? {
                itemId: verticalSubmission.itemId,
                submitted: true,
                result:
                  revealVisible && verticalSubmission.contextRoundId === round?.roundId
                    ? {
                        isCorrect: verticalSubmission.isCorrect,
                        awardedPoints: verticalSubmission.awardedPoints,
                      }
                    : undefined,
              }
            : undefined,
          rank: leaderboard.find((entry) => entry.playerId === player.playerId)?.rank,
        };
      }
    }
    await this.sendEvent(state.meta, socket, "room.snapshot", snapshot);
  }

  private async nextEvent(
    meta: RoomMeta,
    type: ServerEventType,
    payload: unknown,
  ): Promise<string> {
    if (this.sequenceCursor === undefined || this.sequenceLeaseEnd === undefined) {
      const storedLease = (await this.ctx.storage.get<number>(KEYS.sequenceLease)) ?? meta.sequence;
      this.sequenceCursor = Math.max(meta.sequence, storedLease);
      this.sequenceLeaseEnd = this.sequenceCursor;
    }
    if (this.sequenceCursor >= this.sequenceLeaseEnd) {
      this.sequenceLeaseEnd = this.sequenceCursor + 256;
      await this.ctx.storage.put(KEYS.sequenceLease, this.sequenceLeaseEnd);
    }
    this.sequenceCursor += 1;
    meta.sequence = this.sequenceCursor;
    return JSON.stringify({
      type,
      protocolVersion: PROTOCOL_VERSION,
      sequence: meta.sequence,
      serverTime: Date.now(),
      roomStateVersion: meta.stateVersion,
      payload,
    });
  }

  private async sendEvent(
    meta: RoomMeta,
    socket: WebSocket,
    type: ServerEventType,
    payload: unknown,
  ): Promise<void> {
    const event = await this.nextEvent(meta, type, payload);
    try {
      socket.send(event);
    } catch {
      // A disconnected socket is removed by the runtime; no room content is logged.
    }
  }

  private async broadcastEvent(
    meta: RoomMeta,
    type: ServerEventType,
    payload: unknown,
    roles?: SessionRole[],
  ): Promise<void> {
    const event = await this.nextEvent(meta, type, payload);
    const sockets = roles
      ? Array.from(new Set(roles.flatMap((role) => this.ctx.getWebSockets(role))))
      : this.ctx.getWebSockets();
    for (const socket of sockets) {
      try {
        socket.send(event);
      } catch {
        // A disconnected socket is removed by the runtime; no room content is logged.
      }
    }
  }

  private async sendError(
    socket: WebSocket,
    code: string,
    message: string,
    meta?: RoomMeta,
  ): Promise<void> {
    const state = meta ? undefined : await this.load();
    const currentMeta = meta ?? state?.meta;
    if (!currentMeta) return socket.close(4404, "Room not found");
    await this.sendEvent(
      currentMeta,
      socket,
      code === "DUPLICATE_ANSWER" ||
        code === "DUPLICATE_CROSSWORD_VERTICAL" ||
        code === "LATE_ANSWER"
        ? "answer.rejected"
        : "server.error",
      { code, message },
    );
  }

  async webSocketClose(
    webSocket: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean,
  ): Promise<void> {
    await this.runExclusive(() => this.handleWebSocketClose(webSocket, code, reason, wasClean));
  }

  private async handleWebSocketClose(
    webSocket: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean,
  ): Promise<void> {
    const attachment = webSocket.deserializeAttachment() as ConnectionAttachment | null;
    if (!attachment?.playerId) return;
    const state = await this.load();
    if (!state) return;
    const stillConnected = this.ctx
      .getWebSockets(`player:${attachment.playerId}`)
      .some((socket) => socket !== webSocket);
    if (!stillConnected) {
      await this.broadcastEvent(
        state.meta,
        "room.player_updated",
        { playerId: attachment.playerId, connected: false },
        ["HOST", "SCREEN"],
      );
    }
    void code;
    void reason;
    void wasClean;
  }

  async webSocketError(webSocket: WebSocket): Promise<void> {
    webSocket.close(1011, "Connection error");
  }

  async alarm(): Promise<void> {
    await this.runExclusive(() => this.handleAlarm());
  }

  private async handleAlarm(): Promise<void> {
    const state = await this.load();
    if (!state) return;
    const now = Date.now();
    if (now >= state.meta.hardExpiresAt || now >= state.meta.inactivityExpiresAt) {
      await this.deleteRoom(state, "expired");
      return;
    }
    if (state.meta.finishedDeleteAt && now >= state.meta.finishedDeleteAt) {
      await this.deleteRoom(state, "finished");
      return;
    }
    if (
      state.meta.finishedDeleteAt &&
      now >= state.meta.finishedDeleteAt - LIMITS.deletionWarningMs &&
      state.progress.nextAction !== "DELETE_WARNING_SENT"
    ) {
      state.progress.nextAction = "DELETE_WARNING_SENT";
      await this.ctx.storage.put(KEYS.progress, state.progress);
      await this.broadcastEvent(state.meta, "room.expiring", {
        deleteAt: state.meta.finishedDeleteAt,
      });
    }
    if (
      state.progress.phase === "COUNTDOWN" &&
      state.progress.countdownEndsAt &&
      now >= state.progress.countdownEndsAt
    ) {
      await this.beginMediaPrepare(state);
      return;
    }
    if (
      state.progress.phase === "MEDIA_PREPARE" &&
      state.progress.mediaReadyDeadlineAt &&
      now >= state.progress.mediaReadyDeadlineAt
    ) {
      await this.activatePreparedMedia(state, this.currentRound(state).roundId, "FALLBACK");
      return;
    }
    if (
      state.progress.phase === "MEDIA_PREPARE" &&
      state.progress.answerOpenedAt &&
      now >= state.progress.answerOpenedAt
    ) {
      await this.openRound(state);
      return;
    }
    if (
      state.progress.phase === "QUESTION_OPEN" &&
      state.progress.deadlineAt &&
      now >= state.progress.deadlineAt
    ) {
      await this.lockRound(state);
      return;
    }
    await scheduleNextAlarm(this.ctx.storage, state.meta, state.progress);
  }
}
