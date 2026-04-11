// ─── Geo utilities for distance/duration calculations ───

/**
 * Haversine formula: calculates the great-circle distance between two lat/lng points.
 * Returns distance in kilometers.
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculate total distance along a series of waypoints (in order).
 */
export function totalRouteDistance(
  locations: { lat: number; lng: number }[]
): number {
  let total = 0;
  for (let i = 1; i < locations.length; i++) {
    total += haversineDistance(
      locations[i - 1].lat,
      locations[i - 1].lng,
      locations[i].lat,
      locations[i].lng
    );
  }
  return total;
}

/**
 * Format distance for display: km or mi with appropriate precision.
 */
export function formatDistance(km: number, locale: string = 'zh-CN'): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString(locale)} km`;
}

/**
 * Calculate trip duration in days between two date strings.
 */
export function tripDurationDays(startDate: string, endDate?: string | null): number {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const diffMs = end.getTime() - start.getTime();
  return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Format duration for display.
 */
export function formatDuration(days: number, locale: string = 'zh-CN'): string {
  if (locale === 'zh-CN') {
    if (days < 30) return `${days} 天`;
    const months = Math.floor(days / 30);
    const remainDays = days % 30;
    return remainDays > 0 ? `${months} 个月 ${remainDays} 天` : `${months} 个月`;
  }
  if (days < 7) return `${days} day${days > 1 ? 's' : ''}`;
  const weeks = Math.floor(days / 7);
  const remainDays = days % 7;
  return remainDays > 0 ? `${weeks}w ${remainDays}d` : `${weeks}w`;
}
