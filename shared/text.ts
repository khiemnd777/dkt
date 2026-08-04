const punctuationPattern = /[^\p{L}\p{N}]/gu;

export function graphemes(value: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("vi", { granularity: "grapheme" });
    return Array.from(segmenter.segment(value), ({ segment }) => segment);
  }
  return Array.from(value.normalize("NFC"));
}

export function graphemeLength(value: string): number {
  return graphemes(value).length;
}

export function isPlainText(value: string): boolean {
  const hasControl = Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || (codePoint >= 127 && codePoint <= 159);
  });
  return !hasControl && !/[<>]/u.test(value);
}

export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[Đđ]/gu, "D")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(punctuationPattern, "");
}

export function answerCells(value: string): string[] {
  return graphemes(value.normalize("NFC")).filter((cell) => /[\p{L}\p{N}]/u.test(cell));
}

export function normalizeDisplayName(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleUpperCase("vi");
}
