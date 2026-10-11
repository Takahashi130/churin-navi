import type { Facility, LatLng, Pricing } from "./types.ts";
import { bearingDeg, distanceM } from "./geo.ts";

/**
 * 自分で確認した施設データ（src/data/verified.json）の1件。
 * osmId / googlePlaceId で検索結果に紐づける。location は紐づけ先が取れなかった時の表示用。
 */
export type VerifiedEntry = {
  id: string;
  name: string;
  location?: LatLng;
  osmId?: string; // 例 "way/1203906504"
  googlePlaceId?: string;
  /** 自転車を停められるか */
  bicycle: boolean;
  /** 一時利用（時間利用）ができるか。false = 定期・月極専用 */
  temporaryUse: boolean;
  motorcycleShared?: boolean;
  pricing?: Pricing;
  payment?: string[];
  source: { url?: string; checkedAt: string; note?: string };
};

/** Google の地点を OSM / 確認済みの施設と同一とみなす最大距離 */
const MERGE_RADIUS_M = 25;

export type MergeResult = { facilities: Facility[]; verifiedCount: number; excludedByVerified: number };

export function mergeFacilities(
  center: LatLng,
  radiusM: number,
  osm: Facility[],
  google: Facility[],
  verified: VerifiedEntry[],
): MergeResult {
  const list: Facility[] = osm.map((f) => ({ ...f }));
  const byOsm = new Map(list.map((f) => [f.id, f]));
  const usedGoogle = new Set<string>();
  let verifiedCount = 0;
  let excludedByVerified = 0;
  const excludedIds = new Set<string>();

  // 1) 確認済みデータを適用
  for (const v of verified) {
    const ok = v.bicycle && v.temporaryUse;
    const osmTarget = v.osmId ? byOsm.get(`osm:${v.osmId}`) : undefined;
    const gTarget = v.googlePlaceId ? google.find((g) => g.googlePlaceId === v.googlePlaceId) : undefined;
    if (gTarget) usedGoogle.add(gTarget.id);

    if (!ok) {
      // 自転車不可・定期専用と確認済み → 表示しない
      if (osmTarget) excludedIds.add(osmTarget.id);
      if (osmTarget || gTarget) excludedByVerified++;
      continue;
    }

    let target = osmTarget;
    if (!target) {
      const loc = gTarget?.location ?? v.location;
      if (!loc) continue;
      const d = distanceM(center, loc);
      if (d > radiusM) continue;
      target = {
        id: `verified:${v.id}`,
        name: v.name,
        location: loc,
        tier: "verified",
        sources: [],
        distanceM: d,
        bearingDeg: bearingDeg(center, loc),
      };
      list.push(target);
    }
    target.tier = "verified";
    target.sources = ["verified", ...target.sources];
    target.name = v.name || target.name;
    target.pricing = v.pricing ?? target.pricing;
    target.payment = v.payment ?? target.payment;
    target.motorcycleShared = v.motorcycleShared ?? target.motorcycleShared;
    target.verifiedSource = v.source;
    if (gTarget) attachGoogle(target, gTarget);
    verifiedCount++;
  }

  // 2) 残りの Google 地点：近接する OSM/確認済み施設があれば情報だけ統合、なければ未確認候補
  const anchors = list.filter((f) => !excludedIds.has(f.id));
  for (const g of google) {
    if (usedGoogle.has(g.id)) continue;
    let best: Facility | undefined;
    let bestD = Infinity;
    for (const a of anchors) {
      if (a.googlePlaceId) continue;
      const d = distanceM(a.location, g.location);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    if (best && bestD <= MERGE_RADIUS_M) {
      attachGoogle(best, g);
    } else {
      list.push({ ...g });
    }
  }

  const facilities = list
    .filter((f) => !excludedIds.has(f.id))
    .sort((a, b) => a.distanceM - b.distanceM);
  return { facilities, verifiedCount, excludedByVerified };
}

function attachGoogle(target: Facility, g: Facility) {
  target.googlePlaceId = g.googlePlaceId;
  target.googleMapsUri = g.googleMapsUri;
  target.photos = g.photos;
  target.address = target.address ?? g.address;
  if (g.name !== target.name) target.googleName = g.name;
  if (!target.sources.includes("google")) target.sources.push("google");
}
