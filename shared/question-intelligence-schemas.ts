import { z } from "zod";
import { isPlainText } from "./text";

const plain = (min: number, max: number) =>
  z.string().trim().min(min).max(max).refine(isPlainText, "Chỉ chấp nhận văn bản thuần.");
const identifier = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/u);
const questionType = z.enum([
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "CROSSWORD",
]);
const passageId = z
  .string()
  .regex(/^(?:[1-3][A-Z]{2}|[A-Z]{3})\.[1-9]\d{0,2}(?:\.[1-9]\d{0,2}(?:-[1-9]\d{0,2})?)?$/u);

export const questionSuggestionsRequestSchema = z
  .object({
    scriptureScope: z
      .object({
        provider: z.literal("youversion"),
        bibleVersionId: z.number().int().positive(),
        passageId,
      })
      .strict(),
    count: z.number().int().min(1).max(10),
    types: z.union([z.literal("AUTO_BALANCE"), z.array(questionType).min(1).max(5)]),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD", "MIXED"]),
    audience: z.enum(["CHILDREN", "YOUTH", "ADULT", "MIXED"]),
    locale: z.literal("vi"),
    topic: plain(1, 120).optional(),
    mediaAssetId: identifier.optional(),
    mediaCapability: z.string().min(20).max(512).optional(),
    existingItems: z
      .array(
        z
          .object({
            type: questionType,
            normalizedAnswer: plain(1, 120).optional(),
            passageId: passageId.optional(),
            runtimeRoundCost: z.number().int().min(1).max(10).default(1),
          })
          .strict(),
      )
      .max(50)
      .default([]),
    turnstileToken: z.string().max(4096).optional(),
    clientGenerationId: z.string().uuid(),
  })
  .strict();

const evidenceSchema = z
  .object({
    passageId,
    supportingExcerpt: plain(1, 600),
    claimSupported: plain(1, 300),
  })
  .strict();

const presentationSchema = z
  .object({
    text: plain(1, 300),
    useProvidedMedia: z.boolean(),
    publicAccessibilityText: plain(1, 500).nullable().optional(),
  })
  .strict();

const difficultySchema = z
  .object({
    label: z.enum(["EASY", "MEDIUM", "HARD"]),
    featureReasons: z.array(plain(1, 160)).min(1).max(6),
  })
  .strict();

const common = {
  presentation: presentationSchema,
  evidence: z.array(evidenceSchema).min(1).max(12),
  proposedDifficulty: difficultySchema,
  explanation: plain(1, 500),
  uncertaintyNotes: z.array(plain(1, 300)).max(6),
};

const singleChoiceProposalSchema = z
  .object({
    ...common,
    type: z.literal("SINGLE_CHOICE"),
    payload: z
      .object({
        prompt: plain(1, 300),
        options: z.array(plain(1, 120)).min(2).max(4),
        correctOptionIndexes: z.tuple([z.number().int().min(0).max(3)]),
      })
      .strict(),
  })
  .strict();

const multipleChoiceProposalSchema = z
  .object({
    ...common,
    type: z.literal("MULTIPLE_CHOICE"),
    payload: z
      .object({
        prompt: plain(1, 300),
        options: z.array(plain(1, 120)).min(3).max(6),
        correctOptionIndexes: z.array(z.number().int().min(0).max(5)).min(2).max(5),
      })
      .strict(),
  })
  .strict();

const trueFalseProposalSchema = z
  .object({
    ...common,
    type: z.literal("TRUE_FALSE"),
    payload: z
      .object({
        statement: plain(1, 300),
        correctValue: z.boolean(),
        originalTrueClaim: plain(1, 300),
        changedSlot: z.enum(["ENTITY", "LOCATION", "NUMBER", "ACTION", "SEQUENCE"]).nullable(),
      })
      .strict(),
  })
  .strict();

const shortAnswerProposalSchema = z
  .object({
    ...common,
    type: z.literal("SHORT_ANSWER"),
    payload: z
      .object({
        prompt: plain(1, 300),
        canonicalAnswer: plain(1, 120),
        acceptedAliases: z.array(plain(1, 120)).max(10),
      })
      .strict(),
  })
  .strict();

const crosswordProposalSchema = z
  .object({
    ...common,
    type: z.literal("CROSSWORD"),
    payload: z
      .object({
        title: plain(1, 120),
        verticalClue: plain(1, 300),
        verticalAnswer: plain(1, 120),
        rows: z
          .array(
            z
              .object({
                clue: plain(1, 300),
                answer: plain(1, 120),
                acceptedAliases: z.array(plain(1, 120)).max(10),
                evidencePassageId: passageId,
                explanation: plain(1, 500),
              })
              .strict(),
          )
          .min(3)
          .max(10),
      })
      .strict(),
  })
  .strict();

export const modelQuestionProposalSchema = z.discriminatedUnion("type", [
  singleChoiceProposalSchema,
  multipleChoiceProposalSchema,
  trueFalseProposalSchema,
  shortAnswerProposalSchema,
  crosswordProposalSchema,
]);

export const modelQuestionBatchSchema = z
  .object({ proposals: z.array(modelQuestionProposalSchema).min(1).max(10) })
  .strict();

export type QuestionSuggestionsRequest = z.infer<typeof questionSuggestionsRequestSchema>;
export type ModelQuestionProposal = z.infer<typeof modelQuestionProposalSchema>;
export type ModelQuestionBatch = z.infer<typeof modelQuestionBatchSchema>;

