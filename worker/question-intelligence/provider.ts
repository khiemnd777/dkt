export type JsonSchema = Record<string, unknown>;

export interface AiStructuredResult<T> {
  value: T;
  model: string;
  responseId?: string;
  latencyMs: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    reasoningTokens?: number;
  };
}

export interface AiModelProvider {
  generateStructured<T>(input: {
    model: string;
    schemaName: string;
    schema: JsonSchema;
    instructions: string;
    data: unknown;
    image?: { mimeType: "image/jpeg" | "image/png" | "image/webp"; bytes: ArrayBuffer };
    reasoningEffort: "low" | "medium" | "high";
    maxOutputTokens?: number;
  }): Promise<AiStructuredResult<T>>;
}

export interface AudioTranscriptionProvider {
  transcribe(input: {
    audio: ArrayBuffer;
    mimeType: "audio/mpeg";
    language: "vi";
    contextTerms: string[];
  }): Promise<{ transcript: string; model: string; durationMs: number; requestId?: string }>;
}
