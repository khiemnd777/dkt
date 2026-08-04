import { ERROR_MESSAGES, errorResponse } from "../shared/errors";
import { LIMITS, ROOM_CODE_ALPHABET } from "../shared/limits";
import { roomCodeSchema } from "../shared/schemas";
import type { Env } from "./env";
import { GameRoom } from "./GameRoom";
import { secureApiResponse } from "./security/headers";

export { GameRoom };

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
      "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' wss:; frame-src https://challenges.cloudflare.com; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
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

async function verifyTurnstile(request: Request, env: Env): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  const cloned = request.clone();
  let body: { turnstileToken?: string };
  try {
    body = (await cloned.json()) as { turnstileToken?: string };
  } catch {
    return false;
  }
  if (!body.turnstileToken && env.APP_ENV === "development") return true;
  if (!body.turnstileToken) return false;
  const form = new FormData();
  form.set("secret", env.TURNSTILE_SECRET_KEY);
  form.set("response", body.turnstileToken);
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
        result.action === env.TURNSTILE_EXPECTED_ACTION &&
        (!result.hostname || result.hostname === hostname),
    );
  } catch {
    return false;
  }
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
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = roomCode();
    const id = env.GAME_ROOMS.idFromName(code);
    const stub = env.GAME_ROOMS.get(id);
    const headers = new Headers(request.headers);
    headers.set("x-room-code", code);
    const response = await stub.fetch(new Request(request, { headers }));
    if (response.status !== 409) return response;
  }
  return Response.json(
    { error: { code: "PLATFORM_UNAVAILABLE", message: ERROR_MESSAGES.PLATFORM_UNAVAILABLE } },
    { status: 503 },
  );
}

async function routeApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/health") {
    if (request.method !== "GET") return errorResponse("BAD_REQUEST", 405, { Allow: "GET" });
    return Response.json({
      ok: true,
      turnstileProtected: Boolean(env.TURNSTILE_SECRET_KEY),
      environment: env.APP_ENV,
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
    } catch {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        return secureApiResponse(errorResponse("PLATFORM_UNAVAILABLE", 503));
      }
      return errorHtml(404, url.pathname.startsWith("/en") ? "en" : "vi");
    }
  },
} satisfies ExportedHandler<Env>;
