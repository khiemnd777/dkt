import { AppError, ERROR_MESSAGES, errorResponse } from "../shared/errors";
import { LIMITS, ROOM_CODE_ALPHABET } from "../shared/limits";
import { questionSuggestionsRequestSchema } from "../shared/question-intelligence-schemas";
import { createRoomSchema, roomCodeSchema } from "../shared/schemas";
import { allowedBibleIds, requireFeature } from "./config";
import type { Env } from "./env";
import { GameRoom } from "./GameRoom";
import { GenerationGate } from "./GenerationGate";
import { OpenAiMediaSafetyProvider } from "./integrations/openai/media-safety-provider";
import { OpenAiResponsesProvider } from "./integrations/openai/responses-provider";
import { YouVersionRestProvider } from "./integrations/youversion/rest-provider";
import { sanitizeGenerationProvenance } from "./question-intelligence/provenance-validation";
import { QuestionIntelligenceService } from "./question-intelligence/service";
import { QuestionMediaService } from "./question-media/service";
import { ScriptureService } from "./scripture/service";
import { enforceGenerationQuota } from "./security/generation-abuse";
import { secureApiResponse } from "./security/headers";

export { GameRoom, GenerationGate };

const ROOM_ROUTE = /^\/api\/rooms\/([^/]+)\/(public|join|ws-ticket|ws|leave)$/u;
const METHODS: Record<string, string> = {
  public: "GET",
  join: "POST",
  "ws-ticket": "POST",
  ws: "GET",
  leave: "POST",
};

const GAME_ROOM_PAGE = /^\/(join|play|host|screen)\/([^/]+)\/?$/u;
const GAME_STATIC_PATH =
  /^\/(?:assets\/|icons\/|site\/|social\/|sw\.js$|workbox-[^/]+\.js$|manifest\.webmanifest$|registerSW\.js$)/u;
const LEGACY_GAME_PATH =
  /^\/(?:create(?:\/preview)?|join\/[^/]+|play\/[^/]+|host\/[^/]+|screen\/[^/]+)\/?$/u;
const INDEXNOW_KEY_PATH = /^\/([A-Za-z0-9_-]{8,128})\.txt$/u;
const PUBLIC_HOST = "dokinhthanh.io.vn";
const GAME_HOST = "game.dokinhthanh.io.vn";

const PUBLIC_SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

// The game originally lived on the public origin and registered a root-scoped PWA worker.
// Keep a host-aware retirement script at the same URL so returning browsers cannot let that
// legacy worker answer `/en/` (or any other public navigation) with a cached document.
const PUBLIC_SERVICE_WORKER_CLEANUP = `self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>{event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.map(key=>caches.delete(key)));
  await self.clients.claim();
  const clients=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  await self.registration.unregister();
  await Promise.all(clients.map(client=>client.navigate(client.url)));
})());});
`;

const GAME_ROBOTS_DIRECTIVE = "noindex, nofollow, noarchive, nosnippet";

function withHeaders(response: Response, headers: HeadersInit): Response {
  const secured = new Response(response.body, response);
  const additions = new Headers(headers);
  additions.forEach((value, name) => {
    secured.headers.set(name, value);
  });
  return secured;
}

