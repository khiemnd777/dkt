import { AppError } from "../shared/errors";
import type { Env } from "./env";

export function featureEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function requireFeature(
  value: string | undefined,
  code: "SCRIPTURE_DISABLED" | "QUESTION_GENERATION_UNAVAILABLE" | "QUESTION_MEDIA_INVALID",
): void {
  if (!featureEnabled(value)) throw new AppError(code, 503);
}

export function allowedBibleIds(env: Env): ReadonlySet<number> | undefined {
  if (!env.YVP_ALLOWED_BIBLE_IDS?.trim()) return undefined;
  const values = env.YVP_ALLOWED_BIBLE_IDS.split(",").map((value) => Number(value.trim()));
  if (values.some((value) => !Number.isInteger(value) || value <= 0)) {
    throw new AppError("SCRIPTURE_LICENSE_UNAVAILABLE", 503);
  }
  return new Set(values);
}
