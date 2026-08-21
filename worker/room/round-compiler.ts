import { AppError } from "../../shared/errors";
import type { GameDefinition, RuntimeRound } from "../../shared/game";
import { LIMITS } from "../../shared/limits";
import { answerCells, normalizeAnswer } from "../../shared/text";

const accepted = (canonical: string, aliases: string[]) =>
  Array.from(new Set([canonical, ...aliases].map(normalizeAnswer)));

export function compileGame(game: GameDefinition): RuntimeRound[] {
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
        publicPayload: { prompt: item.prompt, options: item.options },
        privateAnswer: { type: "OPTION", optionId: item.correctOptionId },
        durationSec: item.durationSec ?? game.defaultDurationSec,
        scoreMultiplier: 1,
        revealPayload: {
          answer: answer.text,
          bibleReference: item.bibleReference,
          explanation: item.explanation,
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
        },
        privateAnswer: { type: "BOOLEAN", value: item.correctValue },
        durationSec: item.durationSec ?? game.defaultDurationSec,
        scoreMultiplier: 1,
        revealPayload: {
          answer: item.correctValue ? "Đúng" : "Sai",
          bibleReference: item.bibleReference,
          explanation: item.explanation,
        },
      });
    } else if (item.type === "SHORT_ANSWER") {
      rounds.push({
        roundId: `${item.id}:0`,
        itemId: item.id,
        index,
        kind: item.type,
        publicPayload: { prompt: item.prompt },
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
        rounds.push({
          roundId: `${item.id}:h:${row.id}`,
          itemId: item.id,
          groupId: item.id,
          index: rounds.length,
          kind: "CROSSWORD_HORIZONTAL",
          publicPayload: {
            prompt: row.clue,
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
          },
        });
      });
    }
  }
  if (rounds.length > LIMITS.maxRuntimeRounds)
    throw new AppError("BAD_REQUEST", 400, "Game có quá nhiều vòng chơi.");
  return rounds;
}