function isGameHost(hostname: string): boolean {
  return (
    hostname === GAME_HOST || hostname.startsWith("game.") || hostname.endsWith(".workers.dev")
  );
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function localRequestIsPublic(pathname: string): boolean {
  return (
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/llms.txt" ||
    pathname.startsWith("/vi") ||
    pathname.startsWith("/en") ||
    pathname.startsWith("/site/") ||
    pathname.startsWith("/social/")
  );
}

function redirect(location: string, status: 301 | 308 = 308): Response {
  return withHeaders(new Response(null, { status, headers: { Location: location } }), {
    "Cache-Control": "public, max-age=3600",
    ...PUBLIC_SECURITY_HEADERS,
  });
}

function errorHtml(status: 404 | 410, locale: "vi" | "en" = "vi"): Response {
  const gone = status === 410;
  const title =
    locale === "vi"
      ? gone
        ? "Phòng đã kết thúc hoặc hết hạn"
        : "Không tìm thấy trang"
      : gone
        ? "This room has ended or expired"
        : "Page not found";
  const message =
    locale === "vi"
      ? gone
        ? "Mã phòng hợp lệ nhưng dữ liệu phòng không còn tồn tại và không thể khôi phục."
        : "Đường dẫn này không thuộc website hoặc ứng dụng."
      : gone
        ? "The room code is valid, but its data no longer exists and cannot be recovered."
        : "This path does not belong to the website or application.";
  const home = locale === "vi" ? "https://dokinhthanh.io.vn/vi/" : "https://dokinhthanh.io.vn/en/";
  const label = locale === "vi" ? "Về trang thông tin" : "Go to the public site";
  const body = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="${GAME_ROBOTS_DIRECTIVE}"><title>${title} | Đố Kinh Thánh Live</title></head><body><main><h1>${title}</h1><p>${message}</p><p><a href="${home}">${label}</a></p></main></body></html>`;
  return withHeaders(
    new Response(body, {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": GAME_ROBOTS_DIRECTIVE,
      },
    }),
    PUBLIC_SECURITY_HEADERS,
  );
}

async function assetResponse(request: Request, env: Env, pathname?: string): Promise<Response> {
  const target = new URL(request.url);
  if (pathname) target.pathname = pathname;
  return env.ASSETS.fetch(new Request(target, request));
}

async function gameShell(request: Request, env: Env): Promise<Response> {
  // Static Assets canonicalizes direct *.html fetches when force-trailing-slash is enabled.
  // Fetching the asset root resolves the game index without exposing a redirect to the client.
  const response = await assetResponse(request, env, "/");
  return withHeaders(response, {
    "Cache-Control": "no-store",
    "X-Robots-Tag": GAME_ROBOTS_DIRECTIVE,
    ...PUBLIC_SECURITY_HEADERS,
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'self' wss:; frame-src https://challenges.cloudflare.com; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
  });
}

async function roomExists(code: string, request: Request, env: Env): Promise<boolean> {
  const id = env.GAME_ROOMS.idFromName(code);
  const url = new URL(`/api/rooms/${code}/public`, request.url);
  const response = await env.GAME_ROOMS.get(id).fetch(new Request(url, { method: "GET" }));
  return response.ok;
}

async function routeGamePage(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  if (request.method !== "GET" && request.method !== "HEAD") return errorHtml(404);
  if (pathname === "/robots.txt") {
    return withHeaders(
      new Response(
        "User-agent: *\nAllow: /\nDisallow: /api/\n\nUser-agent: GPTBot\nDisallow: /\n",
        {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        },
      ),
      PUBLIC_SECURITY_HEADERS,
    );
  }
  if (pathname === "/privacy" || pathname === "/privacy/") {
    return redirect("https://dokinhthanh.io.vn/vi/quyen-rieng-tu-va-vong-doi-du-lieu/");
  }
  if (
    pathname === "/" ||
    pathname === "/index.html" ||
    pathname === "/app-shell.html" ||
    pathname === "/create" ||
    pathname === "/create/" ||
    pathname === "/create/preview"
  ) {
    return gameShell(request, env);
  }
  const roomMatch = GAME_ROOM_PAGE.exec(pathname);
  if (roomMatch) {
    const parsed = roomCodeSchema.safeParse(roomMatch[2].toUpperCase());
    if (!parsed.success) return errorHtml(404);
    if (!(await roomExists(parsed.data, request, env))) return errorHtml(410);
    return gameShell(request, env);
  }
  if (GAME_STATIC_PATH.test(pathname)) {
    const response = await assetResponse(request, env);
    if (response.status !== 404) return withHeaders(response, PUBLIC_SECURITY_HEADERS);
  }
  return errorHtml(404);
}

async function routePublicPage(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "GET" && request.method !== "HEAD") return errorHtml(404, "vi");
  if (url.pathname === "/") return redirect(`${url.origin}/vi/`);
  if (url.pathname === "/sw.js") {
    return withHeaders(
      new Response(request.method === "HEAD" ? null : PUBLIC_SERVICE_WORKER_CLEANUP, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Content-Type": "application/javascript; charset=utf-8",
          "Service-Worker-Allowed": "/",
        },
      }),
      PUBLIC_SECURITY_HEADERS,
    );
  }
  if (url.pathname === "/privacy" || url.pathname === "/privacy/") {
    return redirect(`${url.origin}/vi/quyen-rieng-tu-va-vong-doi-du-lieu/`);
  }
  if (LEGACY_GAME_PATH.test(url.pathname)) {
    return redirect(`https://${GAME_HOST}${url.pathname}${url.search}`);
  }
  const keyMatch = INDEXNOW_KEY_PATH.exec(url.pathname);
  if (keyMatch && env.INDEXNOW_KEY && keyMatch[1] === env.INDEXNOW_KEY) {
    return withHeaders(
      new Response(env.INDEXNOW_KEY, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        },
      }),
      PUBLIC_SECURITY_HEADERS,
    );
  }
  const response = await assetResponse(request, env);
  if (response.status === 404) return errorHtml(404, url.pathname.startsWith("/en") ? "en" : "vi");
  const headers: Record<string, string> = { ...PUBLIC_SECURITY_HEADERS };
  if (url.pathname === "/robots.txt" || url.pathname === "/llms.txt") {
    headers["Content-Type"] = "text/plain; charset=utf-8";
    headers["Cache-Control"] = "public, max-age=3600";
  } else if (url.pathname === "/sitemap.xml") {
    headers["Content-Type"] = "application/xml; charset=utf-8";
    headers["Cache-Control"] = "public, max-age=3600";
  } else if (url.pathname.startsWith("/en/")) {
    headers["Content-Language"] = "en";
  } else if (url.pathname.startsWith("/vi/")) {
    headers["Content-Language"] = "vi";
  }
  return withHeaders(response, headers);
}

