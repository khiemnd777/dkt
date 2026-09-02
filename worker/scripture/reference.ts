import { AppError } from "../../shared/errors";
import type { ScriptureReference } from "../../shared/scripture";

const PASSAGE_ID =
  /^(?<book>(?:[1-3][A-Z]{2}|[A-Z]{3}))\.(?<chapter>[1-9]\d{0,2})(?:\.(?<start>[1-9]\d{0,2})(?:-(?<end>[1-9]\d{0,2}))?)?$/u;

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
