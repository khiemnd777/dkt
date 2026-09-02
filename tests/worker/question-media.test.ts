import { reset, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BuilderMediaHandle, GameDefinition } from "../../shared/game";
import type { RoomGame } from "../../shared/room";
import type { Env } from "../../worker/env";
import worker from "../../worker/index";
import { smallGame } from "../fixtures/games";

const mediaOnly = Object.assign(Object.create(env) as Env, {
  APP_ENV: "development",
  TURNSTILE_SECRET_KEY: undefined,
  QUESTION_MEDIA_ENABLED: "true",
  QUESTION_MEDIA_SIGNING_KEY: "test-only-media-signing-key-at-least-32-characters",
  OPENAI_API_KEY: undefined,
  YVP_APP_KEY: undefined,
  SCRIPTURE_PROVIDER_ENABLED: "false",
  AI_QUESTION_SUGGESTIONS_ENABLED: "false",
  AI_AUTO_BALANCE_ENABLED: "false",
  AI_MEDIA_ANALYSIS_ENABLED: "false",
});

function request(path: string, init?: RequestInit) {
  return worker.fetch(new Request(`https://game.test${path}`, init), mediaOnly);
}

afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe("media routes without AI or YouVersion", () => {
  it.each(["IMAGE", "AUDIO"] as const)(
    "uploads, binds and serves %s in an accountless room",
    async (kind) => {
      const externalFetch = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(new Error("No external provider calls allowed"));
      const bytes =
        kind === "IMAGE"
          ? Uint8Array.from(
              atob(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3l8AAAAASUVORK5CYII=",
              ),
              (character) => character.charCodeAt(0),
            )
          : new Uint8Array(417 * 2);
      if (kind === "AUDIO") {
        for (const offset of [0, 417]) bytes.set([0xff, 0xfb, 0x90, 0x00], offset);
      }
      const mimeType = kind === "IMAGE" ? "image/png" : "audio/mpeg";
      const form = new FormData();
      form.set("file", new File([bytes.buffer], "question", { type: mimeType }));
      form.set("kind", kind);
      form.set("accessibilityText", "Nội dung media kiểm thử");
      form.set("rightsSource", "USER_UPLOAD");
      form.set("attestedByHost", "true");
      const upload = await request("/api/question-media", { method: "POST", body: form });
      expect(upload.status).toBe(201);
      const handle = (await upload.json()) as BuilderMediaHandle;
      expect(handle.media.kind).toBe(kind);
      const assetPath = `/api/question-media/${handle.media.assetId}`;
      const read = await request(`${assetPath}?token=${encodeURIComponent(handle.readCapability)}`);
      expect(read.status).toBe(200);
      expect(read.headers.get("Content-Type")).toBe(mimeType);
      expect(read.headers.get("Cache-Control")).toContain("no-store");
      expect(new Uint8Array(await read.arrayBuffer())).toEqual(bytes);
      expect((await request(assetPath)).status).toBe(404);

      const game: GameDefinition = {
        ...smallGame,
        items: [{ ...smallGame.items[0], presentation: { media: handle.media } }],
      };
      const creation = await request("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game,
          mediaCapabilities: { [handle.media.assetId]: handle.readCapability },
        }),
      });
      expect(creation.status).toBe(201);
      const { roomCode } = (await creation.json()) as { roomCode: string };
      const join = await request(`/api/rooms/${roomCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "Người chơi", avatarId: "🦁" }),
      });
      expect(join.status).toBe(201);
      const stub = mediaOnly.GAME_ROOMS.get(mediaOnly.GAME_ROOMS.idFromName(roomCode));
      const mediaUrl = await runInDurableObject(stub, async (_instance, state) => {
        const stored = await state.storage.get<RoomGame>("room:game");
        return stored?.rounds[0].publicPayload.media?.deliveryUrl;
      });
      expect(mediaUrl).toContain(`/api/rooms/${roomCode}/media/`);
      const playback = await request(mediaUrl ?? "", { headers: { Range: "bytes=0-7" } });
      expect(playback.status).toBe(206);
      expect(new Uint8Array(await playback.arrayBuffer())).toEqual(bytes.slice(0, 8));
      const removed = await request(assetPath, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${handle.deleteCapability}` },
      });
      expect(removed.status).toBe(204);
      expect(
        (await request(`${assetPath}?token=${encodeURIComponent(handle.readCapability)}`)).status,
      ).toBe(404);
      expect(externalFetch).not.toHaveBeenCalled();
    },
  );
});