function roomCode(): string {
  const random = crypto.getRandomValues(new Uint8Array(LIMITS.roomCodeLength));
  return Array.from(random, (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join(
    "",
  );
}

function isJsonRequest(request: Request): boolean {
  return (
    request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ===
    "application/json"
  );
}

function contentLengthAllowed(request: Request): boolean {
  const raw = request.headers.get("content-length");
  if (!raw) return true;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= LIMITS.maxCreateBodyBytes;
}

async function verifyTurnstileValue(
  request: Request,
  env: Env,
  turnstileToken: string | undefined,
  expectedAction: string,
): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (!turnstileToken && env.APP_ENV === "development") return true;
  if (!turnstileToken) return false;
  const form = new FormData();
  form.set("secret", env.TURNSTILE_SECRET_KEY);
  form.set("response", turnstileToken);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    if (!response.ok) return false;
    const result = (await response.json()) as {
      success?: boolean;
      action?: string;
      hostname?: string;
    };
    const hostname = new URL(request.url).hostname;
    return Boolean(
      result.success &&
        result.action === expectedAction &&
        (!result.hostname || result.hostname === hostname),
    );
  } catch {
    return false;
  }
}

async function verifyTurnstile(request: Request, env: Env): Promise<boolean> {
  let body: { turnstileToken?: string };
  try {
    body = (await request.clone().json()) as { turnstileToken?: string };
  } catch {
    return false;
  }
  return verifyTurnstileValue(request, env, body.turnstileToken, env.TURNSTILE_EXPECTED_ACTION);
}

async function createRoom(request: Request, env: Env): Promise<Response> {
  if (!isJsonRequest(request)) return errorResponse("CONTENT_TYPE_REQUIRED", 415);
  if (!contentLengthAllowed(request)) return errorResponse("BODY_TOO_LARGE", 413);
  if (!(await verifyTurnstile(request, env))) {
    return Response.json(
      { error: { code: "BAD_REQUEST", message: "Không thể xác minh yêu cầu tạo phòng." } },
      { status: 400 },
    );
  }
  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return errorResponse("BAD_REQUEST", 400);
  }
  const parsed = createRoomSchema.safeParse(body);
  if (!parsed.success) return errorResponse("BAD_REQUEST", 400);
  const verifiedGame = await sanitizeGenerationProvenance(
    parsed.data.game,
    env.PROVENANCE_SIGNING_KEY,
  );
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = roomCode();
    const hasMedia = verifiedGame.items.some(
      (item) =>
        Boolean(item.presentation?.media) ||
        (item.type === "CROSSWORD" &&
          item.horizontalRows.some((row) => Boolean(row.presentation?.media))),
    );
    const roomMediaUrls = hasMedia
      ? await questionMediaService(env).bindRoomMedia(
          verifiedGame,
          parsed.data.mediaCapabilities ?? {},
          code,
        )
      : {};
    const id = env.GAME_ROOMS.idFromName(code);
    const stub = env.GAME_ROOMS.get(id);
    const headers = new Headers(request.headers);
    headers.set("x-room-code", code);
    headers.set("content-type", "application/json");
    const response = await stub.fetch(
      new Request(request.url, {
        method: "POST",
        headers,
        body: JSON.stringify({ game: verifiedGame, roomMediaUrls }),
      }),
    );
    if (response.status !== 409) return response;
  }
  return Response.json(
    { error: { code: "PLATFORM_UNAVAILABLE", message: ERROR_MESSAGES.PLATFORM_UNAVAILABLE } },
    { status: 503 },
  );
}

