import type { ServerEvent } from "@shared/protocol";
import type { LeaderboardEntry, RoomSnapshot, SessionRole } from "@shared/room";
import { useCallback, useEffect, useRef, useState } from "react";
import { type ConnectionState, RealtimeClient } from "./RealtimeClient";

type Send = RealtimeClient["send"];

function applyEvent(
  current: RoomSnapshot | undefined,
  event: ServerEvent,
): RoomSnapshot | undefined {
  if (event.type === "room.snapshot") return event.payload as RoomSnapshot;
  if (!current) return current;
  const payload = event.payload as Record<string, unknown>;
  switch (event.type) {
    case "room.player_joined": {
      const joined = payload as {
        playerId: string;
        displayName: string;
        avatarId: string;
        playerCount?: number;
      };
      const alreadyPresent = current.players?.some((player) => player.playerId === joined.playerId);
      const { playerCount, ...joinedPlayer } = joined;
      return {
        ...current,
        playerCount:
          typeof playerCount === "number"
            ? playerCount
            : alreadyPresent
              ? current.playerCount
              : current.playerCount + 1,
        players: current.players
          ? alreadyPresent
            ? current.players.map((player) =>
                player.playerId === joined.playerId
                  ? { ...player, ...joinedPlayer, removed: false }
                  : player,
              )
            : [
                ...current.players,
                { ...joinedPlayer, removed: false, connected: false, answered: false },
              ]
          : current.players,
      };
    }
    case "room.player_left":
      return {
        ...current,
        playerCount:
          typeof payload.playerCount === "number"
            ? payload.playerCount
            : Math.max(0, current.playerCount - 1),
        players: current.players?.map((player) =>
          player.playerId === payload.playerId
            ? { ...player, removed: true, connected: false }
            : player,
        ),
      };
    case "room.player_updated":
      return {
        ...current,
        players: current.players?.map((player) =>
          player.playerId === payload.playerId
            ? { ...player, connected: Boolean(payload.connected) }
            : player,
        ),
      };
    case "game.countdown_started":
      return {
        ...current,
        phase: "COUNTDOWN",
        currentRoundIndex: Number(payload.currentRoundIndex),
        countdownEndsAt: Number(payload.countdownEndsAt),
        mediaReadyDeadlineAt: undefined,
        mediaStartAt: undefined,
        answerOpenedAt: undefined,
        currentRound: undefined,
        reveal: undefined,
        crosswordVerticalReveal: undefined,
        answeredCount: 0,
        crosswordVerticalPoints: undefined,
      };
    case "round.media_started":
      return {
        ...current,
        phase: "MEDIA_PREPARE",
        currentRound: payload.round as RoomSnapshot["currentRound"],
        countdownEndsAt: undefined,
        mediaReadyDeadlineAt:
          typeof payload.mediaReadyDeadlineAt === "number"
            ? payload.mediaReadyDeadlineAt
            : undefined,
        mediaStartAt: typeof payload.mediaStartAt === "number" ? payload.mediaStartAt : undefined,
        answerOpenedAt:
          typeof payload.answerOpenedAt === "number" ? payload.answerOpenedAt : undefined,
        reveal: undefined,
        answeredCount: 0,
      };
    case "round.opened": {
      const opened = payload as unknown as {
        round: RoomSnapshot["currentRound"];
        openedAt: number;
        deadlineAt: number;
        eligibleCount: number;
        answeredCount: number;
        crosswordVerticalPoints?: number;
      };
      const currentVerticalGuess = current.self?.crosswordVerticalGuess;
      const existingVerticalGuess =
        currentVerticalGuess?.itemId === opened.round?.itemId ? currentVerticalGuess : undefined;
      return {
        ...current,
        phase: "QUESTION_OPEN",
        currentRound: opened.round,
        crosswordVerticalReveal: undefined,
        openedAt: opened.openedAt,
        deadlineAt: opened.deadlineAt,
        pausedRemainingMs: undefined,
        countdownEndsAt: undefined,
        mediaReadyDeadlineAt: undefined,
        mediaStartAt: undefined,
        answerOpenedAt: undefined,
        eligibleCount: opened.eligibleCount,
        answeredCount: opened.answeredCount,
        crosswordVerticalPoints: opened.crosswordVerticalPoints,
        self: current.self
          ? {
              ...current.self,
              submitted: false,
              currentResult: undefined,
              crosswordVerticalGuess: existingVerticalGuess
                ? { ...existingVerticalGuess, result: undefined }
                : undefined,
            }
          : undefined,
      };
    }
    case "round.paused":
      return {
        ...current,
        phase: "QUESTION_PAUSED",
        openedAt: undefined,
        deadlineAt: undefined,
        pausedRemainingMs: Number(payload.remainingMs),
      };
    case "round.resumed":
      return {
        ...current,
        phase: "QUESTION_OPEN",
        openedAt: Number(payload.openedAt),
        deadlineAt: Number(payload.deadlineAt),
        pausedRemainingMs: undefined,
      };
    case "answer.accepted":
      return { ...current, self: current.self ? { ...current.self, submitted: true } : undefined };
    case "crossword.vertical_answer_accepted":
      return {
        ...current,
        self: current.self
          ? {
              ...current.self,
              crosswordVerticalGuess: {
                itemId: String(payload.itemId),
                submitted: true,
              },
            }
          : undefined,
      };
    case "round.answer_count":
      return {
        ...current,
        answeredCount: Number(payload.answeredCount),
        eligibleCount: Number(payload.eligibleCount),
      };
    case "round.locked":
      return {
        ...current,
        phase: "QUESTION_LOCKED",
        answeredCount: Number(payload.answeredCount),
        eligibleCount: Number(payload.eligibleCount),
      };
    case "round.revealed": {
      const result = payload.result as { isCorrect: boolean; awardedPoints: number } | undefined;
      const verticalResult = payload.verticalResult as
        | { isCorrect: boolean; awardedPoints: number }
        | undefined;
      const revealedRoundId = current.currentRound?.roundId;
      return {
        ...current,
        phase: "ANSWER_REVEAL",
        reveal: payload.reveal as RoomSnapshot["reveal"],
        crosswordVerticalReveal: payload.crosswordVerticalReveal as
          | RoomSnapshot["crosswordVerticalReveal"]
          | undefined,
        self: current.self
          ? {
              ...current.self,
              totalScore:
                typeof payload.totalScore === "number"
                  ? payload.totalScore
                  : current.self.totalScore,
              currentResult: result ?? current.self.currentResult,
              crosswordVerticalGuess: current.self.crosswordVerticalGuess
                ? {
                    ...current.self.crosswordVerticalGuess,
                    result: verticalResult ?? current.self.crosswordVerticalGuess.result,
                  }
                : undefined,
            }
          : undefined,
        revealedRoundIds: current.currentRound
          ? Array.from(new Set([...current.revealedRoundIds, current.currentRound.roundId]))
          : current.revealedRoundIds,
        crosswordReveals:
          revealedRoundId && current.currentRound?.kind.startsWith("CROSSWORD")
            ? {
                ...current.crosswordReveals,
                [revealedRoundId]: payload.reveal as NonNullable<RoomSnapshot["reveal"]>,
              }
            : current.crosswordReveals,
      };
    }
    case "crossword.board_updated":
      return {
        ...current,
        revealedRoundIds: payload.revealedRoundIds as string[],
        crosswordVerticalPoints:
          typeof payload.crosswordVerticalPoints === "number"
            ? payload.crosswordVerticalPoints
            : current.crosswordVerticalPoints,
      };
    case "leaderboard.updated":
      return {
        ...current,
        phase: "LEADERBOARD",
        leaderboard: payload.leaderboard as LeaderboardEntry[],
      };
    case "game.finished":
      return {
        ...current,
        phase: "FINISHED",
        leaderboard: payload.leaderboard as LeaderboardEntry[],
        finishedDeleteAt: Number(payload.finishedDeleteAt),
      };
    case "room.expiring":
      return { ...current, finishedDeleteAt: Number(payload.deleteAt) };
    case "room.deleted":
      return { ...current, phase: "DELETING" };
    default:
      return current;
  }
}

