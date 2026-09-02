import { AppError } from "../../shared/errors";
import type { GameDefinition, RuntimeRound } from "../../shared/game";
import { LIMITS } from "../../shared/limits";
import { answerCells, normalizeAnswer } from "../../shared/text";

const accepted = (canonical: string, aliases: string[]) =>
  Array.from(new Set([canonical, ...aliases].map(normalizeAnswer)));

const publicMedia = (
  item: { presentation?: GameDefinition["items"][number]["presentation"] },
  mediaUrls: Readonly<Record<string, string>>,
) => {
  const media = item.presentation?.media;
  if (!media) return undefined;
  return {
    assetId: media.assetId,
    kind: media.kind,
    mimeType: media.mimeType,
    byteSize: media.byteSize,
    accessibilityText: media.accessibilityText,
    width: media.width,
    height: media.height,
    durationMs: media.durationMs,
    deliveryUrl: mediaUrls[media.assetId],
  };
};

const mediaReveal = (item: { presentation?: GameDefinition["items"][number]["presentation"] }) => ({
  mediaAccessibilityText: item.presentation?.media?.accessibilityText,
  mediaAttribution: item.presentation?.media?.rights.attribution,
});

export function compileGame(
  game: GameDefinition,
  mediaUrls: Readonly<Record<string, string>> = {},
): RuntimeRound[] {
  const rounds: RuntimeRound[] = [];
  for (const item of game.items) {
    const index = rounds.length;
    if (item.type === "SINGLE_CHOICE") {
      const answer = item.options.find((option) => option.id === item.correctOptionId);
      if (!answer) throw new AppError("BAD_REQUEST", 400);
      rounds.push({
        roundId: `${item.id}:0`,
        itemId: item.id,
        index,
        kind: item.type,
        publicPayload: {
          prompt: item.prompt,
          options: item.options,
          media: publicMedia(item, mediaUrls),
        },
        privateAnswer: { type: "OPTION", optionId: item.correctOptionId },
        durationSec: item.durationSec ?? game.defaultDurationSec,
        scoreMultiplier: 1,
        revealPayload: {
          answer: answer.text,
          bibleReference: item.bibleReference,
          explanation: item.explanation,
          ...mediaReveal(item),
        },
      });
    } else if (item.type === "MULTIPLE_CHOICE") {
      const correctOptions = item.correctOptionIds.map((id) =>
        item.options.find((option) => option.id === id),
      );
      if (correctOptions.some((option) => !option)) throw new AppError("BAD_REQUEST", 400);
      rounds.push({
        roundId: `${item.id}:0`,
        itemId: item.id,
        index,
        kind: item.type,
        publicPayload: {
          prompt: item.prompt,
          options: item.options,
          media: publicMedia(item, mediaUrls),
        },
        privateAnswer: { type: "OPTIONS", optionIds: [...item.correctOptionIds].sort() },
        durationSec: item.durationSec ?? game.defaultDurationSec,
        scoreMultiplier: 1,
        revealPayload: {
          answer: correctOptions.map((option) => option?.text).join("; "),
          bibleReference: item.bibleReference,
          explanation: item.explanation,
          ...mediaReveal(item),
        },
      });
    } else if (item.type === "TRUE_FALSE") {
      rounds.push({
        roundId: `${item.id}:0`,
        itemId: item.id,
        index,
        kind: item.type,
        publicPayload: {
          prompt: item.statement,
          options: [
            { id: "true", text: "Đúng" },
            { id: "false", text: "Sai" },
          ],
          media: publicMedia(item, mediaUrls),
        },
        privateAnswer: { type: "BOOLEAN", value: item.correctValue },
        durationSec: item.durationSec ?? game.defaultDurationSec,
        scoreMultiplier: 1,
        revealPayload: {
          answer: item.correctValue ? "Đúng" : "Sai",
          bibleReference: item.bibleReference,
          explanation: item.explanation,
          ...mediaReveal(item),
        },
      });
    } else if (item.type === "SHORT_ANSWER") {
      rounds.push({
        roundId: `${item.id}:0`,
        itemId: item.id,
        index,
        kind: item.type,
        publicPayload: { prompt: item.prompt, media: publicMedia(item, mediaUrls) },
        privateAnswer: {
          type: "TEXT",
          acceptedNormalized: accepted(item.canonicalAnswer, item.acceptedAliases),
        },
        durationSec: item.durationSec ?? game.defaultDurationSec,
        scoreMultiplier: 1,
        revealPayload: {
          answer: item.canonicalAnswer,
          bibleReference: item.bibleReference,
          explanation: item.explanation,
          ...mediaReveal(item),
        },
      });
    } else {
      const rowShape = item.horizontalRows.map((row) => ({
        id: row.id,
        cellCount: answerCells(row.answer).length,
        specialCellIndex: row.specialCellIndex,
      }));
      item.horizontalRows.forEach((row, rowIndex) => {
        const specialLetter = answerCells(item.verticalAnswer)[rowIndex];
        const presentationSource = row.presentation?.media ? row : item;
        rounds.push({
          roundId: `${item.id}:h:${row.id}`,
          itemId: item.id,
          groupId: item.id,
          index: rounds.length,
          kind: "CROSSWORD_HORIZONTAL",
          publicPayload: {
            prompt: row.clue,
            media: publicMedia(presentationSource, mediaUrls),
            crossword: {
              title: item.title,
              rowIndex,
              rowCount: item.horizontalRows.length,
              rows: rowShape,
              verticalClue: item.verticalClue,
            },
          },
          privateAnswer: {
            type: "TEXT",
            acceptedNormalized: accepted(row.answer, row.acceptedAliases),
          },
          durationSec: item.horizontalDurationSec,
          scoreMultiplier: 1,
          revealPayload: {
            answer: row.answer,
            bibleReference: row.bibleReference,
            explanation: row.explanation,
            crosswordRowId: row.id,
            specialLetter,
            ...mediaReveal(presentationSource),
          },
        });
      });
    }
  }
  if (rounds.length > LIMITS.maxRuntimeRounds)
    throw new AppError("BAD_REQUEST", 400, "Game có quá nhiều vòng chơi.");
  return rounds;
}
