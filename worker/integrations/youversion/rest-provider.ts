import { AppError } from "../../../shared/errors";
import type {
  ReferenceValidation,
  ScriptureContextChunk,
  ScriptureIndex,
  ScriptureProvider,
  ScriptureReference,
  ScriptureVersion,
} from "../../../shared/scripture";
import { parseScriptureReference } from "../../scripture/reference";
import {
  type YouVersionBible,
  youVersionBibleCollectionSchema,
  youVersionBibleSchema,
  youVersionIndexSchema,
  youVersionPassageSchema,
} from "./schemas";

const BASE_URL = "https://api.youversion.com/v1";
const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

export interface YouVersionProviderOptions {
  appKey: string;
  allowedBibleIds?: ReadonlySet<number>;
  fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  sleep?: (milliseconds: number) => Promise<void>;
}

function normalizeText(value: string): string {
  return value.normalize("NFC").replace(/\s+/gu, " ").trim();
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function mapBible(input: YouVersionBible): ScriptureVersion {
  const id = Number(input.id);
  const abbreviation = input.localized_abbreviation ?? input.abbreviation;
  const localizedTitle = input.localized_title ?? input.title ?? abbreviation;
  const copyright = normalizeText(input.copyright || input.promotional_content || "");
  return {
    provider: "youversion",
    id,
    abbreviation,
    localizedTitle,
    languageTag: input.language_tag,
    copyright,
    ...(input.publisher_url ? { publisherUrl: input.publisher_url } : {}),
    ...(input.organization_id ? { organizationId: String(input.organization_id) } : {}),
    ...(input.youversion_deep_link ? { deepLink: input.youversion_deep_link } : {}),
    attribution: [localizedTitle, abbreviation, copyright].filter(Boolean).join(" · "),
  };
}

function retryDelay(response: Response | undefined, attempt: number): number {
  const retryAfter = response?.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(seconds * 1_000, 10_000);
    const at = Date.parse(retryAfter);
    if (Number.isFinite(at)) return Math.min(Math.max(at - Date.now(), 0), 10_000);
  }
  return Math.min(250 * 2 ** attempt, 2_000);
}

