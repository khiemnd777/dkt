import { AppError } from "../../shared/errors";

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/u, "");
}

async function signature(key: string, value: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return encode(
    new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(value))),
  );
}

function equal(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1)
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

export async function createMediaCapability(
  key: string,
  operation: string,
  assetId: string,
  expiresAt: number,
): Promise<string> {
  const payload = `${operation}\n${assetId}\n${expiresAt}`;
  return `v1.${expiresAt}.${await signature(key, payload)}`;
}

export async function verifyMediaCapability(
  token: string | undefined,
  key: string,
  operation: string,
  assetId: string,
  now = Date.now(),
): Promise<void> {
  const [version, rawExpiresAt, supplied] = token?.split(".") ?? [];
  const expiresAt = Number(rawExpiresAt);
  if (version !== "v1" || !supplied || !Number.isFinite(expiresAt) || expiresAt < now) {
    throw new AppError("QUESTION_MEDIA_EXPIRED", 404);
  }
  const expected = await signature(key, `${operation}\n${assetId}\n${expiresAt}`);
  if (!equal(supplied, expected)) throw new AppError("QUESTION_MEDIA_EXPIRED", 404);
}
