import type { GameItemType } from "../../../shared/game";

export interface QuestionStrategyDefinition {
  type: GameItemType;
  version: string;
  instruction: string;
}

export const QUESTION_STRATEGIES: Record<GameItemType, QuestionStrategyDefinition> = {
  SHORT_ANSWER: {
    type: "SHORT_ANSWER",
    version: "short-answer-v1",
    instruction:
      "Use one objective answer explicitly present in the supplied evidence. Aliases may only be orthographic or transliteration equivalents.",
  },
  SINGLE_CHOICE: {
    type: "SINGLE_CHOICE",
    version: "single-choice-v1",
    instruction:
      "Create exactly one grounded correct answer and same-category distractors that are unambiguously false within the stated scope. Never use all/none of the above.",
  },
  MULTIPLE_CHOICE: {
    type: "MULTIPLE_CHOICE",
    version: "multiple-choice-v1",
    instruction:
      "Use a closed answer set: 3–6 choices, 2–5 correct members, and at least one incorrect member. Wording must explicitly say to choose every correct answer.",
  },
  TRUE_FALSE: {
    type: "TRUE_FALSE",
    version: "true-false-v1",
    instruction:
      "Use one atomic claim. A false statement changes exactly one entity, location, number, action, or sequence slot; a true statement uses changedSlot null.",
  },
  CROSSWORD: {
    type: "CROSSWORD",
    version: "crossword-v1",
    instruction:
      "Return 3–10 unique grounded row answers. The number of rows must equal the grapheme count of the vertical answer, and row N must contain grapheme N of the vertical answer.",
  },
};

export function selectTargetTypes(requested: GameItemType[], count: number): GameItemType[] {
  return Array.from({ length: count }, (_, index) => requested[index % requested.length]);
}

export function strategyInstructions(types: GameItemType[]): string {
  return [...new Set(types)]
    .map((type) => `${type}: ${QUESTION_STRATEGIES[type].instruction}`)
    .join("\n");
}
