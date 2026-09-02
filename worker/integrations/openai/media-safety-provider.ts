import { AppError } from "../../../shared/errors";

const MODERATIONS_URL = "https://api.openai.com/v1/moderations";
const TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";
const TIMEOUT_MS = 45_000;

function dataUrl(mimeType: string, bytes: ArrayBuffer | Uint8Array): string {
  const values = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of values) binary += String.fromCharCode(byte);
  return `data:${mimeType};base64,${btoa(binary)}`;
}

export interface MediaSafetyProvider {
  moderateText(text: string): Promise<void>;
  moderateImage(input: {
    bytes: Uint8Array;
    mimeType: string;
    accessibilityText: string;
  }): Promise<void>;
  transcribeAudio(input: {
    bytes: Uint8Array;
    model: string;
    contextTerms?: string[];
  }): Promise<string>;
}

export class OpenAiMediaSafetyProvider implements MediaSafetyProvider {
  private readonly fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

  constructor(
    private readonly apiKey: string,
    fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  ) {
    if (!apiKey) throw new AppError("QUESTION_MEDIA_UNSAFE", 503);
    this.fetcher = fetcher ?? ((input, init) => fetch(input, init));
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await this.fetcher(url, {
        ...init,
        headers: { Authorization: `Bearer ${this.apiKey}`, ...init.headers },
        signal: controller.signal,
      });
      if (!response.ok) throw new AppError("QUESTION_MEDIA_UNSAFE", 503);
      return response;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("QUESTION_MEDIA_UNSAFE", 503);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async moderate(input: unknown): Promise<void> {
    const response = await this.request(MODERATIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "omni-moderation-latest", input }),
    });
    const result = (await response.json()) as { results?: Array<{ flagged?: boolean }> };
    if (!Array.isArray(result.results) || result.results.length === 0) {
      throw new AppError("QUESTION_MEDIA_UNSAFE", 503);
    }
    if (result.results.some((entry) => entry.flagged))
      throw new AppError("QUESTION_MEDIA_UNSAFE", 422);
  }

  moderateText(text: string): Promise<void> {
    return this.moderate([{ type: "text", text }]);
  }

  moderateImage(input: {
    bytes: Uint8Array;
    mimeType: string;
    accessibilityText: string;
  }): Promise<void> {
    return this.moderate([
      { type: "text", text: input.accessibilityText },
      { type: "image_url", image_url: { url: dataUrl(input.mimeType, input.bytes) } },
    ]);
  }

  async transcribeAudio(input: {
    bytes: Uint8Array;
    model: string;
    contextTerms?: string[];
  }): Promise<string> {
    const form = new FormData();
    form.set("model", input.model);
    form.set("language", "vi");
    form.set("response_format", "json");
    if (input.contextTerms?.length) form.set("prompt", input.contextTerms.slice(0, 30).join(", "));
    form.set(
      "file",
      new File([Uint8Array.from(input.bytes).buffer], "question.mp3", { type: "audio/mpeg" }),
    );
    const response = await this.request(TRANSCRIPTIONS_URL, { method: "POST", body: form });
    const result = (await response.json()) as { text?: unknown };
    if (typeof result.text !== "string" || !result.text.trim()) {
      throw new AppError("QUESTION_MEDIA_INVALID", 400);
    }
    return result.text.normalize("NFC").replace(/\s+/gu, " ").trim().slice(0, 2_000);
  }
}
