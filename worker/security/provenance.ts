function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function signValidationReceipt(key: string, value: unknown): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(canonical(value)),
  );
  const encoded = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/u, "");
  return `v1.${encoded}`;
}

export async function verifyValidationReceipt(
  key: string,
  value: unknown,
  supplied: string | undefined,
): Promise<boolean> {
  if (!supplied) return false;
  const expected = await signValidationReceipt(key, value);
  if (expected.length !== supplied.length) return false;
  let result = 0;
  for (let index = 0; index < expected.length; index += 1) {
    result |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  }
  return result === 0;
}
