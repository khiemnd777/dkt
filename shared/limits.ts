export const LIMITS = {
  roomCodeLength: 6,
  maxCreateBodyBytes: 512 * 1024,
  maxWebSocketMessageBytes: 8 * 1024,
  maxItems: 50,
  maxRuntimeRounds: 100,
  maxPlayers: 100,
  maxRoomLifetimeMs: 6 * 60 * 60 * 1000,
  inactivityLifetimeMs: 2 * 60 * 60 * 1000,
  finishedRetentionMs: 5 * 60 * 1000,
  deletionWarningMs: 60 * 1000,
  ticketLifetimeMs: 30 * 1000,
  countdownMs: 3_000,
  minDurationSec: 5,
  maxDurationSec: 120,
  defaultDurationSec: 20,
  maxAliases: 10,
  maxCrosswordRows: 10,
  minCrosswordRows: 3,
  maxPlayerNameGraphemes: 24,
  minPlayerNameGraphemes: 2,
} as const;

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const PROTOCOL_VERSION = 1 as const;

export const AVATARS = [
  "🦁",
  "🐑",
  "🕊️",
  "🐟",
  "🌿",
  "⭐",
  "👑",
  "🛡️",
  "🪔",
  "📖",
  "🌈",
  "⛵",
] as const;

export type AvatarId = (typeof AVATARS)[number];