function questionMediaService(env: Env): QuestionMediaService {
  requireFeature(env.QUESTION_MEDIA_ENABLED, "QUESTION_MEDIA_INVALID");
  if (!env.QUESTION_MEDIA || !env.QUESTION_MEDIA_SIGNING_KEY || !env.OPENAI_API_KEY) {
    throw new AppError("QUESTION_MEDIA_INVALID", 503);
  }
  return new QuestionMediaService(
    env.QUESTION_MEDIA,
    env.QUESTION_MEDIA_SIGNING_KEY,
    new OpenAiMediaSafetyProvider(env.OPENAI_API_KEY),
    env.OPENAI_TRANSCRIPTION_MODEL ?? "gpt-transcribe",
  );
}

function mediaAssetId(pathname: string): string | undefined {
  return /^\/api\/question-media\/([A-Za-z0-9_-]{1,80})$/u.exec(pathname)?.[1];
}

async function routeQuestionMedia(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response | undefined> {
  if (url.pathname === "/api/question-media") {
    if (request.method !== "POST") return errorResponse("BAD_REQUEST", 405, { Allow: "POST" });
    const length = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(length) && length > LIMITS.maxQuestionAudioBytes + 128 * 1024) {
      return errorResponse("BODY_TOO_LARGE", 413);
    }
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
      return errorResponse("CONTENT_TYPE_REQUIRED", 415);
    }
    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind");
    const accessibilityText = form.get("accessibilityText");
    const rightsSource = form.get("rightsSource");
    if (
      !(file instanceof File) ||
      (kind !== "IMAGE" && kind !== "AUDIO") ||
      typeof accessibilityText !== "string" ||
      (rightsSource !== "USER_UPLOAD" && rightsSource !== "APP_OWNED")
    ) {
      return errorResponse("QUESTION_MEDIA_INVALID", 400);
    }
    const attribution = form.get("attribution");
    return Response.json(
      await questionMediaService(env).upload({
        file,
        kind,
        accessibilityText,
        rightsSource,
        attestedByHost: form.get("attestedByHost") === "true",
        ...(typeof attribution === "string" && attribution.trim()
          ? { attribution: attribution.trim() }
          : {}),
      }),
      { status: 201 },
    );
  }
  const assetId = mediaAssetId(url.pathname);
  if (!assetId) return undefined;
  if (request.method === "GET") {
    return questionMediaService(env).read(
      assetId,
      url.searchParams.get("token") ?? undefined,
      "read",
      request.headers.get("range"),
    );
  }
  if (request.method === "DELETE") {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/iu, "");
    await questionMediaService(env).delete(assetId, token);
    return new Response(null, { status: 204 });
  }
  return errorResponse("BAD_REQUEST", 405, { Allow: "GET, DELETE" });
}

async function routeRoomMedia(request: Request, env: Env, url: URL): Promise<Response | undefined> {
  const match =
    /^\/api\/rooms\/([ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6})\/media\/([A-Za-z0-9_-]{1,80})$/u.exec(
      url.pathname,
    );
  if (!match) return undefined;
  if (request.method !== "GET") return errorResponse("BAD_REQUEST", 405, { Allow: "GET" });
  if (!(await roomExists(match[1], request, env)))
    throw new AppError("QUESTION_MEDIA_EXPIRED", 404);
  return questionMediaService(env).read(
    match[2],
    url.searchParams.get("token") ?? undefined,
    `room:${match[1]}`,
    request.headers.get("range"),
  );
}

