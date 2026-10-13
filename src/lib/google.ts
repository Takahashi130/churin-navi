import type { Facility, Landmark, LatLng, Photo } from "./types.ts";
import { bearingDeg, boundingBox, distanceM } from "./geo.ts";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

/**
 * Text Search (New) の Pro SKU に収まるフィールドだけを要求する。
 * 営業時間・電話・支払方法などは Enterprise 以上になるので取らない。
 */
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.shortFormattedAddress",
  "places.types",
  "places.primaryType",
  "places.googleMapsUri",
  "places.photos",
  "nextPageToken",
].join(",");

/** 「駐輪場」で引っかかっても、駐車場系の type でなければ別物の可能性が高いので落とす */
const PARKING_TYPES = new Set(["parking", "parking_lot", "parking_garage"]);
const GENERIC_TYPES = new Set(["point_of_interest", "establishment"]);

export const QUERIES = ["駐輪場", "自転車駐車場"];

/** 半径に応じて取得ページ数を変える（1ページ=最大20件、1リクエスト=1課金） */
export function pagesForRadius(radiusM: number): number {
  if (radiusM <= 500) return 1;
  if (radiusM <= 1000) return 2;
  return 3;
}

type GPlace = {
  id: string;
  displayName?: { text: string };
  location?: { latitude: number; longitude: number };
  shortFormattedAddress?: string;
  types?: string[];
  primaryType?: string;
  googleMapsUri?: string;
  photos?: {
    name: string;
    authorAttributions?: { displayName: string; uri?: string }[];
  }[];
};

export type GoogleResult = {
  facilities: Facility[];
  requests: number;
  landmarks: Landmark[];
  droppedNonParking: number;
  truncated: boolean;
};

export function isParkingLike(types: string[] | undefined): boolean {
  if (!types || types.length === 0) return true;
  if (types.some((t) => PARKING_TYPES.has(t))) return true;
  return types.every((t) => GENERIC_TYPES.has(t));
}

export async function searchGoogle(center: LatLng, radiusM: number, apiKey: string): Promise<GoogleResult> {
  const byId = new Map<string, GPlace>();
  let requests = 0;
  let truncated = false;
  const maxPages = pagesForRadius(radiusM);

  await Promise.all(
    QUERIES.map(async (textQuery) => {
      let pageToken: string | undefined;
      for (let page = 0; page < maxPages; page++) {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": FIELD_MASK,
          },
          body: JSON.stringify({
            textQuery,
            languageCode: "ja",
            regionCode: "JP",
            pageSize: 20,
            locationRestriction: { rectangle: boundingBox(center, radiusM) },
            ...(pageToken ? { pageToken } : {}),
          }),
          signal: AbortSignal.timeout(10000),
          cache: "no-store",
        });
        requests++;
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new Error(`Places API HTTP ${res.status}: ${detail.slice(0, 200)}`);
        }
        const json = (await res.json()) as { places?: GPlace[]; nextPageToken?: string };
        for (const p of json.places ?? []) byId.set(p.id, p);
        pageToken = json.nextPageToken;
        if (!pageToken) break;
        if (page === maxPages - 1) truncated = true;
      }
    }),
  );

  const facilities: Facility[] = [];
  const landmarks: Landmark[] = [];
  let droppedNonParking = 0;
  for (const p of byId.values()) {
    if (!p.location) continue;
    const loc = { lat: p.location.latitude, lng: p.location.longitude };
    // 駐車場以外も含め、名前のない駐輪場を「◯◯付近」と呼ぶ目印には使う（表示のみ・保存しない）
    if (p.displayName?.text) landmarks.push({ name: p.displayName.text, location: loc });
    const d = distanceM(center, loc);
    if (d > radiusM) continue; // 矩形で取っているので円の外を落とす
    if (!isParkingLike(p.types)) {
      droppedNonParking++;
      continue;
    }
    const photos: Photo[] | undefined = p.photos?.slice(0, 3).map((ph) => ({
      name: ph.name,
      authors: (ph.authorAttributions ?? []).map((a) => ({ displayName: a.displayName, uri: a.uri })),
    }));
    facilities.push({
      id: `google:${p.id}`,
      name: p.displayName?.text ?? "（名称なし）",
      location: loc,
      tier: "candidate",
      sources: ["google"],
      distanceM: d,
      bearingDeg: bearingDeg(center, loc),
      address: p.shortFormattedAddress,
      googlePlaceId: p.id,
      googleMapsUri: p.googleMapsUri,
      photos: photos?.length ? photos : undefined,
    });
  }
  return { facilities, landmarks, requests, droppedNonParking, truncated };
}
