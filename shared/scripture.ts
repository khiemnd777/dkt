export type ScriptureProviderId = "youversion";

export interface ScriptureReference {
  provider: ScriptureProviderId;
  bibleVersionId: number;
  bookUsfm: string;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
  passageId: string;
}

export interface ScriptureVersion {
  provider: ScriptureProviderId;
  id: number;
  abbreviation: string;
  localizedTitle: string;
  languageTag: string;
  copyright: string;
  publisherUrl?: string;
  organizationId?: string;
  deepLink?: string;
  attribution: string;
}

export interface ScriptureIndexVerse {
  id: string;
  number: number;
}

export interface ScriptureIndexChapter {
  id: string;
  number: number;
  verses: ScriptureIndexVerse[];
}

export interface ScriptureIndexBook {
  id: string;
  name: string;
  abbreviation: string;
  chapters: ScriptureIndexChapter[];
}

export interface ScriptureIndex {
  provider: ScriptureProviderId;
  bibleVersionId: number;
  books: ScriptureIndexBook[];
}

export interface ScriptureContextChunk {
  reference: ScriptureReference;
  localizedReference: string;
  content: string;
  contentSha256: string;
  attribution: string;
  deepLink?: string;
}

export interface ScriptureContext {
  version: ScriptureVersion;
  requestedScope: ScriptureReference;
  chunks: ScriptureContextChunk[];
}

export interface ReferenceValidation {
  valid: boolean;
  reference: ScriptureReference;
  reason?: "BOOK_NOT_FOUND" | "CHAPTER_NOT_FOUND" | "VERSE_NOT_FOUND" | "INVALID_RANGE";
}

export interface ScriptureProvider {
  listVersions(input: { languageRanges: string[] }): Promise<ScriptureVersion[]>;
  getVersion(versionId: number): Promise<ScriptureVersion>;
  getIndex(versionId: number): Promise<ScriptureIndex>;
  getPassage(reference: ScriptureReference): Promise<ScriptureContextChunk>;
  validateReference(reference: ScriptureReference): Promise<ReferenceValidation>;
}
