export type RoomPhase =
  | "LOBBY"
  | "COUNTDOWN"
  | "QUESTION_OPEN"
  | "QUESTION_PAUSED"
  | "QUESTION_LOCKED"
  | "ANSWER_REVEAL"
  | "LEADERBOARD"
  | "FINISHED"
  | "DELETING";

const transitions: Record<RoomPhase, readonly RoomPhase[]> = {
  LOBBY: ["COUNTDOWN", "DELETING"],
  COUNTDOWN: ["QUESTION_OPEN", "DELETING"],
  QUESTION_OPEN: ["QUESTION_PAUSED", "QUESTION_LOCKED", "DELETING"],
  QUESTION_PAUSED: ["QUESTION_OPEN", "DELETING"],
  QUESTION_LOCKED: ["ANSWER_REVEAL", "DELETING"],
  ANSWER_REVEAL: ["LEADERBOARD", "COUNTDOWN", "FINISHED", "DELETING"],
  LEADERBOARD: ["COUNTDOWN", "FINISHED", "DELETING"],
  FINISHED: ["DELETING"],
  DELETING: [],
};

export function canTransition(from: RoomPhase, to: RoomPhase): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(from: RoomPhase, to: RoomPhase): void {
  if (!canTransition(from, to)) throw new Error(`Invalid room transition: ${from} -> ${to}`);
}