export class YouVersionRestProvider implements ScriptureProvider {
  private readonly fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(private readonly options: YouVersionProviderOptions) {
    if (!options.appKey) throw new AppError("SCRIPTURE_LICENSE_UNAVAILABLE", 503);
    this.fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
    this.sleep =
      options.sleep ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  private assertAllowed(versionId: number): void {
    if (this.options.allowedBibleIds && !this.options.allowedBibleIds.has(versionId)) {
      throw new AppError("SCRIPTURE_VERSION_UNAVAILABLE", 404);
    }
  }

  private async request(path: string, language = "vi"): Promise<unknown> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let response: Response | undefined;
      try {
        response = await this.fetcher(`${BASE_URL}${path}`, {
          headers: {
            Accept: "application/json",
            "Accept-Language": language,
            "X-YVP-App-Key": this.options.appKey,
          },
          signal: controller.signal,
        });
        if (response.ok) {
          if (response.status === 204) return undefined;
          return await response.json();
        }
        if (response.status === 429) {
          if (attempt < MAX_RETRIES) {
            await this.sleep(retryDelay(response, attempt));
            continue;
          }
          throw new AppError("SCRIPTURE_PROVIDER_RATE_LIMITED", 429);
        }
        if (response.status === 404) throw new AppError("SCRIPTURE_REFERENCE_INVALID", 404);
        if (response.status === 401 || response.status === 403 || response.status === 406) {
          throw new AppError("SCRIPTURE_LICENSE_UNAVAILABLE", 503);
        }
        if (response.status === 400) throw new AppError("SCRIPTURE_REFERENCE_INVALID", 400);
        if (response.status !== 500 && response.status !== 503) {
          throw new AppError("SCRIPTURE_VERSION_UNAVAILABLE", 503);
        }
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (attempt >= MAX_RETRIES) throw new AppError("SCRIPTURE_VERSION_UNAVAILABLE", 503);
      } finally {
        clearTimeout(timeout);
      }
      await this.sleep(retryDelay(response, attempt));
    }
    throw new AppError("SCRIPTURE_VERSION_UNAVAILABLE", 503);
  }

  async listVersions(input: { languageRanges: string[] }): Promise<ScriptureVersion[]> {
    if (this.options.allowedBibleIds) {
      const versions = await Promise.all(
        [...this.options.allowedBibleIds].map((versionId) => this.getVersion(versionId)),
      );
      return versions.filter((version) =>
        input.languageRanges.some((languageRange) => {
          const range = languageRange.toLowerCase();
          const tag = version.languageTag.toLowerCase();
          return tag === range || tag.startsWith(`${range}-`);
        }),
      );
    }

    const versions: ScriptureVersion[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 10; page += 1) {
      const params = new URLSearchParams({ page_size: "99" });
      for (const languageRange of input.languageRanges) {
        params.append("language_ranges[]", languageRange);
      }
      if (pageToken) params.set("page_token", pageToken);
      const response = await this.request(`/bibles?${params}`, input.languageRanges[0]);
      if (response === undefined) break;
      const parsed = youVersionBibleCollectionSchema.safeParse(response);
      if (!parsed.success) throw new AppError("SCRIPTURE_VERSION_UNAVAILABLE", 503);
      versions.push(
        ...parsed.data.data
          .map(mapBible)
          .filter(
            (version) =>
              !this.options.allowedBibleIds || this.options.allowedBibleIds.has(version.id),
          ),
      );
      pageToken = parsed.data.next_page_token ?? undefined;
      if (!pageToken) break;
    }
    return versions;
  }

  async getVersion(versionId: number): Promise<ScriptureVersion> {
    this.assertAllowed(versionId);
    const raw = await this.request(`/bibles/${versionId}`);
    const parsed = youVersionBibleSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("SCRIPTURE_VERSION_UNAVAILABLE", 503);
    return mapBible(parsed.data);
  }

  async getIndex(versionId: number): Promise<ScriptureIndex> {
    this.assertAllowed(versionId);
    const parsed = youVersionIndexSchema.safeParse(
      await this.request(`/bibles/${versionId}/index`),
    );
    if (!parsed.success) throw new AppError("SCRIPTURE_VERSION_UNAVAILABLE", 503);
    return {
      provider: "youversion",
      bibleVersionId: versionId,
      books: parsed.data.books.map((book) => ({
        id: book.id,
        name: book.full_title ?? book.title,
        abbreviation: book.abbreviation,
        aliases: [book.title, book.full_title, book.abbreviation].filter((value): value is string =>
          Boolean(value),
        ),
        chapters: book.chapters.map((chapter) => ({
          id: chapter.passage_id,
          number: Number(chapter.id),
          verses: chapter.verses.map((verse) => ({
            id: verse.passage_id,
            number: Number(verse.id),
          })),
        })),
      })),
    };
  }

  async validateReference(reference: ScriptureReference): Promise<ReferenceValidation> {
    const index = await this.getIndex(reference.bibleVersionId);
    const book = index.books.find((entry) => entry.id === reference.bookUsfm);
    if (!book) return { valid: false, reference, reason: "BOOK_NOT_FOUND" };
    const chapter = book.chapters.find((entry) => entry.number === reference.chapter);
    if (!chapter) return { valid: false, reference, reason: "CHAPTER_NOT_FOUND" };
    if (!reference.verseStart) return { valid: true, reference };
    const numbers = new Set(chapter.verses.map((verse) => verse.number));
    for (
      let number = reference.verseStart;
      number <= (reference.verseEnd ?? reference.verseStart);
      number += 1
    ) {
      if (!numbers.has(number)) return { valid: false, reference, reason: "VERSE_NOT_FOUND" };
    }
    return { valid: true, reference };
  }

  async getPassage(reference: ScriptureReference): Promise<ScriptureContextChunk> {
    this.assertAllowed(reference.bibleVersionId);
    const raw = await this.request(
      `/bibles/${reference.bibleVersionId}/passages/${encodeURIComponent(reference.passageId)}?format=text&include_headings=false&include_notes=false`,
    );
    const parsed = youVersionPassageSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("SCRIPTURE_REFERENCE_INVALID", 404);
    const content = normalizeText(parsed.data.content ?? parsed.data.text ?? "");
    return {
      reference: parseScriptureReference(reference.bibleVersionId, reference.passageId),
      localizedReference: parsed.data.reference,
      content,
      contentSha256: await sha256(`${reference.passageId}\n${content}`),
      attribution: normalizeText(parsed.data.copyright ?? "YouVersion"),
    };
  }
}
