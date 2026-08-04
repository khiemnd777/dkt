export function crosswordRowOffsets(rows: ReadonlyArray<{ specialCellIndex: number }>): number[] {
  const verticalColumn = rows.reduce(
    (maximum, row) => Math.max(maximum, Math.max(0, Math.trunc(row.specialCellIndex))),
    0,
  );
  return rows.map((row) =>
    Math.max(0, verticalColumn - Math.max(0, Math.trunc(row.specialCellIndex))),
  );
}
