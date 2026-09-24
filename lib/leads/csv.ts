export type CsvLeadRow = {
  source_url?: string;
  text: string;
  author?: string;
  created_at?: string;
  location?: string;
  source?: string;
};

function parseLine(line: string) {
  const cells: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(value.trim());
      value = "";
      continue;
    }
    value += char;
  }
  cells.push(value.trim());
  return cells;
}

export function parseLeadCsv(input: string): CsvLeadRow[] {
  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]).map((value) => value.trim().toLowerCase());
  if (!headers.includes("text")) throw new Error("CSV_MISSING_TEXT");
  const allowed = new Set(["source_url", "text", "author", "created_at", "location", "source"]);
  if (headers.some((header) => !allowed.has(header))) throw new Error("CSV_INVALID_COLUMN");

  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] || "";
    });
    return {
      source_url: row.source_url || undefined,
      text: row.text || "",
      author: row.author || undefined,
      created_at: row.created_at || undefined,
      location: row.location || undefined,
      source: row.source || undefined,
    };
  });
}
