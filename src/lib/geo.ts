import type { LatLng } from "./types.ts";

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** a から b への方位角（度、北=0、時計回り） */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const DIRS = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
const ARROWS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];

export function directionLabel(deg: number): { name: string; arrow: string } {
  const i = Math.round(deg / 45) % 8;
  return { name: DIRS[i], arrow: ARROWS[i] };
}

/** 経路距離と誤認されないよう、必ず「直線」を付ける */
export function formatStraightDistance(m: number): string {
  if (m < 1000) return `直線 約${Math.max(10, Math.round(m / 10) * 10)}m`;
  return `直線 約${(m / 1000).toFixed(1)}km`;
}

/** 中心から半径 r(m) の円を含む矩形（Text Search の locationRestriction 用） */
export function boundingBox(c: LatLng, r: number) {
  const dLat = (r / R) * (180 / Math.PI);
  const dLng = dLat / Math.cos(rad(c.lat));
  return {
    low: { latitude: c.lat - dLat, longitude: c.lng - dLng },
    high: { latitude: c.lat + dLat, longitude: c.lng + dLng },
  };
}
