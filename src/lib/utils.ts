import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function safeJsonStringify(obj: any): string {
  const cache = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        return "[Circular]";
      }
      cache.add(value);
    }
    return value;
  });
}

export function formatVNTime(dateString?: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date);
  } catch (e) {
    return dateString;
  }
}

export function getCurrentVNDate(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
}

export function getCurrentVNDateString(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getVNMonth(dateString?: string): string | null {
  if (!dateString) return null;
  try {
    const d = new Date(new Date(dateString).toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch (e) {
    return null;
  }
}

export function getCurrentVNMonth(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getVNTimestamp(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  const second = String(d.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}${second}`;
}

export function getCurrentVNYear(): number {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  return d.getFullYear();
}

export function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

export interface KPIMetrics {
  score: number;
  multiplier: number;
  status: 'early' | 'on-time' | 'late' | 'very-late' | 'pending';
}

export function calculateKPIScore(
  deadline: string | Date | undefined, 
  completedAt: string | Date | undefined,
  weight: number = 10
): KPIMetrics {
  if (!completedAt) return { score: 0, multiplier: 0, status: 'pending' };
  if (!deadline) return { score: weight, multiplier: 1, status: 'on-time' };

  const dDate = new Date(deadline);
  const cDate = new Date(completedAt);
  
  const diffInHours = (dDate.getTime() - cDate.getTime()) / (1000 * 60 * 60);

  if (diffInHours > 0) {
    // Early
    return { score: weight * 1.2, multiplier: 1.2, status: 'early' };
  } else if (diffInHours === 0) {
    // On time
    return { score: weight, multiplier: 1, status: 'on-time' };
  } else if (Math.abs(diffInHours) <= 24) {
    // Late under 24h
    return { score: weight * 0.8, multiplier: 0.8, status: 'late' };
  } else {
    // Late over 24h
    return { score: weight * 0.5, multiplier: 0.5, status: 'very-late' };
  }
}

/**
 * Calculates the straight-line (Haversine) distance between two points on the Earth.
 * @returns Distance in kilometers
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return Number(d.toFixed(1));
}

export const geocodeAddressOSM = async (address: string): Promise<{ lat: number; lng: number } | undefined> => {
  if (!address || address.trim().length < 2) return undefined;
  
  const search = async (q: string) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&accept-language=vi`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon)
          };
        }
      }
    } catch (e) {
      console.error(e);
    }
    return undefined;
  };

  // Try exact address
  let result = await search(address);
  if (result) return result;

  // Fallback 1: Append Vietnam
  if (!address.toLowerCase().includes('việt nam') && !address.toLowerCase().includes('vietnam')) {
    result = await search(`${address}, Việt Nam`);
    if (result) return result;
  }

  // Fallback 2: Strip specific numbers at the beginning (e.g. "Số 70 Đồng Xung" -> "Đồng Xung")
  const strippedAddress = address.replace(/^(Số\s*\d+|^\d+)\s*/i, '').trim();
  if (strippedAddress && strippedAddress !== address) {
    result = await search(strippedAddress);
    if (result) return result;
    
    // Fallback 3: stripped + Vietnam
    result = await search(`${strippedAddress}, Việt Nam`);
    if (result) return result;
  }

  return undefined;
};

function deg2rad(deg: number): number {
  return deg * (Math.PI/180);
}

/**
 * Fetches the actual road network (driving) distance and duration between two coordinates using OSRM.
 * Falls back to Haversine distance if the API request fails.
 * @returns Object containing distance in km and duration in minutes
 */
export async function getDrivingDistance(lat1: number, lon1: number, lat2: number, lon2: number): Promise<{ distance: number, duration: number }> {
  try {
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = route.distance / 1000;
        const durationMin = route.duration / 60;
        return {
          distance: Number(distanceKm.toFixed(1)),
          duration: Math.round(durationMin)
        };
      }
    }
  } catch (error) {
    console.error('Error fetching OSRM route:', error);
  }
  
  // Fallback to straight-line distance (assuming 35km/h average speed)
  const straightLine = calculateDistance(lat1, lon1, lat2, lon2);
  const estimatedDuration = Math.round((straightLine / 35) * 60);
  return {
    distance: straightLine,
    duration: estimatedDuration
  };
}

export interface RoutePoint {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export interface OptimizedRouteStep {
  point: RoutePoint;
  distanceFromPrevKm: number;
  durationFromPrevMin: number;
}

export interface OptimizedRouteResult {
  steps: OptimizedRouteStep[];
  totalDistanceKm: number;
  totalDurationMin: number;
}

/**
 * Solves Traveling Salesperson Problem (TSP) using OSRM driving distances where possible.
 * Starts from startPoint (e.g., Factory).
 */
export async function optimizeRoute(
  startPoint: { lat: number; lng: number; name: string; address: string },
  points: RoutePoint[]
): Promise<OptimizedRouteResult> {
  const resultSteps: OptimizedRouteStep[] = [];
  let totalDistanceKm = 0;
  let totalDurationMin = 0;

  // 1. Geocode any points that do not have coordinates
  const resolvedPoints: (RoutePoint & { lat: number; lng: number })[] = [];
  for (const p of points) {
    let lat = p.latitude;
    let lng = p.longitude;
    if (lat === undefined || lng === undefined) {
      const coords = await geocodeAddressOSM(p.address);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
      }
    }
    if (lat !== undefined && lng !== undefined) {
      resolvedPoints.push({ ...p, lat, lng });
    }
  }

  if (resolvedPoints.length === 0) {
    return { steps: [], totalDistanceKm: 0, totalDurationMin: 0 };
  }

  // 2. Nearest Neighbor TSP algorithm
  let currentLat = startPoint.lat;
  let currentLng = startPoint.lng;
  const unvisited = [...resolvedPoints];

  while (unvisited.length > 0) {
    let bestIndex = -1;
    let bestDistance = Infinity;
    let bestDuration = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const p = unvisited[i];
      let dist = calculateDistance(currentLat, currentLng, p.lat, p.lng);
      let dur = Math.round((dist / 35) * 60);

      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${currentLng},${currentLat};${p.lng},${p.lat}?overview=false`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.routes && data.routes.length > 0) {
            dist = data.routes[0].distance / 1000;
            dur = Math.round(data.routes[0].duration / 60);
          }
        }
      } catch (e) {
        // Ignore fallback handles it
      }

      if (dist < bestDistance) {
        bestDistance = dist;
        bestDuration = dur;
        bestIndex = i;
      }
    }

    if (bestIndex !== -1) {
      const nextPoint = unvisited.splice(bestIndex, 1)[0];
      resultSteps.push({
        point: nextPoint,
        distanceFromPrevKm: Number(bestDistance.toFixed(1)),
        durationFromPrevMin: bestDuration
      });
      totalDistanceKm += bestDistance;
      totalDurationMin += bestDuration;
      currentLat = nextPoint.lat;
      currentLng = nextPoint.lng;
    }
  }

  return {
    steps: resultSteps,
    totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
    totalDurationMin
  };
}
