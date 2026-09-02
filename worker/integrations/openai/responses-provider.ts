import { AppError } from "../../../shared/errors";
import type { AiModelProvider, AiStructuredResult } from "../../question-intelligence/provider";
import { openAiResponseSchema } from "./schemas";

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const TIMEOUT_MS = 45_000;

export interface OpenAiResponsesProviderOptions {
  apiKey: string;
  fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

function bytesToDataUrl(mimeType: string, bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return `data:${mimeType};base64,${btoa(binary)}`;
}

export class OpenAiResponsesProvider implements AiModelProvider {
  private readonly fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

  constructor(private readonly options: OpenAiResponsesProviderOptions) {
    if (!options.apiKey) throw new AppError("QUESTION_GENERATION_UNAVAILABLE", 503);
    this.fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
  }

  async generateStructured<T>(input: {
    model: string;
    schemaName: string;
    schema: Record<string, unknown>;
    instructions: string;
    data: unknown;
    image?: { mimeType: "image/jpeg" | "image/png" | "image/webp"; bytes: ArrayBuffer };
    reasoningEffort: "low" | "medium" | "high";
    maxOutputTokens?: number;
  }): Promise<AiStructuredResult<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const startedAt = Date.now();
    const content: Array<Record<string, unknown>> = [
      { type: "input_text", text: JSON.stringify(input.data) },
    ];
    if (input.image) {
      content.push({
        type: "input_image",
        image_url: bytesToDataUrl(input.image.mimeType, input.image.bytes),
        detail: "low",
      });
    }
    try {
      const response = await this.fetcher(RESPONSES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: input.model,
          instructions: input.instructions,
          input: [{ role: "user", content }],
          store: false,
          reasoning: { effort: input.reasoningEffort },
          max_output_tokens: input.maxOutputTokens ?? 8_000,
          text: {
            format: {
              type: "json_schema",
              name: input.schemaName,
              strict: true,
              schema: input.schema,
            },
          },
        }),
        signal: controller.signal,
      });
      if (response.status === 429) throw new AppError("QUESTION_GENERATION_RATE_LIMITED", 429);
      if (!response.ok) throw new AppError("QUESTION_GENERATION_UNAVAILABLE", 503);
      const parsed = openAiResponseSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.status !== "completed") {
        throw new AppError("QUESTION_GENERATION_UNAVAILABLE", 503);
      }
      const refusals = parsed.data.output
        .flatMap((item) => item.content ?? [])
        .filter((item) => item.type === "refusal");
      if (refusals.length > 0) throw new AppError("NO_VALID_CANDIDATES", 422);
      const outputText = parsed.data.output
        .flatMap((item) => item.content ?? [])
        .find((item) => item.type === "output_text");
      if (outputText?.type !== "output_text") {
        throw new AppError("QUESTION_GENERATION_UNAVAILABLE", 503);
      }
      let value: T;
      try {
        value = JSON.parse(outputText.text) as T;
      } catch {
        throw new AppError("QUESTION_GENERATION_UNAVAILABLE", 503);
      }
      return {
        value,
        model: parsed.data.model,
        ...(parsed.data.id ? { responseId: parsed.data.id } : {}),
        latencyMs: Date.now() - startedAt,
        ...(parsed.data.usage
          ? {
              usage: {
                inputTokens: parsed.data.usage.input_tokens,
                outputTokens: parsed.data.usage.output_tokens,
                ...(parsed.data.usage.output_tokens_details?.reasoning_tokens !== undefined
                  ? { reasoningTokens: parsed.data.usage.output_tokens_details.reasoning_tokens }
                  : {}),
              },
            }
          : {}),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("QUESTION_GENERATION_UNAVAILABLE", 503);
    } finally {
      clearTimeout(timeout);
    }
  }
}
