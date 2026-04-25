/**
 * OFAC / EU sanctioned country codes (ISO 3166-1 alpha-2).
 *
 * Buyers from these jurisdictions cannot complete Lite KYC and are
 * therefore unable to create orders. The list follows US OFAC SDN
 * country-based sanctions and EU consolidated restrictions.
 *
 * UA-43 (Crimea) is handled at the country level via 'UA' being absent —
 * a future refinement may add sub-region checks if partial sanctions
 * are needed for Ukraine proper.
 */
const BLOCKED_COUNTRY_CODES = new Set([
  'KP', // North Korea
  'IR', // Iran
  'CU', // Cuba
  'SY', // Syria
  'RU', // Russia (full sanctions per latest OFAC/EU packages)
]);

export function isBlockedCountry(countryCode: string): boolean {
  return BLOCKED_COUNTRY_CODES.has(countryCode.toUpperCase());
}

export function getBlockedCountryCodes(): ReadonlySet<string> {
  return BLOCKED_COUNTRY_CODES;
}