async function createQuestionSuggestions(request: Request, env: Env): Promise<Response> {
  requireFeature(env.AI_QUESTION_SUGGESTIONS_ENABLED, "QUESTION_GENERATION_UNAVAILABLE");
  if (!isJsonRequest(request)) return errorResponse("CONTENT_TYPE_REQUIRED", 415);
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
    return errorResponse("BODY_TOO_LARGE", 413);
  }
  let raw: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 64 * 1024) {
      return errorResponse("BODY_TOO_LARGE", 413);
    }
    raw = JSON.parse(text);
  } catch {
    return errorResponse("BAD_REQUEST", 400);
  }
  const parsed = questionSuggestionsRequestSchema.safeParse(raw);
  if (!parsed.success) return errorResponse("BAD_REQUEST", 400);
  if (
    !(await verifyTurnstileValue(
      request,
      env,
      parsed.data.turnstileToken,
      env.TURNSTILE_GENERATION_ACTION ?? "question-generation",
    ))
  ) {
    return errorResponse("BAD_REQUEST", 400);
  }
  if (parsed.data.types === "AUTO_BALANCE") {
    requireFeature(env.AI_AUTO_BALANCE_ENABLED, "QUESTION_GENERATION_UNAVAILABLE");
  }
  if (!env.OPENAI_API_KEY) throw new AppError("QUESTION_GENERATION_UNAVAILABLE", 503);
  const releaseGenerationLease = await enforceGenerationQuota(
    request,
    env,
    parsed.data.clientGenerationId,
  );
  try {
    const generationMediaAssetId = parsed.data.mediaAssetId;
    const generationMediaCapability = parsed.data.mediaCapability;
    const mediaInput = generationMediaAssetId
      ? await (async () => {
          requireFeature(env.AI_MEDIA_ANALYSIS_ENABLED, "QUESTION_GENERATION_UNAVAILABLE");
          if (!generationMediaCapability) throw new AppError("QUESTION_MEDIA_EXPIRED", 404);
          return questionMediaService(env).generationInput(
            generationMediaAssetId,
            generationMediaCapability,
          );
        })()
      : undefined;
    const service = new QuestionIntelligenceService({
      provider: new OpenAiResponsesProvider({ apiKey: env.OPENAI_API_KEY }),
      scripture: scriptureService(env),
      model: env.OPENAI_GENERATION_MODEL ?? "gpt-5.6-terra",
      reviewModel: env.OPENAI_REVIEW_MODEL,
      provenanceSigningKey: env.PROVENANCE_SIGNING_KEY,
      mediaInput,
    });
    const result = await service.generate(parsed.data);
    console.info(
      JSON.stringify({
        event: "question_generation",
        requestId: result.requestId,
        candidateCount: result.candidates.length,
        rejectedCount: result.rejectedCount,
        types: result.candidates.map((candidate) => candidate.type),
      }),
    );
    return Response.json(result);
  } finally {
    await releaseGenerationLease();
  }
}

function scriptureService(env: Env): ScriptureService {
  requireFeature(env.SCRIPTURE_PROVIDER_ENABLED, "SCRIPTURE_DISABLED");
  if (!env.YVP_APP_KEY) throw new AppError("SCRIPTURE_LICENSE_UNAVAILABLE", 503);
  return new ScriptureService(
    new YouVersionRestProvider({
      appKey: env.YVP_APP_KEY,
      allowedBibleIds: allowedBibleIds(env),
    }),
  );
}

function parseVersionId(value: string): number {
  const versionId = Number(value);
  if (!Number.isInteger(versionId) || versionId <= 0) {
    throw new AppError("SCRIPTURE_VERSION_UNAVAILABLE", 404);
  }
  return versionId;
}

async function routeScripture(request: Request, env: Env, url: URL): Promise<Response | undefined> {
  if (url.pathname === "/api/scripture/versions") {
    if (request.method !== "GET") return errorResponse("BAD_REQUEST", 405, { Allow: "GET" });
    const language = url.searchParams.get("language") ?? "vi";
    return Response.json({ versions: await scriptureService(env).listVersions(language) });
  }
  const indexMatch = /^\/api\/scripture\/versions\/(\d+)\/index$/u.exec(url.pathname);
  if (indexMatch) {
    if (request.method !== "GET") return errorResponse("BAD_REQUEST", 405, { Allow: "GET" });
    return Response.json(await scriptureService(env).getIndex(parseVersionId(indexMatch[1])));
  }
  if (url.pathname === "/api/scripture/passage") {
    if (request.method !== "GET") return errorResponse("BAD_REQUEST", 405, { Allow: "GET" });
    const versionId = parseVersionId(url.searchParams.get("versionId") ?? "");
    const passageId = url.searchParams.get("passageId");
    if (!passageId) throw new AppError("SCRIPTURE_REFERENCE_INVALID", 400);
    return Response.json(await scriptureService(env).getContext(versionId, passageId));
  }
  return undefined;
}

