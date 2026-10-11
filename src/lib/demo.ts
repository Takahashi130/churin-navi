import type { Facility, LatLng, SearchResponse } from "./types.ts";
import { bearingDeg, distanceM } from "./geo.ts";

/**
 * デモモード用。実在しない施設を、現在地の周りに機械的に並べるだけ。
 * 実検索の結果とは絶対に混ぜない（API キー未設定時のみ使用）。
 */
const SAMPLES: { dx: number; dy: number; f: Partial<Facility> }[] = [
  {
    dx: 120, dy: 80,
    f: { tier: "verified", name: "【デモ】サンプル駐輪場A", pricing: { freeMinutes: 120, unitMinutes: 240, unitYen: 100 }, payment: ["現金", "交通系IC"] },
  },
  { dx: -200, dy: 150, f: { tier: "bicycle", name: "【デモ】サンプル駐輪場B", motorcycleShared: true } },
  { dx: 260, dy: -220, f: { tier: "bicycle", name: "【デモ】サンプル駐輪場C" } },
  { dx: -90, dy: -330, f: { tier: "candidate", name: "【デモ】サンプル候補D（自転車対応未確認）" } },
  { dx: 650, dy: 300, f: { tier: "verified", name: "【デモ】サンプル駐輪場E（1km圏）", pricing: { freeMinutes: 0, unitYen: 150, note: "当日限り" } } },
];

export function demoSearch(center: LatLng, radiusM: number): SearchResponse {
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((center.lat * Math.PI) / 180);
  const facilities: Facility[] = SAMPLES.map((s, i) => {
    const loc = { lat: center.lat + s.dy / mPerDegLat, lng: center.lng + s.dx / mPerDegLng };
    return {
      id: `demo:${i}`,
      name: "",
      location: loc,
      tier: "bicycle",
      sources: [],
      distanceM: distanceM(center, loc),
      bearingDeg: bearingDeg(center, loc),
      ...s.f,
    } as Facility;
  })
    .filter((f) => f.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM);
  return {
    center,
    radiusM,
    facilities,
    status: {
      google: { ok: false, count: 0, message: "デモモード（API キー未設定）" },
      osm: { ok: false, count: 0, message: "デモモード" },
      verified: { ok: false, count: 0, message: "デモモード" },
    },
    notices: ["デモモードです。表示中の施設はすべて架空のサンプルです。"],
    demo: true,
  };
}
