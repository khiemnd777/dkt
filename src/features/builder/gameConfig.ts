import type { GameDefinition } from "@shared/game";
import { LIMITS } from "@shared/limits";
import { isPlainText } from "@shared/text";
import { z } from "zod";

export const GAME_CONFIG_FORMAT = "do-kinh-thanh-live/game-config";
export const GAME_CONFIG_VERSION = 1;
export const MAX_GAME_CONFIG_BYTES = LIMITS.maxCreateBodyBytes;

const identifier = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/u);
const text = (maximum: number) =>
  z.string().max(maximum).refine(isPlainText, "Cấu hình chứa ký tự không được hỗ trợ.");
const duration = z.number().int().min(0).max(LIMITS.maxDurationSec);
const optionalText = (maximum: number) => text(maximum).optional();
const aliases = z.array(text(120)).max(LIMITS.maxAliases);
const base = {
  id: identifier,
  durationSec: duration.optional(),
  bibleReference: optionalText(120),
  explanation: optionalText(500),
};

const draftItemSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...base,
      type: z.literal("SINGLE_CHOICE"),
      prompt: text(300),
      options: z
        .array(z.object({ id: identifier, text: text(120) }).strict())
        .min(2)
        .max(4),
      correctOptionId: identifier,
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal("TRUE_FALSE"),
      statement: text(300),
      correctValue: z.boolean(),
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal("SHORT_ANSWER"),
      prompt: text(300),
      canonicalAnswer: text(120),
      acceptedAliases: aliases,
    })
    .strict(),
  z
    .object({
      id: identifier,
      type: z.literal("CROSSWORD"),
      title: text(120),
      horizontalDurationSec: duration,
      verticalDurationSec: duration,
      verticalClue: text(300),
      verticalAnswer: text(120),
      horizontalRows: z
        .array(
          z
            .object({
              id: identifier,
              clue: text(300),
              answer: text(120),
              acceptedAliases: aliases,
              specialCellIndex: z.number().int().min(0).max(120),
              bibleReference: optionalText(120),
              explanation: optionalText(500),
            })
            .strict(),
        )
        .min(LIMITS.minCrosswordRows)
        .max(LIMITS.maxCrosswordRows),
      bibleReference: optionalText(120),
      explanation: optionalText(500),
    })
    .strict(),
]);

export const builderDraftSchema = z
  .object({
    title: text(80),
    mode: z.enum(["TURN_BASED", "SPEED_RACE"]),
    defaultDurationSec: duration,
    items: z.array(draftItemSchema).min(1).max(LIMITS.maxItems),
    createdClientVersion: z.string().min(1).max(40),
  })
  .strict();

export const portableGameConfigSchema = z
  .object({
    format: z.literal(GAME_CONFIG_FORMAT),
    version: z.literal(GAME_CONFIG_VERSION),
    exportedAt: z.string().datetime(),
    game: builderDraftSchema,
  })
  .strict();

export type PortableGameConfig = z.infer<typeof portableGameConfigSchema>;

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function serializeGameConfig(game: GameDefinition, exportedAt = new Date()): string {
  const envelope: PortableGameConfig = {
    format: GAME_CONFIG_FORMAT,
    version: GAME_CONFIG_VERSION,
    exportedAt: exportedAt.toISOString(),
    game: builderDraftSchema.parse(game),
  };
  const serialized = JSON.stringify(envelope, null, 2);
  if (byteLength(serialized) > MAX_GAME_CONFIG_BYTES)
    throw new Error("Cấu hình vượt quá giới hạn 512 KiB.");
  return serialized;
}

export function parseGameConfig(serialized: string): GameDefinition {
  if (byteLength(serialized) > MAX_GAME_CONFIG_BYTES)
    throw new Error("File cấu hình vượt quá giới hạn 512 KiB.");
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new Error("File không phải JSON hợp lệ.");
  }
  const result = portableGameConfigSchema.safeParse(value);
  if (!result.success)
    throw new Error("File không đúng định dạng cấu hình Đố Kinh Thánh Live phiên bản 1.");
  return result.data.game;
}

export function gameConfigFilename(title: string, date = new Date()): string {
  const slug = title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[Đđ]/gu, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 48);
  const day = date.toISOString().slice(0, 10);
  return `do-kinh-thanh-${slug || "ban-nhap"}-${day}.dkt.json`;
}
