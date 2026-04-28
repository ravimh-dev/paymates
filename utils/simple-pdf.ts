const PDF_LINE_WRAP = 92;
const PDF_PAGE_LINE_LIMIT = 42;

const escapePdfText = (value: string): string => {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
};

const wrapText = (line: string): string[] => {
  if (line.length <= PDF_LINE_WRAP) return [line];

  const wrapped: string[] = [];
  let remaining = line;

  while (remaining.length > PDF_LINE_WRAP) {
    let cut = remaining.lastIndexOf(' ', PDF_LINE_WRAP);
    if (cut < 20) cut = PDF_LINE_WRAP;
    wrapped.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }

  if (remaining.length) wrapped.push(remaining);
  return wrapped;
};

const paginateLines = (lines: string[]): string[][] => {
  const wrappedLines = lines.flatMap((line) => wrapText(line));
  const pages: string[][] = [];

  for (let i = 0; i < wrappedLines.length; i += PDF_PAGE_LINE_LIMIT) {
    pages.push(wrappedLines.slice(i, i + PDF_PAGE_LINE_LIMIT));
  }

  return pages.length ? pages : [[]];
};

const buildContentStream = (lines: string[]): string => {
  const commands: string[] = [
    'BT',
    '/F1 11 Tf',
    '1 0 0 1 50 780 Tm',
  ];

  lines.forEach((line, index) => {
    const safeLine = escapePdfText(line);
    if (index === 0) {
      commands.push(`(${safeLine}) Tj`);
    } else {
      commands.push(`0 -14 Td`);
      commands.push(`(${safeLine}) Tj`);
    }
  });

  commands.push('ET');
  return commands.join('\n');
};

export const buildSimplePdf = (lines: string[]): Buffer => {
  const pages = paginateLines(lines);
  const objects: string[] = [];

  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;

  let nextObjectId = 4;
  const pageIds: number[] = [];
  const contentIds: number[] = [];

  pages.forEach(() => {
    pageIds.push(nextObjectId++);
    contentIds.push(nextObjectId++);
  });

  objects[catalogId] = `${catalogId} 0 obj
<< /Type /Catalog /Pages ${pagesId} 0 R >>
endobj`;

  objects[pagesId] = `${pagesId} 0 obj
<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>
endobj`;

  objects[fontId] = `${fontId} 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj`;

  pages.forEach((pageLines, index) => {
    const pageId = pageIds[index];
    const contentId = contentIds[index];
    const content = buildContentStream(pageLines);
    objects[contentId] = `${contentId} 0 obj
<< /Length ${Buffer.byteLength(content, 'utf8')} >>
stream
${content}
endstream
endobj`;

    objects[pageId] = `${pageId} 0 obj
<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>
endobj`;
  });

  const pdfParts: string[] = ['%PDF-1.4'];
  const offsets: number[] = [];

  for (const obj of objects.filter(Boolean)) {
    offsets.push(Buffer.byteLength(pdfParts.join('\n') + '\n', 'utf8'));
    pdfParts.push(obj);
  }

  const xrefOffset = Buffer.byteLength(pdfParts.join('\n') + '\n', 'utf8');
  const objectCount = objects.filter(Boolean).length + 1;
  const xrefLines = [
    'xref',
    `0 ${objectCount}`,
    '0000000000 65535 f ',
    ...offsets.map((offset) => `${offset.toString().padStart(10, '0')} 00000 n `),
    'trailer',
    `<< /Size ${objectCount} /Root ${catalogId} 0 R >>`,
    'startxref',
    `${xrefOffset}`,
    '%%EOF',
  ];

  return Buffer.from([...pdfParts, ...xrefLines].join('\n'), 'utf8');
};