async function routeApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const questionMedia = await routeQuestionMedia(request, env, url);
  if (questionMedia) return questionMedia;
  const roomMedia = await routeRoomMedia(request, env, url);
  if (roomMedia) return roomMedia;
  const scripture = await routeScripture(request, env, url);
  if (scripture) return scripture;
  if (url.pathname === "/api/question-suggestions") {
    if (request.method !== "POST") return errorResponse("BAD_REQUEST", 405, { Allow: "POST" });
    return createQuestionSuggestions(request, env);
  }
  if (url.pathname === "/api/health") {
    if (request.method !== "GET") return errorResponse("BAD_REQUEST", 405, { Allow: "GET" });
    return Response.json({
      ok: true,
      turnstileProtected: Boolean(env.TURNSTILE_SECRET_KEY),
      environment: env.APP_ENV,
      features: {
        scripture: env.SCRIPTURE_PROVIDER_ENABLED === "true",
        questionSuggestions: env.AI_QUESTION_SUGGESTIONS_ENABLED === "true",
        autoBalance: env.AI_AUTO_BALANCE_ENABLED === "true",
        questionMedia: env.QUESTION_MEDIA_ENABLED === "true",
        aiMediaAnalysis: env.AI_MEDIA_ANALYSIS_ENABLED === "true",
      },
    });
  }
  if (url.pathname === "/api/rooms") {
    if (request.method !== "POST") return errorResponse("BAD_REQUEST", 405, { Allow: "POST" });
    return createRoom(request, env);
  }
  const match = ROOM_ROUTE.exec(url.pathname);
  if (!match) return errorResponse("ROOM_NOT_FOUND", 404);
  const [, code, action] = match;
  const parsedCode = roomCodeSchema.safeParse(code.toUpperCase());
  if (!parsedCode.success) return errorResponse("ROOM_NOT_FOUND", 404);
  const expectedMethod = METHODS[action];
  if (request.method !== expectedMethod)
    return errorResponse("BAD_REQUEST", 405, { Allow: expectedMethod });
  if (["join", "ws-ticket", "leave"].includes(action) && !isJsonRequest(request)) {
    return errorResponse("CONTENT_TYPE_REQUIRED", 415);
  }
  if (!contentLengthAllowed(request)) return errorResponse("BODY_TOO_LARGE", 413);
  const id = env.GAME_ROOMS.idFromName(parsedCode.data);
  return env.GAME_ROOMS.get(id).fetch(request);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.protocol !== "https:" && !isLocalHost(url.hostname)) {
        url.protocol = "https:";
        return redirect(url.href);
      }
      if (url.hostname === `www.${PUBLIC_HOST}`) {
        url.hostname = PUBLIC_HOST;
        return redirect(url.href, 301);
      }
      const localPublic = isLocalHost(url.hostname) && localRequestIsPublic(url.pathname);
      const gameHost = isGameHost(url.hostname) || (isLocalHost(url.hostname) && !localPublic);
      if (url.pathname.startsWith("/api/")) {
        if (!gameHost) return secureApiResponse(errorResponse("ROOM_NOT_FOUND", 404));
        return secureApiResponse(await routeApi(request, env));
      }
      return gameHost ? routeGamePage(request, env) : routePublicPage(request, env);
    } catch (error) {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        if (error instanceof AppError) {
          return secureApiResponse(
            errorResponse(
              error.code,
              error.status,
              error.retryAfterSec ? { "Retry-After": String(error.retryAfterSec) } : undefined,
              error.retryAfterSec,
            ),
          );
        }
        return secureApiResponse(errorResponse("PLATFORM_UNAVAILABLE", 503));
      }
      return errorHtml(404, url.pathname.startsWith("/en") ? "en" : "vi");
    }
  },
} satisfies ExportedHandler<Env>;
