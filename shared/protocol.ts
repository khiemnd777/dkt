import { z } from "zod";
import type { PlayerAnswer } from "./game";
import type { RoomSnapshot } from "./room";

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("client.request_snapshot") }).strict(),
  z.object({ type: z.literal("client.leave") }).strict(),
  z.object({ type: z.literal("host.start_game") }).strict(),
  z
    .object({
      type: z.literal("host.media_ready"),
      payload: z
        .object({
          roundId: z.string().min(1).max(160),
          mode: z.enum(["READY", "FALLBACK"]),
        })
        .strict(),
    })
    .strict(),
  z.object({ type: z.literal("host.open_next_round") }).strict(),
  z.object({ type: z.literal("host.pause_round") }).strict(),
  z.object({ type: z.literal("host.resume_round") }).strict(),
  z.object({ type: z.literal("host.lock_round") }).strict(),
  z.object({ type: z.literal("host.reveal_answer") }).strict(),
  z.object({ type: z.literal("host.show_leaderboard") }).strict(),
  z.object({ type: z.literal("host.continue") }).strict(),
  z.object({ type: z.literal("host.finish_game") }).strict(),
  z.object({ type: z.literal("host.delete_room") }).strict(),
  z
    .object({
      type: z.literal("host.remove_player"),
      payload: z.object({ playerId: z.string().min(1).max(80) }).strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("player.submit_answer"),
      payload: z
        .object({
          roundId: z.string().min(1).max(160),
          submissionId: z.string().min(8).max(100),
          answer: z.discriminatedUnion("type", [
            z.object({ type: z.literal("OPTION"), optionId: z.string().min(1).max(80) }).strict(),
            z
              .object({
                type: z.literal("OPTIONS"),
                optionIds: z.array(z.string().min(1).max(80)).min(2).max(6),
              })
              .strict(),
            z.object({ type: z.literal("BOOLEAN"), value: z.boolean() }).strict(),
            z.object({ type: z.literal("TEXT"), value: z.string().max(240) }).strict(),
          ]),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("player.submit_crossword_vertical"),
      payload: z
        .object({
          roundId: z.string().min(1).max(160),
          submissionId: z.string().min(8).max(100),
          value: z.string().trim().min(1).max(240),
        })
        .strict(),
    })
    .strict(),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export type ServerEventType =
  | "room.snapshot"
  | "room.player_joined"
  | "room.player_left"
  | "room.player_updated"
  | "game.countdown_started"
  | "round.media_started"
  | "round.opened"
  | "round.paused"
  | "round.resumed"
  | "answer.accepted"
  | "answer.rejected"
  | "crossword.vertical_answer_accepted"
  | "round.answer_count"
  | "round.locked"
  | "round.revealed"
  | "crossword.board_updated"
  | "leaderboard.updated"
  | "game.finished"
  | "room.expiring"
  | "room.deleted"
  | "server.error";

export interface ServerEvent<T = unknown> {
  type: ServerEventType;
  protocolVersion: 1;
  sequence: number;
  serverTime: number;
  roomStateVersion: number;
  payload: T;
}

export type SnapshotEvent = ServerEvent<RoomSnapshot> & { type: "room.snapshot" };

export interface SubmissionMessagePayload {
  roundId: string;
  submissionId: string;
  answer: PlayerAnswer;
}
