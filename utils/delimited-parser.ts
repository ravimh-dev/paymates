export type Delimiter = ',' | '\t';

export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

const normalizeLineBreaks = (content: string): string => content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const splitRows = (content: string, delimiter: Delimiter): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentField += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      currentRow.push(currentField.trim());
      currentField = '';
      continue;
    }

    if (!inQuotes && char === '\n') {
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      continue;
    }

    currentField += char;
  }

  currentRow.push(currentField.trim());
  if (currentRow.some((cell) => cell !== '')) {
    rows.push(currentRow);
  }

  return rows;
};

export const detectDelimiter = (content: string): Delimiter => {
  const normalized = normalizeLineBreaks(content);
  const firstLine = normalized.split('\n').find((line) => line.trim().length > 0) || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return tabCount > commaCount ? '\t' : ',';
};

export const parseDelimitedText = (content: string, delimiter?: Delimiter): ParsedTable => {
  const normalized = normalizeLineBreaks(content).trim();
  if (!normalized) {
    return { headers: [], rows: [] };
  }

  const resolvedDelimiter = delimiter || detectDelimiter(normalized);
  const table = splitRows(normalized, resolvedDelimiter);
  if (!table.length) {
    return { headers: [], rows: [] };
  }

  const [headers, ...rows] = table;
  return {
    headers: headers.map((header) => header.trim().toLowerCase()),
    rows,
  };
};

export const rowToRecord = (
  headers: string[],
  row: string[]
): Record<string, string> => {
  return headers.reduce<Record<string, string>>((acc, header, index) => {
    acc[header] = (row[index] || '').trim();
    return acc;
  }, {});
};

export const splitList = (value: string): string[] => {
  if (!value) return [];
  return value
    .split(/[|;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

export const parseAllocationList = (value: string): Array<{ key: string; value: number }> => {
  if (!value) return [];

  return value
    .split(/[|;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const separatorIndex = item.lastIndexOf(':');
      if (separatorIndex === -1) {
        throw new Error(`Invalid allocation entry: "${item}"`);
      }

      const key = item.slice(0, separatorIndex).trim();
      const rawValue = item.slice(separatorIndex + 1).trim();
      const parsed = Number(rawValue);

      if (!key || Number.isNaN(parsed)) {
        throw new Error(`Invalid allocation entry: "${item}"`);
      }

      return { key, value: parsed };
    });
};
