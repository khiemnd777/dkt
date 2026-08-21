import type { RoomPhase } from "../worker/room/state-machine";
import type { GameDefinition, GameMode, RuntimeRound } from "./game";

export type SessionRole = "HOST" | "PLAYER" | "SCREEN";
export type RoomStatus = "ACTIVE" | "FINISHED" | "DELETING";

export interface RoomMeta {
  roomCode: string;
  status: RoomStatus;
  createdAt: number;
  hardExpiresAt: number;
  inactivityExpiresAt: number;
  finishedDeleteAt?: number;
  lastHostActivityAt: number;
  protocolVersion: number;
  stateVersion: number;
  sequence: number;
}

export interface RoomSecrets {
  hostTokenHash: string;
  screenTokenHash: string;
}

export interface RoomGame {
  definition: GameDefinition;
  rounds: RuntimeRound[];
}

export interface Player {
  playerId: string;
  displayName: string;
  normalizedDisplayName: string;
  avatarId: string;
  playerTokenHash: string;
  joinedAt: number;
  eligibleFromRoundIndex: number;
  totalScore: number;
  correctCount: number;
  totalCorrectResponseMs: number;
  lastSeenAt: number;
  removed: boolean;
}

export interface RoomProgress {
  phase: RoomPhase;
  currentRoundIndex: number;
  countdownEndsAt?: number;
  openedAt?: number;
  deadlineAt?: number;
  pausedRemainingMs?: number;
  elapsedBeforePauseMs?: number;
  revealedRoundIds: string[];
  nextAction: string;
}

export interface SubmissionRecord {
  roundId: string;
  playerId: string;
  submissionId: string;
  isCorrect: boolean;
  awardedPoints: number;
  responseMs: number;
  submittedAt: number;
}

export interface CrosswordVerticalSubmissionRecord extends SubmissionRecord {
  itemId: string;
  contextRoundId: string;
  bonusApplied: boolean;
}

export interface WebSocketTicket {
  ticketHash: string;
  role: SessionRole;
  playerId?: string;
  expiresAt: number;
}

export interface LeaderboardEntry {
  playerId: string;
  displayName: string;
  avatarId: string;
  rank: number;
  totalScore: number;
  correctCount: number;
  totalCorrectResponseMs: number;
}

export interface CrosswordVerticalReveal {
  clue: string;
  answer: string;
  bibleReference?: string;
  explanation?: string;
}

export interface PublicRoomMetadata {
  exists: boolean;
  status: RoomStatus;
  gameTitle: string;
  mode: GameMode;
  playerCount: number;
  canJoin: boolean;
}

export interface RoomSnapshot {
  roomCode: string;
  gameTitle: string;
  mode: GameMode;
  phase: RoomPhase;
  currentRoundIndex: number;
  totalRounds: number;
  playerCount: number;
  eligibleCount: number;
  answeredCount: number;
  openedAt?: number;
  deadlineAt?: number;
  countdownEndsAt?: number;
  pausedRemainingMs?: number;
  currentRound?: Omit<RuntimeRound, "privateAnswer" | "revealPayload">;
  reveal?: RuntimeRound["revealPayload"];
  crosswordVerticalReveal?: CrosswordVerticalReveal;
  leaderboard?: LeaderboardEntry[];
  players?: Array<
    Pick<Player, "playerId" | "displayName" | "avatarId" | "removed"> & {
      connected: boolean;
      answered: boolean;
    }
  >;
  self?: Pick<
    Player,
    | "playerId"
    | "displayName"
    | "avatarId"
    | "totalScore"
    | "correctCount"
    | "eligibleFromRoundIndex"
  > & {
    submitted: boolean;
    currentResult?: Pick<SubmissionRecord, "isCorrect" | "awardedPoints">;
    crosswordVerticalGuess?: {
      itemId: string;
      submitted: true;
      result?: Pick<SubmissionRecord, "isCorrect" | "awardedPoints">;
    };
    rank?: number;
  };
  revealedRoundIds: string[];
  crosswordReveals?: Record<string, RuntimeRound["revealPayload"]>;
  crosswordVerticalPoints?: number;
  finishedDeleteAt?: number;
}
