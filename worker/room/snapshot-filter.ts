import type { RuntimeRound } from "../../shared/game";
import type { RoomSnapshot } from "../../shared/room";

export function filterRoundForPublic(round: RuntimeRound): RoomSnapshot["currentRound"] {
  const { privateAnswer: _privateAnswer, revealPayload: _revealPayload, ...safe } = round;
  return safe;
}
