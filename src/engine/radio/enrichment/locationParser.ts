// Engine - Radio Enrichment: Location parsing from state field

interface ParsedLocation {
  city?: string;
  region?: string;
  displayLocation: string;
}

// Common patterns for city/region separation
const SEPARATOR_PATTERNS = [
  /^(.+),\s*(.+)$/,      // "City, Region" or "City, State"
  /^(.+)\s*-\s*(.+)$/,   // "City - Region"
  /^(.+)\s*\/\s*(.+)$/,  // "City / Region"
];

// Words that indicate a region (not a city)
const REGION_INDICATORS = [
  'state', 'province', 'region', 'county', 'district',
  'oblast', 'krai', 'département', 'bundesland',
];

// Common US states abbreviations to full names
const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas',
  CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming', DC: 'Washington D.C.',
};

/**
 * Parse location from RadioBrowser state field
 */
export function parseLocation(state?: string, country?: string): ParsedLocation {
  if (!state || state.trim() === '') {
    return {
      displayLocation: country || '',
    };
  }
  
  const trimmedState = state.trim();
  
  // Try to match separator patterns
  for (const pattern of SEPARATOR_PATTERNS) {
    const match = trimmedState.match(pattern);
    if (match) {
      const [, part1, part2] = match;
      
      // Determine which part is city and which is region
      const isFirstRegion = isRegionName(part1);
      
      if (isFirstRegion) {
        return {
          region: part1.trim(),
          city: part2.trim(),
          displayLocation: formatDisplayLocation(part2.trim(), part1.trim(), country),
        };
      } else {
        return {
          city: part1.trim(),
          region: part2.trim(),
          displayLocation: formatDisplayLocation(part1.trim(), part2.trim(), country),
        };
      }
    }
  }
  
  // No separator found - determine if it's a city or region
  const isRegion = isRegionName(trimmedState) || isUSState(trimmedState);
  
  if (isRegion) {
    return {
      region: expandUSState(trimmedState),
      displayLocation: formatDisplayLocation(undefined, expandUSState(trimmedState), country),
    };
  }
  
  return {
    city: trimmedState,
    displayLocation: formatDisplayLocation(trimmedState, undefined, country),
  };
}

/**
 * Check if a name is likely a region (not a city)
 */
function isRegionName(name: string): boolean {
  const lower = name.toLowerCase();
  return REGION_INDICATORS.some(indicator => lower.includes(indicator));
}

/**
 * Check if string is a US state abbreviation
 */
function isUSState(name: string): boolean {
  return name.toUpperCase() in US_STATES;
}

/**
 * Expand US state abbreviation to full name
 */
function expandUSState(name: string): string {
  const upper = name.toUpperCase();
  return US_STATES[upper] || name;
}

/**
 * Format display location string
 */
function formatDisplayLocation(city?: string, region?: string, country?: string): string {
  const parts: string[] = [];
  
  if (city) parts.push(city);
  if (region && region !== city) parts.push(region);
  if (country && parts.length === 0) parts.push(country);
  
  return parts.join(', ');
}

/**
 * Get short location (city only or region only)
 */
export function getShortLocation(parsed: ParsedLocation): string {
  return parsed.city || parsed.region || '';
}
