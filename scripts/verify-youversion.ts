import { YouVersionRestProvider } from "../worker/integrations/youversion/rest-provider";
import { ScriptureService } from "../worker/scripture/service";

const appKey = process.env.YVP_APP_KEY;
const rawAllowed = process.env.YVP_ALLOWED_BIBLE_IDS ?? "";

if (!appKey) {
  console.error("YVP_APP_KEY is required for this opt-in release probe.");
  process.exitCode = 1;
} else {
  const allowed = rawAllowed
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
  if (!allowed.length) {
    console.error("YVP_ALLOWED_BIBLE_IDS must contain at least one approved Bible ID.");
    process.exitCode = 1;
  } else {
    const accessible: string[] = [];
    const provider = new YouVersionRestProvider({ appKey, allowedBibleIds: new Set(allowed) });
    const service = new ScriptureService(provider);
    for (const versionId of allowed) {
      try {
        const version = await provider.getVersion(versionId);
        if (version.id !== versionId || !version.languageTag.toLowerCase().startsWith("vi")) {
          throw new Error("Inaccessible Vietnamese version");
        }
        const index = await service.getIndex(versionId);
        const book = index.books.find((entry) =>
          entry.chapters.some((chapter) => chapter.verses.length),
        );
        const chapter = book?.chapters.find((entry) => entry.verses.length);
        const verse = chapter?.verses[0];
        if (!book || !chapter || !verse) throw new Error("Missing version index");
        const context = await service.lookupReference(
          versionId,
          `${book.id}.${chapter.number}.${verse.number}`,
        );
        if (!context.chunks[0]?.content || !context.version.copyright) {
          throw new Error("Missing passage or attribution");
        }
        accessible.push(`${version.abbreviation} (${version.languageTag}, version/index/passage)`);
      } catch {
        // Never log response bodies, passage text, credentials or raw provider errors.
        console.error(`YouVersion version/index/passage probe failed for Bible ${versionId}.`);
        process.exitCode = 1;
      }
    }
    if (accessible.length === allowed.length) {
      console.info(`YouVersion release probe passed for ${accessible.join(", ")}.`);
    }
  }
}
