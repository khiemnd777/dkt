import type { GameItemType } from "../../shared/game";
import type { QuestionSuggestionsRequest } from "../../shared/question-intelligence-schemas";
import { normalizeAnswer } from "../../shared/text";

type Existing = QuestionSuggestionsRequest["existingItems"][number];

const ORDER: GameItemType[] = [
  "SHORT_ANSWER",
  "SINGLE_CHOICE",
  "TRUE_FALSE",
  "MULTIPLE_CHOICE",
  "CROSSWORD",
];

const ESTIMATED_ROUND_COST: Record<GameItemType, number> = {
  SHORT_ANSWER: 1,
  SINGLE_CHOICE: 1,
  TRUE_FALSE: 1,
  MULTIPLE_CHOICE: 1,
  CROSSWORD: 6,
};

export function selectBalancedTypes(existing: Existing[], count: number): GameItemType[] {
  const selected: GameItemType[] = [];
  const counts = new Map<GameItemType, number>();
  for (const type of ORDER) counts.set(type, existing.filter((item) => item.type === type).length);
  let roundBudget = 100 - existing.reduce((total, item) => total + item.runtimeRoundCost, 0);
  for (let slot = 0; slot < count; slot += 1) {
    const totalAfter = existing.length + selected.length + 1;
    const ranked = ORDER.filter((type) => {
      if (ESTIMATED_ROUND_COST[type] > roundBudget) return false;
      if (type === "CROSSWORD" && (counts.get(type) ?? 0) > 0) return false;
      return true;
    })
      .map((type, order) => {
        const nextTypeCount = (counts.get(type) ?? 0) + 1;
        const choiceCount =
          (counts.get("SINGLE_CHOICE") ?? 0) +
          (counts.get("MULTIPLE_CHOICE") ?? 0) +
          (type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE" ? 1 : 0);
        const ratioPenalty =
          Math.max(0, nextTypeCount / totalAfter - 0.4) * 20 +
          Math.max(0, choiceCount / totalAfter - 0.5) * 20 +
          (type === "MULTIPLE_CHOICE" ? Math.max(0, nextTypeCount / totalAfter - 0.25) * 24 : 0) +
          (type === "TRUE_FALSE" ? Math.max(0, nextTypeCount / totalAfter - 0.3) * 20 : 0);
        return {
          type,
          score:
            nextTypeCount * 3 + ratioPenalty + ESTIMATED_ROUND_COST[type] * 0.15 + order * 0.001,
        };
      })
      .sort((left, right) => left.score - right.score);
    const chosen = ranked[0]?.type;
    if (!chosen) break;
    selected.push(chosen);
    counts.set(chosen, (counts.get(chosen) ?? 0) + 1);
    roundBudget -= ESTIMATED_ROUND_COST[chosen];
  }
  return selected;
}

export function targetDifficulties(
  difficulty: QuestionSuggestionsRequest["difficulty"],
  count: number,
): Array<"EASY" | "MEDIUM" | "HARD"> {
  if (difficulty !== "MIXED") return Array.from({ length: count }, () => difficulty);
  const easy = Math.round(count * 0.4);
  const medium = Math.round(count * 0.4);
  return Array.from({ length: count }, (_, index) =>
    index < easy ? "EASY" : index < easy + medium ? "MEDIUM" : "HARD",
  );
}

export function draftRecommendations(existing: Existing[]): string[] {
  if (!existing.length) return [];
  const warnings: string[] = [];
  const typeCounts = ORDER.map((type) => ({
    type,
    count: existing.filter((item) => item.type === type).length,
  }));
  const dominant = typeCounts.find((entry) => entry.count / existing.length > 0.5);
  if (dominant) {
    warnings.push(
      `${dominant.count}/${existing.length} mục hiện tại là ${dominant.type}; Auto Balance sẽ ưu tiên kiểu khác.`,
    );
  }
  const answers = existing
    .map((item) => item.normalizedAnswer)
    .filter((value): value is string => Boolean(value))
    .map(normalizeAnswer);
  if (new Set(answers).size < answers.length) warnings.push("Bản nháp có đáp án bị lặp.");
  const references = existing.map((item) => item.passageId).filter(Boolean);
  if (
    references.some((reference) => references.filter((value) => value === reference).length > 2)
  ) {
    warnings.push("Một phân đoạn đang được dùng hơn hai lần.");
  }
  return warnings;
}
