import { describe, expect, it } from "vitest";
import { crosswordRowOffsets } from "../../src/features/crossword/alignment";

describe("crossword vertical alignment", () => {
  it("shifts each row so every selected cell shares the rightmost vertical column", () => {
    expect(
      crosswordRowOffsets([
        { specialCellIndex: 1 },
        { specialCellIndex: 2 },
        { specialCellIndex: 1 },
      ]),
    ).toEqual([1, 0, 1]);
  });

  it("does not shift rows whose selected cells already line up", () => {
    expect(
      crosswordRowOffsets([
        { specialCellIndex: 0 },
        { specialCellIndex: 0 },
        { specialCellIndex: 0 },
      ]),
    ).toEqual([0, 0, 0]);
  });
});
