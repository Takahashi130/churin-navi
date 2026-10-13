import snapshot from "../data/osm-tokyo.json" with { type: "json" };
import type { Facility, Landmark, LatLng } from "./types.ts";
import { parseOsm, searchOsm, type OsmElement } from "./osm.ts";

type Snapshot = {
  fetchedAt: string;
  bbox: [number, number, number, number];
  elements: OsmElement[];
  stations?: { name: string; lat: number; lon: number }[];
};
const data = snapshot as unknown as Snapshot;

const STATIONS: Landmark[] = (data.stations ?? []).map((s) => ({ name: s.name, location: { lat: s.lat, lng: s.lon } }));

/** 中心から maxM 以内の駅（仮の名前付け用） */
export function stationsNear(c: LatLng, maxM: number): Landmark[] {
  const dLat = maxM / 111_320;
  const dLng = dLat / Math.cos((c.lat * Math.PI) / 180);
  return STATIONS.filter((s) => Math.abs(s.location.lat - c.lat) <= dLat && Math.abs(s.location.lng - c.lng) <= dLng);
}

/** 検索円が同梱データ（東京都本土）の範囲に収まっているか */
function covers(c: LatLng, radiusM: number): boolean {
  const [south, west, north, east] = data.bbox;
  const dLat = radiusM / 111_320;
  const dLng = dLat / Math.cos((c.lat * Math.PI) / 180);
  return c.lat - dLat >= south && c.lat + dLat <= north && c.lng - dLng >= west && c.lng + dLng <= east;
}

/**
 * 都内は同梱データ（scripts/fetch-osm.mjs で毎週更新）から即座に返す。
 * 範囲外のときだけ公開 Overpass サーバーに問い合わせる。
 */
export async function searchOsmFast(center: LatLng, radiusM: number): Promise<{ facilities: Facility[]; snapshotAt?: string }> {
  if (covers(center, radiusM)) {
    return { facilities: parseOsm(data.elements, center, radiusM), snapshotAt: data.fetchedAt };
  }
  return { facilities: await searchOsm(center, radiusM) };
}