export const modelQuestionReviewBatchSchema = z
  .object({
    reviews: z
      .array(
        z
          .object({
            candidateIndex: z.number().int().min(0).max(9),
            verdict: z.enum(["PASS", "WARN", "FAIL"]),
            reasons: z.array(plain(1, 300)).min(1).max(6),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict();

export type ModelQuestionReview = z.infer<typeof modelQuestionReviewBatchSchema>["reviews"][number];

const commonProperties = {
  presentation: {
    type: "object",
    additionalProperties: false,
    required: ["text", "useProvidedMedia", "publicAccessibilityText"],
    properties: {
      text: { type: "string", minLength: 1, maxLength: 300 },
      useProvidedMedia: { type: "boolean" },
      publicAccessibilityText: { type: ["string", "null"], maxLength: 500 },
    },
  },
  evidence: {
    type: "array",
    minItems: 1,
    maxItems: 12,
    items: {
      type: "object",
      additionalProperties: false,
      required: ["passageId", "supportingExcerpt", "claimSupported"],
      properties: {
        passageId: { type: "string", maxLength: 80 },
        supportingExcerpt: { type: "string", maxLength: 600 },
        claimSupported: { type: "string", maxLength: 300 },
      },
    },
  },
  proposedDifficulty: {
    type: "object",
    additionalProperties: false,
    required: ["label", "featureReasons"],
    properties: {
      label: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
      featureReasons: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: { type: "string", maxLength: 160 },
      },
    },
  },
  explanation: { type: "string", minLength: 1, maxLength: 500 },
  uncertaintyNotes: { type: "array", maxItems: 6, items: { type: "string", maxLength: 300 } },
} as const;

function branch(type: string, payload: Record<string, unknown>) {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "type",
      "payload",
      "presentation",
      "evidence",
      "proposedDifficulty",
      "explanation",
      "uncertaintyNotes",
    ],
    properties: { type: { const: type }, payload, ...commonProperties },
  };
}

const stringArray = (minItems: number, maxItems: number, maxLength = 120) => ({
  type: "array",
  minItems,
  maxItems,
  items: { type: "string", minLength: 1, maxLength },
});

export const MODEL_QUESTION_BATCH_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["proposals"],
  properties: {
    proposals: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: {
        anyOf: [
          branch("SINGLE_CHOICE", {
            type: "object",
            additionalProperties: false,
            required: ["prompt", "options", "correctOptionIndexes"],
            properties: {
              prompt: { type: "string", maxLength: 300 },
              options: stringArray(2, 4),
              correctOptionIndexes: {
                type: "array",
                minItems: 1,
                maxItems: 1,
                items: { type: "integer", minimum: 0, maximum: 3 },
              },
            },
          }),
          branch("MULTIPLE_CHOICE", {
            type: "object",
            additionalProperties: false,
            required: ["prompt", "options", "correctOptionIndexes"],
            properties: {
              prompt: { type: "string", maxLength: 300 },
              options: stringArray(3, 6),
              correctOptionIndexes: {
                type: "array",
                minItems: 2,
                maxItems: 5,
                items: { type: "integer", minimum: 0, maximum: 5 },
              },
            },
          }),
          branch("TRUE_FALSE", {
            type: "object",
            additionalProperties: false,
            required: ["statement", "correctValue", "originalTrueClaim", "changedSlot"],
            properties: {
              statement: { type: "string", maxLength: 300 },
              correctValue: { type: "boolean" },
              originalTrueClaim: { type: "string", maxLength: 300 },
              changedSlot: {
                type: ["string", "null"],
                enum: ["ENTITY", "LOCATION", "NUMBER", "ACTION", "SEQUENCE", null],
              },
            },
          }),
          branch("SHORT_ANSWER", {
            type: "object",
            additionalProperties: false,
            required: ["prompt", "canonicalAnswer", "acceptedAliases"],
            properties: {
              prompt: { type: "string", maxLength: 300 },
              canonicalAnswer: { type: "string", maxLength: 120 },
              acceptedAliases: stringArray(0, 10),
            },
          }),
          branch("CROSSWORD", {
            type: "object",
            additionalProperties: false,
            required: ["title", "verticalClue", "verticalAnswer", "rows"],
            properties: {
              title: { type: "string", maxLength: 120 },
              verticalClue: { type: "string", maxLength: 300 },
              verticalAnswer: { type: "string", maxLength: 120 },
              rows: {
                type: "array",
                minItems: 3,
                maxItems: 10,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: [
                    "clue",
                    "answer",
                    "acceptedAliases",
                    "evidencePassageId",
                    "explanation",
                  ],
                  properties: {
                    clue: { type: "string", maxLength: 300 },
                    answer: { type: "string", maxLength: 120 },
                    acceptedAliases: stringArray(0, 10),
                    evidencePassageId: { type: "string", maxLength: 80 },
                    explanation: { type: "string", maxLength: 500 },
                  },
                },
              },
            },
          }),
        ],
      },
    },
  },
} as const;

export const MODEL_QUESTION_REVIEW_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reviews"],
  properties: {
    reviews: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["candidateIndex", "verdict", "reasons"],
        properties: {
          candidateIndex: { type: "integer", minimum: 0, maximum: 9 },
          verdict: { type: "string", enum: ["PASS", "WARN", "FAIL"] },
          reasons: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            items: { type: "string", minLength: 1, maxLength: 300 },
          },
        },
      },
    },
  },
} as const;
