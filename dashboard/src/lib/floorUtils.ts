import type { SensorPoint } from '../types/bms';

const STORAGE_KEY = 'bms_point_floor_assignments';

/**
 * Retrieve user-assigned floor overrides from local storage
 */
export function getLocalPointFloors(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Assign a point to a specific floor and persist locally
 */
export function setLocalPointFloor(pointName: string, floorName: string): void {
  try {
    const map = getLocalPointFloors();
    map[pointName] = floorName.trim();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('Failed to save point floor override:', err);
  }
}

/**
 * Format raw floor string: cleans up whitespace and hex ords ($20 -> space),
 * while strictly PRESERVING the exact user floor name (e.g. "Ground_floor", "Ground_Floor", "GF", "First_Floor", "Third_Floor")
 */
export function formatFloorName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'Ground_floor';

  // Decode Niagara hex ords if present: $20 -> space, $31F -> 1F, $32F -> 2F, $33F -> 3F
  let decoded = trimmed.replace(/\$20/g, ' ');
  if (/^\$31f?$/i.test(decoded)) return '1F';
  if (/^\$32f?$/i.test(decoded)) return '2F';
  if (/^\$33f?$/i.test(decoded)) return '3F';

  return decoded;
}

/**
 * Intelligently detect the floor for a given sensor point from:
 * 1. Explicit point.floor_name (poller wrote exact Niagara subfolder)
 * 2. User overrides in localStorage
 * 3. Pattern from device_name (e.g. "Billing System - Ground_Floor - Brown" -> "Ground_Floor")
 * 4. Fallback from obix_url or name
 */
export function detectFloorFromPoint(pt: SensorPoint): string {
  // 1. Explicit database property if set directly by poller / Niagara
  if (pt.floor_name && pt.floor_name.trim()) {
    return formatFloorName(pt.floor_name);
  }

  // 2. User local override
  const localMap = getLocalPointFloors();
  if (localMap[pt.point_name]) {
    return formatFloorName(localMap[pt.point_name]);
  }

  // 3. Directly parse from device_name if Niagara pattern: "Billing System - <Floor> - <Tenant>"
  const dev = pt.device_name || '';
  if (dev.includes(' - ')) {
    const parts = dev.split(' - ').map((s) => s.trim());
    if (parts.length >= 3) {
      return formatFloorName(parts[1]); // e.g. "Ground_floor", "First_Floor", "Second_Floor"
    }
  }

  // 4. Heuristic matching across point_name, device_name, and obix_url
  const combined = `${pt.point_name} ${pt.device_name || ''} ${pt.obix_url || ''}`.toLowerCase();

  if (
    combined.includes('ground_floor') ||
    combined.includes('ground floor')
  ) {
    return 'Ground_floor';
  }

  if (
    combined.includes('first_floor') ||
    combined.includes('first floor') ||
    combined.includes('first') ||
    combined.includes('$31f') ||
    combined.includes(' 1f') ||
    combined.includes('- 1f') ||
    combined.includes('/1f/') ||
    combined.includes('/floor1/')
  ) {
    return 'First_Floor';
  }

  if (
    combined.includes('second_floor') ||
    combined.includes('second floor') ||
    combined.includes('second') ||
    combined.includes('$32f') ||
    combined.includes(' 2f') ||
    combined.includes('- 2f') ||
    combined.includes('/2f/') ||
    combined.includes('/floor2/')
  ) {
    return 'Second_Floor';
  }

  if (
    combined.includes('- gf') ||
    combined.includes(' gf') ||
    combined.includes('/gf/')
  ) {
    return 'GF';
  }

  // Room numbering: "Room 101" -> Floor 1, "Room 202" -> Floor 2
  const roomMatch = combined.match(/room[-_ ]*(\d+)/i);
  if (roomMatch) {
    const num = parseInt(roomMatch[1], 10);
    if (num >= 100) {
      return `Floor ${Math.floor(num / 100)}`;
    }
    return `Floor ${num}`;
  }

  return 'Ground_floor';
}

/**
 * Identify the assigned floor for a tenant invoice
 */
export function getInvoiceFloor(
  inv: { meter_name?: string; tenant_name?: string; unit_zone?: string },
  points: SensorPoint[] = []
): string {
  const norm = (s?: string) => (s || '').toLowerCase().replace(/[\s_\-$]+/g, '').replace(/(consumption|consumptions|kwh|meter|facility|tenant)/gi, '');
  const mTarget = (inv.meter_name || '').toLowerCase().trim();
  const tTarget = (inv.tenant_name || '').toLowerCase().trim();

  // 1. Direct point match from active sensor points (HIGHEST PRIORITY: live Niagara data!)
  const match = points.find((p) => {
    const pLower = p.point_name.toLowerCase();
    if (pLower === mTarget || (tTarget && pLower === tTarget)) return true;
    const core = norm(p.point_name);
    return core && (core === norm(inv.meter_name) || core === norm(inv.tenant_name));
  });

  if (match) {
    return detectFloorFromPoint(match);
  }

  // 2. Unit / Zone string (e.g. "Ground_floor - Suite 101", "First_Floor - Suite 201")
  if (inv.unit_zone && inv.unit_zone.includes(' - ')) {
    const floorPart = inv.unit_zone.split(' - ')[0].trim();
    if (floorPart) return formatFloorName(floorPart);
  }

  // 3. Fallback to point heuristics on meter_name or tenant_name
  return detectFloorFromPoint({
    point_name: inv.meter_name || inv.tenant_name || '',
    device_name: inv.unit_zone,
  } as SensorPoint);
}

/**
 * Natural sort helper for floor names:
 * Basement -> Ground Floor -> Floor 1 -> Floor 2 -> ... -> Rooftop
 */
export function sortFloorNames(floors: string[]): string[] {
  return [...floors].sort((a, b) => {
    const parseRank = (f: string): number => {
      const lower = f.toLowerCase();
      if (lower === 'gf' || lower.includes('ground') || lower.includes('base') || lower === 'b1') return -1;
      if (lower.includes('first') || lower.includes('1st') || lower === '1f') return 1;
      if (lower.includes('second') || lower.includes('2nd') || lower === '2f') return 2;
      if (lower.includes('third') || lower.includes('3rd') || lower === '3f') return 3;
      if (lower.includes('fourth') || lower.includes('4th') || lower === '4f') return 4;
      if (lower.includes('roof')) return 999;
      const num = parseInt(f.replace(/\D/g, ''), 10);
      return isNaN(num) ? 50 : num;
    };
    return parseRank(a) - parseRank(b);
  });
}

/**
 * Extract sorted unique floor list from the active points
 */
export function getAvailableFloors(points: SensorPoint[]): string[] {
  const set = new Set<string>();

  // Extract floors dynamically from all existing points
  points.forEach((pt) => {
    const fl = detectFloorFromPoint(pt);
    if (fl && fl.trim()) set.add(fl.trim());
  });

  // If no points yet, provide default Niagara floors
  if (set.size === 0) {
    set.add('GF');
    set.add('First_Floor');
    set.add('Second_Floor');
  }

  return sortFloorNames(Array.from(set));
}
