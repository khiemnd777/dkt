import { z } from "zod";
import { AVATARS, LIMITS } from "./limits";
import { answerCells, graphemeLength, isPlainText, normalizeAnswer } from "./text";

const identifier = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/u);
const plain = (min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((value) => graphemeLength(value) >= min, `Cần ít nhất ${min} ký tự.`)
    .refine((value) => graphemeLength(value) <= max, `Tối đa ${max} ký tự.`)
    .refine(isPlainText, "Chỉ chấp nhận văn bản thuần.");
const optionalPlain = (max: number) => plain(1, max).optional();
const duration = z.number().int().min(LIMITS.minDurationSec).max(LIMITS.maxDurationSec);
const aliases = z.array(plain(1, 120)).max(LIMITS.maxAliases).default([]);

const base = {
  id: identifier,
  durationSec: duration.optional(),
  bibleReference: optionalPlain(120),
  explanation: optionalPlain(500),
};

export const singleChoiceItemSchema = z
  .object({
    ...base,
    type: z.literal("SINGLE_CHOICE"),
    prompt: plain(1, 300),
    options: z
      .array(z.object({ id: identifier, text: plain(1, 120) }).strict())
      .min(2)
      .max(4),
    correctOptionId: identifier,
  })
  .strict()
  .superRefine((item, context) => {
    const texts = item.options.map((option) => option.text.trim().toLocaleUpperCase("vi"));
    if (new Set(texts).size !== texts.length) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Các lựa chọn không được trùng nhau.",
      });
    }
    if (!item.options.some((option) => option.id === item.correctOptionId)) {
      context.addIssue({
        code: "custom",
        path: ["correctOptionId"],
        message: "Hãy chọn một đáp án đúng.",
      });
    }
  });

export const trueFalseItemSchema = z
  .object({
    ...base,
    type: z.literal("TRUE_FALSE"),
    statement: plain(1, 300),
    correctValue: z.boolean(),
  })
  .strict();

export const shortAnswerItemSchema = z
  .object({
    ...base,
    type: z.literal("SHORT_ANSWER"),
    prompt: plain(1, 300),
    canonicalAnswer: plain(1, 120),
    acceptedAliases: aliases,
  })
  .strict();

export const crosswordRowSchema = z
  .object({
    id: identifier,
    clue: plain(1, 300),
    answer: plain(1, 120),
    acceptedAliases: aliases,
    specialCellIndex: z.number().int().min(0),
    bibleReference: optionalPlain(120),
    explanation: optionalPlain(500),
  })
  .strict()
  .superRefine((row, context) => {
    if (row.specialCellIndex >= answerCells(row.answer).length) {
      context.addIssue({
        code: "custom",
        path: ["specialCellIndex"],
        message: "Ô chữ đặc biệt không hợp lệ.",
      });
    }
  });

export const crosswordItemSchema = z
  .object({
    id: identifier,
    type: z.literal("CROSSWORD"),
    title: plain(1, 120),
    horizontalDurationSec: duration,
    verticalDurationSec: duration.optional(),
    verticalClue: plain(1, 300),
    verticalAnswer: plain(1, 120),
    horizontalRows: z
      .array(crosswordRowSchema)
      .min(LIMITS.minCrosswordRows)
      .max(LIMITS.maxCrosswordRows),
    bibleReference: optionalPlain(120),
    explanation: optionalPlain(500),
  })
  .strict()
  .superRefine((item, context) => {
    const verticalCells = answerCells(item.verticalAnswer);
    if (verticalCells.length !== item.horizontalRows.length) {
      context.addIssue({
        code: "custom",
        path: ["verticalAnswer"],
        message: "Số chữ dọc phải bằng số hàng ngang.",
      });
    }
    const clues = item.horizontalRows.map((row) => row.clue.trim().toLocaleUpperCase("vi"));
    const answers = item.horizontalRows.map((row) => normalizeAnswer(row.answer));
    if (new Set(clues).size !== clues.length) {
      context.addIssue({
        code: "custom",
        path: ["horizontalRows"],
        message: "Gợi ý hàng ngang không được trùng.",
      });
    }
    if (new Set(answers).size !== answers.length) {
      context.addIssue({
        code: "custom",
        path: ["horizontalRows"],
        message: "Đáp án hàng ngang không được trùng.",
      });
    }
    item.horizontalRows.forEach((row, index) => {
      const selected = answerCells(row.answer)[row.specialCellIndex];
      const expected = verticalCells[index];
      if (selected && expected && normalizeAnswer(selected) !== normalizeAnswer(expected)) {
        context.addIssue({
          code: "custom",
          path: ["horizontalRows", index, "specialCellIndex"],
          message: "Chữ được chọn không khớp từ khóa dọc.",
        });
      }
    });
  });

export const gameItemSchema = z.discriminatedUnion("type", [
  singleChoiceItemSchema,
  trueFalseItemSchema,
  shortAnswerItemSchema,
  crosswordItemSchema,
]);

export const gameDefinitionSchema = z
  .object({
    title: plain(3, 80),
    mode: z.enum(["TURN_BASED", "SPEED_RACE"]),
    defaultDurationSec: duration,
    items: z.array(gameItemSchema).min(1).max(LIMITS.maxItems),
    createdClientVersion: z.string().min(1).max(40),
  })
  .strict();

export const createRoomSchema = z
  .object({ game: gameDefinitionSchema, turnstileToken: z.string().max(4096).optional() })
  .strict();
export const joinRoomSchema = z
  .object({
    displayName: plain(LIMITS.minPlayerNameGraphemes, LIMITS.maxPlayerNameGraphemes),
    avatarId: z.enum(AVATARS),
    reconnectToken: z.string().min(32).max(256).optional(),
  })
  .strict();
export const ticketRequestSchema = z
  .object({ role: z.enum(["HOST", "PLAYER", "SCREEN"]) })
  .strict();
export const roomCodeSchema = z.string().regex(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/u);

export type ValidGameDefinition = z.infer<typeof gameDefinitionSchema>;
