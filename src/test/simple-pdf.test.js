const { buildSimplePdf } = require('../../dist/utils/simple-pdf');

describe('simple-pdf', () => {
  test('buildSimplePdf generates a valid PDF buffer', () => {
    const pdf = buildSimplePdf(['Expense Splitter Report', 'Hello world']);
    const output = pdf.toString('utf8');

    expect(output.startsWith('%PDF-1.4')).toBe(true);
    expect(output).toContain('Expense Splitter Report');
    expect(output).toContain('%%EOF');
  });
});
