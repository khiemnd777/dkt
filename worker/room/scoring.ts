import type { GameMode, PlayerAnswer, RuntimeRound } from "../../shared/game";
import { normalizeAnswer } from "../../shared/text";

export function isCorrectAnswer(round: RuntimeRound, answer: PlayerAnswer): boolean {
  const expected = round.privateAnswer;
  if (expected.type === "OPTION" && answer.type === "OPTION")
    return expected.optionId === answer.optionId;
  if (expected.type === "BOOLEAN" && answer.type === "BOOLEAN")
    return expected.value === answer.value;
  if (expected.type === "TEXT" && answer.type === "TEXT") {
    return expected.acceptedNormalized.includes(normalizeAnswer(answer.value));
  }
  return false;
}

export function calculateScore(input: {
  mode: GameMode;
  isCorrect: boolean;
  openedAt: number;
  deadlineAt: number;
  receivedAt: number;
  multiplier: number;
}): number {
  if (!input.isCorrect || input.receivedAt > input.deadlineAt) return 0;
  if (input.mode === "TURN_BASED") return 1_000 * input.multiplier;
  const duration = Math.max(1, input.deadlineAt - input.openedAt);
  const remainingRatio = Math.max(0, Math.min(1, (input.deadlineAt - input.receivedAt) / duration));
  const raw = (500 + 500 * remainingRatio) * input.multiplier;
  return Math.round(raw / 10) * 10;
}

export function calculateCrosswordVerticalScore(input: {
  isCorrect: boolean;
  revealedCells: number;
  totalCells: number;
}): number {
  if (!input.isCorrect || input.totalCells < 1) return 0;
  const remainingCells = Math.max(0, input.totalCells - input.revealedCells);
  const raw = (2_000 * remainingCells) / input.totalCells;
  return Math.round(raw / 10) * 10;
}
