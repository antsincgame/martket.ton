/**
 * CSV cell encoding hardened against spreadsheet formula injection.
 *
 * A cell whose text begins with `=`, `+`, `-`, `@` (or a leading tab /
 * carriage return) is interpreted as a formula by Excel / Google Sheets /
 * LibreOffice when the file is opened — a vector for data exfiltration or
 * client-side code execution (DDE) whenever a cell carries attacker-influenced
 * text (e.g. a seller- or agent-authored product name, or a wallet-supplied
 * memo). We neutralize it by prefixing a single quote, then ALWAYS quote-wrap
 * and escape embedded quotes so a value can never break out of its column
 * (which also fixes latent comma-shift bugs for unquoted fields).
 */
const FORMULA_TRIGGER_RE = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  const neutralized = FORMULA_TRIGGER_RE.test(s) ? `'${s}` : s;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

export function csvRow(cells: readonly unknown[]): string {
  return cells.map(csvCell).join(',');
}
