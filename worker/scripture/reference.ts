import { AppError } from "../../shared/errors";
import type { ScriptureIndex, ScriptureReference } from "../../shared/scripture";

const PASSAGE_ID =
  /^(?<book>(?:[1-3][A-Z]{2}|[A-Z]{3}))\.(?<chapter>[1-9]\d{0,2})(?:\.(?<start>[1-9]\d{0,2})(?:-(?<end>[1-9]\d{0,2}))?)?$/u;

const LOCALIZED_REFERENCE =
  /^(?<book>.+?)\s+(?<chapter>[1-9]\d{0,2})(?:\s*:\s*(?<start>[1-9]\d{0,2})(?:\s*[-–—]\s*(?<end>[1-9]\d{0,2}))?)?$/u;

function normalizedBookName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/gu, "d")
    .toUpperCase()
    .trim()
    .replace(/^(III|II|I)(?=[\s.-])/u, (roman) => String(roman.length))
    .replace(/[^A-Z0-9]/gu, "");
}

/** Resolve exact index names/aliases, never a fuzzy guess at a different book. */
export function resolveScriptureReference(
  bibleVersionId: number,
  rawReference: string,
  index: ScriptureIndex,
): ScriptureReference {
  const input = rawReference.trim();
  if (!input || input.length > 120 || index.bibleVersionId !== bibleVersionId) {
    throw new AppError("SCRIPTURE_REFERENCE_INVALID", 400);
  }
  let passageId = input.toUpperCase();
  if (!PASSAGE_ID.test(passageId)) {
    const match = LOCALIZED_REFERENCE.exec(input);
    if (!match?.groups) throw new AppError("SCRIPTURE_REFERENCE_INVALID", 400);
    const name = normalizedBookName(match.groups.book);
    const books = index.books.filter((book) =>
      [book.id, book.name, book.abbreviation, ...(book.aliases ?? [])].some(
        (alias) => normalizedBookName(alias) === name,
      ),
    );
    if (books.length !== 1) throw new AppError("SCRIPTURE_REFERENCE_INVALID", 400);
    passageId = `${books[0].id}.${match.groups.chapter}${match.groups.start ? `.${match.groups.start}${match.groups.end ? `-${match.groups.end}` : ""}` : ""}`;
  }
  const reference = parseScriptureReference(bibleVersionId, passageId);
  const book = index.books.find((entry) => entry.id === reference.bookUsfm);
  const chapter = book?.chapters.find((entry) => entry.number === reference.chapter);
  if (!chapter) throw new AppError("SCRIPTURE_REFERENCE_INVALID", 404);
  if (reference.verseStart) {
    const verses = new Set(chapter.verses.map((verse) => verse.number));
    const lastVerse = reference.verseEnd ?? reference.verseStart;
    for (let verse = reference.verseStart; verse <= lastVerse; verse += 1) {
      if (!verses.has(verse)) throw new AppError("SCRIPTURE_REFERENCE_INVALID", 404);
    }
  }
  return reference;
}

export function parseScriptureReference(
  bibleVersionId: number,
  rawPassageId: string,
): ScriptureReference {
  if (!Number.isInteger(bibleVersionId) || bibleVersionId <= 0) {
    throw new AppError("SCRIPTURE_VERSION_UNAVAILABLE", 404);
  }
  const passageId = rawPassageId.trim().toUpperCase();
  const match = PASSAGE_ID.exec(passageId);
  if (!match?.groups) throw new AppError("SCRIPTURE_REFERENCE_INVALID", 400);
  const chapter = Number(match.groups.chapter);
  const verseStart = match.groups.start ? Number(match.groups.start) : undefined;
  const verseEnd = match.groups.end ? Number(match.groups.end) : verseStart;
  if ((verseStart && verseEnd && verseEnd < verseStart) || (verseEnd && !verseStart)) {
    throw new AppError("SCRIPTURE_REFERENCE_INVALID", 400);
  }
  const canonical = `${match.groups.book}.${chapter}${verseStart ? `.${verseStart}${verseEnd !== verseStart ? `-${verseEnd}` : ""}` : ""}`;
  return {
    provider: "youversion",
    bibleVersionId,
    bookUsfm: match.groups.book,
    chapter,
    ...(verseStart ? { verseStart, verseEnd } : {}),
    passageId: canonical,
  };
}

export function passageIsWithin(candidateId: string, requested: ScriptureReference): boolean {
  try {
    const candidate = parseScriptureReference(requested.bibleVersionId, candidateId);
    if (candidate.bookUsfm !== requested.bookUsfm || candidate.chapter !== requested.chapter) {
      return false;
    }
    if (!requested.verseStart) return true;
    return Boolean(
      candidate.verseStart &&
        candidate.verseEnd &&
        candidate.verseStart >= requested.verseStart &&
        candidate.verseEnd <= (requested.verseEnd ?? requested.verseStart),
    );
  } catch {
    return false;
  }
}
