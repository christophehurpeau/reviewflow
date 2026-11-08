const MIN_COLUMN_WEIGHT = 3;
const MAX_COLUMN_WEIGHT = 40;

const longestLineLength = (text: string): number =>
  Math.max(...text.split("\n").map((line) => line.trim().length));

/**
 * The flex-grow of each column, from the plain text of every row (header
 * included). Rows are separate flex rows, so a measured width cannot be shared
 * between them: a weight per column keeps them aligned. It is the column's
 * longest line, capped so a column of prose cannot squeeze an identifier, and
 * floored so an empty column stays readable.
 */
export function columnWeights(rows: readonly (readonly string[])[]): number[] {
  const columnCount = Math.max(0, ...rows.map((row) => row.length));
  return Array.from({ length: columnCount }, (_, column) => {
    const widest = Math.max(
      0,
      ...rows.map((row) => longestLineLength(row[column] ?? "")),
    );
    return Math.min(MAX_COLUMN_WEIGHT, Math.max(MIN_COLUMN_WEIGHT, widest));
  });
}
