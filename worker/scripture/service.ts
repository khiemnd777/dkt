import { AppError } from "../../shared/errors";
import type {
  ScriptureContext,
  ScriptureIndex,
  ScriptureProvider,
  ScriptureVersion,
} from "../../shared/scripture";
import { parseScriptureReference, resolveScriptureReference } from "./reference";

const LANGUAGE_RANGE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u;
const versionListCache = new Map<
  string,
  { expiresAt: number; value: Promise<ScriptureVersion[]> }
>();
const indexCache = new Map<number, { expiresAt: number; value: Promise<ScriptureIndex> }>();

function cached<T>(
  cache: Map<string | number, { expiresAt: number; value: Promise<T> }>,
  key: string | number,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const existing = cache.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.value;
  const value = load();
  cache.set(key, { expiresAt: Date.now() + ttlMs, value });
  void value.catch(() => cache.delete(key));
  return value;
}

export class ScriptureService {
  constructor(private readonly provider: ScriptureProvider) {}

  listVersions(language: string): Promise<ScriptureVersion[]> {
    const normalized = language.trim();
    if (!LANGUAGE_RANGE.test(normalized)) throw new AppError("BAD_REQUEST", 400);
    return cached(versionListCache, normalized, 5 * 60_000, () =>
      this.provider.listVersions({ languageRanges: [normalized] }),
    );
  }

  getIndex(versionId: number): Promise<ScriptureIndex> {
    return cached(indexCache, versionId, 15 * 60_000, () => this.provider.getIndex(versionId));
  }

  async lookupReference(versionId: number, reference: string): Promise<ScriptureContext> {
    if (!reference.trim() || reference.length > 120) {
      throw new AppError("SCRIPTURE_REFERENCE_INVALID", 400);
    }
    // Authorize the version before reading a shared metadata cache. No AI calls or text cache.
    const version = await this.provider.getVersion(versionId);
    const index = await this.getIndex(versionId);
    const requestedScope = resolveScriptureReference(versionId, reference, index);
    const chunk = await this.provider.getPassage(requestedScope);
    return { version, requestedScope, chunks: [chunk] };
  }

  async getContext(versionId: number, passageId: string): Promise<ScriptureContext> {
    const requestedScope = parseScriptureReference(versionId, passageId);
    const validation = await this.provider.validateReference(requestedScope);
    if (!validation.valid) throw new AppError("SCRIPTURE_REFERENCE_INVALID", 404);
    const [version, chunk] = await Promise.all([
      this.provider.getVersion(versionId),
      this.provider.getPassage(requestedScope),
    ]);
    return { version, requestedScope, chunks: [chunk] };
  }
}
