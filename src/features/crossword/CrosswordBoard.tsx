import type { RoomSnapshot } from "@shared/room";
import { crosswordRowOffsets } from "./alignment";

export function CrosswordBoard({
  snapshot,
  large = false,
}: {
  snapshot: RoomSnapshot;
  large?: boolean;
}) {
  const board = snapshot.currentRound?.publicPayload.crossword;
  if (!board) return null;
  const rowOffsets = crosswordRowOffsets(board.rows);
  return (
    <div className={`crossword-board ${large ? "large" : ""}`}>
      <h3>{board.title}</h3>
      {board.rows.map((row, index) => {
        const matchingId = snapshot.revealedRoundIds.find((id) => id.includes(`:h:${row.id}`));
        const answer = matchingId ? snapshot.crosswordReveals?.[matchingId]?.answer : undefined;
        const cells = answer
          ? Array.from(answer.normalize("NFC")).filter((cell) => /[\p{L}\p{N}]/u.test(cell))
          : Array.from({ length: row.cellCount }, () => "");
        return (
          <div className={`board-row ${board.rowIndex === index ? "active" : ""}`} key={row.id}>
            <span>{index + 1}</span>
            <div>
              {Array.from({ length: rowOffsets[index] }, (_, spacerIndex) => (
                <i
                  aria-hidden="true"
                  className="alignment-spacer"
                  key={`${row.id}-spacer-${spacerIndex}`}
                />
              ))}
              {cells.map((cell, cellIndex) => (
                <i
                  className={cellIndex === row.specialCellIndex ? "special" : ""}
                  key={`${row.id}-${cellIndex}`}
                >
                  {cell || "·"}
                </i>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
