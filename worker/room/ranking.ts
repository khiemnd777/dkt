import type { GameMode } from "../../shared/game";

export interface RankablePlayer {
  playerId: string;
  displayName: string;
  avatarId: string;
  totalScore: number;
  correctCount: number;
  totalCorrectResponseMs: number;
  joinedAt?: number;
  removed?: boolean;
}

export interface RankedPlayer extends RankablePlayer {
  rank: number;
}

function tied(a: RankablePlayer, b: RankablePlayer, mode: GameMode): boolean {
  if (a.totalScore !== b.totalScore) return false;
  if (mode === "TURN_BASED") return true;
  return a.correctCount === b.correctCount && a.totalCorrectResponseMs === b.totalCorrectResponseMs;
}

export function rankPlayers(players: RankablePlayer[], mode: GameMode): RankedPlayer[] {
  const sorted = players
    .filter((player) => !player.removed)
    .slice()
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (mode === "SPEED_RACE") {
        if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
        if (a.totalCorrectResponseMs !== b.totalCorrectResponseMs)
          return a.totalCorrectResponseMs - b.totalCorrectResponseMs;
      }
      return a.joinedAt !== undefined && b.joinedAt !== undefined
        ? a.joinedAt - b.joinedAt
        : a.displayName.localeCompare(b.displayName, "vi");
    });
  const ranked: RankedPlayer[] = [];
  sorted.forEach((player, index) => {
    ranked.push({
      ...player,
      rank: index > 0 && tied(player, sorted[index - 1], mode) ? ranked[index - 1].rank : index + 1,
    });
  });
  return ranked;
}
