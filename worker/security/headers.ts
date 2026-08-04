export const API_SECURITY_HEADERS: HeadersInit = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

export function secureApiResponse(response: Response): Response {
  if (response.status === 101) return response;
  const result = new Response(response.body, response);
  for (const [name, value] of Object.entries(API_SECURITY_HEADERS)) result.headers.set(name, value);
  if (!result.headers.has("Content-Type")) {
    result.headers.set("Content-Type", "application/json; charset=utf-8");
  }
  return result;
}
