import { ERROR_MESSAGES, type ErrorCode } from "@shared/errors";
import type { BuilderMediaHandle, GameDefinition } from "@shared/game";
import type { QuestionSuggestionsResponse } from "@shared/question-intelligence";
import type { QuestionSuggestionsRequest } from "@shared/question-intelligence-schemas";
import type { PublicRoomMetadata, SessionRole } from "@shared/room";
import type { ScriptureContext, ScriptureIndex, ScriptureVersion } from "@shared/scripture";

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

export interface RuntimeFeatures {
  scripture: boolean;
  questionSuggestions: boolean;
  autoBalance: boolean;
  questionMedia: boolean;
  aiMediaAnalysis: boolean;
}

export interface HealthResponse {
  ok: boolean;
  turnstileProtected: boolean;
  environment: string;
  features: RuntimeFeatures;
}

export const api = {
  health: () => fetch("/api/health", { cache: "no-store" }).then(parseResponse<HealthResponse>),
  createRoom: (
    game: GameDefinition,
    turnstileToken?: string,
    mediaCapabilities?: Record<string, string>,
  ) =>
    fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game, turnstileToken, mediaCapabilities }),
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
  uploadQuestionMedia: (form: FormData) =>
    fetch("/api/question-media", { method: "POST", body: form }).then(
      parseResponse<BuilderMediaHandle>,
    ),
  deleteQuestionMedia: (assetId: string, deleteCapability: string) =>
    fetch(`/api/question-media/${assetId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${deleteCapability}` },
    }).then(parseResponse<void>),
  scriptureVersions: (language = "vi") =>
    fetch(`/api/scripture/versions?language=${encodeURIComponent(language)}`).then(
      parseResponse<{ versions: ScriptureVersion[] }>,
    ),
  scriptureIndex: (versionId: number) =>
    fetch(`/api/scripture/versions/${versionId}/index`).then(parseResponse<ScriptureIndex>),
  scripturePassage: (versionId: number, passageId: string) =>
    fetch(
      `/api/scripture/passage?versionId=${versionId}&passageId=${encodeURIComponent(passageId)}`,
    ).then(parseResponse<ScriptureContext>),
  questionSuggestions: (input: QuestionSuggestionsRequest) =>
    fetch("/api/question-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then(parseResponse<QuestionSuggestionsResponse>),
};
