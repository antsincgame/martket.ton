'use strict';

/**
 * Strips path separators, control chars, quotes and CRLF from filenames
 * before they are echoed into HTTP headers (Content-Disposition).
 *
 * Defends against header injection (CRLF), directory traversal inside
 * filenames, and smuggling of quotes that would escape the attribute.
 *
 * Returns 'build.zip' as a safe default for empty or non-string input.
 */
function safeFilename(raw) {
  const fallback = 'build.zip';
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  let cleaned = raw.replace(/[\x00-\x1f\x7f"\\/]/g, '_').replace(/\s+/g, '_').trim();
  if (cleaned.length === 0) return fallback;
  if (cleaned.length > 200) cleaned = cleaned.slice(-200);
  return cleaned;
}

module.exports = { safeFilename };