export function useRoomRealtime(input: {
  roomCode: string;
  role: SessionRole;
  token: string | null;
  onDeleted?: () => void;
}) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot>();
  const [connection, setConnection] = useState<ConnectionState>("DISCONNECTED");
  const [notice, setNotice] = useState<string>();
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const client = useRef<RealtimeClient | undefined>(undefined);
  const onDeletedRef = useRef(input.onDeleted);
  onDeletedRef.current = input.onDeleted;

  useEffect(() => {
    if (!input.token) {
      setConnection("FAILED");
      return;
    }
    const realtime = new RealtimeClient(
      input.roomCode,
      input.role,
      input.token,
      (event) => {
        setServerOffsetMs(event.serverTime - Date.now());
        if (event.type === "server.error" || event.type === "answer.rejected") {
          const payload = event.payload as { message?: string };
          setNotice(payload.message ?? "Không thể thực hiện thao tác.");
        }
        setSnapshot((current) => applyEvent(current, event));
        if (event.type === "room.deleted") onDeletedRef.current?.();
      },
      setConnection,
    );
    client.current = realtime;
    realtime.start();
    return () => realtime.stop();
  }, [input.roomCode, input.role, input.token]);

  const send: Send = useCallback((message) => client.current?.send(message) ?? false, []);
  return {
    snapshot,
    connection,
    notice,
    clearNotice: () => setNotice(undefined),
    serverOffsetMs,
    send,
  };
}
