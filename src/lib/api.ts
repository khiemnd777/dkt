import { ERROR_MESSAGES, type ErrorCode } from "@shared/errors";
import type { GameDefinition } from "@shared/game";
import type { PublicRoomMetadata, SessionRole } from "@shared/room";

export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode | "UNKNOWN",
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  let body: unknown;
  if (contentType.includes("application/json")) {
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
  }
  if (!response.ok) {
    const error =
      body && typeof body === "object" && "error" in body
        ? (body as { error?: { code?: ErrorCode; message?: string } }).error
        : undefined;
    const fallback =
      response.status === 429 || response.status >= 500
        ? ERROR_MESSAGES.PLATFORM_UNAVAILABLE
        : ERROR_MESSAGES.BAD_REQUEST;
    throw new ApiError(error?.code ?? "UNKNOWN", response.status, error?.message ?? fallback);
  }
  return body as T;
}

export interface RoomBootstrap {
  roomCode: string;
  hostToken: string;
  screenToken: string;
  hostUrl: string;
  joinUrl: string;
  screenUrl: string;
  expiresAt: number;
}

export const api = {
  createRoom: (game: GameDefinition, turnstileToken?: string) =>
    fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game, turnstileToken }),
    }).then(parseResponse<RoomBootstrap>),
  publicRoom: (code: string) =>
    fetch(`/api/rooms/${code}/public`).then(parseResponse<PublicRoomMetadata>),
  join: (code: string, input: { displayName: string; avatarId: string; reconnectToken?: string }) =>
    fetch(`/api/rooms/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then(
      parseResponse<{
        playerId: string;
        playerToken: string;
        displayName: string;
        eligibleFromRoundIndex: number;
      }>,
    ),
  ticket: (code: string, role: SessionRole, token: string) =>
    fetch(`/api/rooms/${code}/ws-ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role }),
    }).then(parseResponse<{ ticket: string; expiresAt: number }>),
  leave: (code: string, token: string) =>
    fetch(`/api/rooms/${code}/leave`, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: "{}",
    }),
};
