import { z } from "zod";

const responseContentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("output_text"), text: z.string() }).passthrough(),
  z.object({ type: z.literal("refusal"), refusal: z.string() }).passthrough(),
]);

export const openAiResponseSchema = z
  .object({
    id: z.string().optional(),
    model: z.string(),
    status: z.enum(["completed", "failed", "incomplete", "in_progress", "queued"]),
    incomplete_details: z.object({ reason: z.string() }).passthrough().nullable().optional(),
    output: z.array(
      z
        .object({
          type: z.string(),
          content: z.array(responseContentSchema).optional(),
        })
        .passthrough(),
    ),
    usage: z
      .object({
        input_tokens: z.number().int().nonnegative(),
        output_tokens: z.number().int().nonnegative(),
        output_tokens_details: z
          .object({ reasoning_tokens: z.number().int().nonnegative().optional() })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
