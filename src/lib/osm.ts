import type { Facility, LatLng } from "./types.ts";
import { bearingDeg, distanceM } from "./geo.ts";

/** 公開 Overpass サーバー。混雑で落ちることがあるので順に試す */
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/** 一時利用できない／一般に使えない可能性が高い access 値は除外 */
const EXCLUDED_ACCESS = new Set(["private", "no", "permit", "discouraged", "residents"]);

const PAYMENT_LABELS: Record<string, string> = {
  cash: "現金",
  coins: "硬貨",
  notes: "紙幣",
  ic_card: "交通系IC",
  suica: "交通系IC",
  pasmo: "交通系IC",
  felica: "電子マネー",
  credit_cards: "クレジットカード",
  qr_code: "QRコード決済",
  paypay: "PayPay",
};

export function buildQuery(c: LatLng, radiusM: number): string {
  const a = `(around:${Math.round(radiusM)},${c.lat.toFixed(6)},${c.lng.toFixed(6)})`;
  return `[out:json][timeout:20];nwr["amenity"="bicycle_parking"]${a};out center tags;`;
}

export function parseOsm(elements: OsmElement[], center: LatLng, radiusM: number): Facility[] {
  const out: Facility[] = [];
  for (const e of elements) {
    const t = e.tags ?? {};
    if (t.amenity !== "bicycle_parking") continue;
    const access = t.access ?? t.bicycle;
    if (access && EXCLUDED_ACCESS.has(access)) continue;
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    if (lat === undefined || lng === undefined) continue;
    const loc = { lat, lng };
    const d = distanceM(center, loc);
    if (d > radiusM) continue;

    const payment = Object.entries(t)
      .filter(([k, v]) => k.startsWith("payment:") && v === "yes")
      .map(([k]) => PAYMENT_LABELS[k.slice(8)] ?? k.slice(8));
    const capacity = t.capacity ? Number.parseInt(t.capacity, 10) : undefined;

    out.push({
      id: `osm:${e.type}/${e.id}`,
      name: t.name ?? t["name:ja"] ?? "名称未登録の駐輪スペース",
      location: loc,
      tier: "bicycle",
      sources: ["osm"],
      distanceM: d,
      bearingDeg: bearingDeg(center, loc),
      feeText: t.charge,
      osmFee: t.fee === "yes" ? true : t.fee === "no" ? false : undefined,
      payment: payment.length ? [...new Set(payment)] : undefined,
      capacity: Number.isFinite(capacity) ? capacity : undefined,
      openingHours: t.opening_hours,
      operator: t.operator,
      motorcycleShared: t.motorcycle === "yes" ? true : undefined,
      accessNote: access === "customers" ? "店舗・施設の利用者向け（OSM登録）" : undefined,
      website: t.website ?? t["contact:website"],
      osmUrl: `https://www.openstreetmap.org/${e.type}/${e.id}`,
    });
  }
  return out;
}

async function fetchOverpass(url: string, body: URLSearchParams, timeoutMs: number): Promise<OsmElement[]> {
  const ua = process.env.OVERPASS_USER_AGENT || "churin-navi/0.1 (personal use)";
  const host = new URL(url).host;
  const res = await fetch(url, {
    method: "POST",
    body,
    headers: { "User-Agent": ua, Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  const text = await res.text();
  // 混雑時は HTTP 200 でも XML/HTML のエラーページが返る
  if (!res.ok || !text.startsWith("{")) throw new Error(`${host}: HTTP ${res.status}`);
  const json = JSON.parse(text) as { elements: OsmElement[]; remark?: string };
  if (json.remark && /error|timed out/i.test(json.remark)) throw new Error(`${host}: ${json.remark}`);
  return json.elements;
}

/**
 * まず本家サーバーを短めのタイムアウトで試し、ダメなら残りのミラーと本家の再試行を並列に投げて
 * 最初に成功したものを使う（公開サーバーは混雑で数秒〜十数秒止まることがある）。
 */
export async function searchOsm(center: LatLng, radiusM: number): Promise<Facility[]> {
  const body = new URLSearchParams({ data: buildQuery(center, radiusM) });
  const errors: string[] = [];
  const wrap = (p: Promise<OsmElement[]>) =>
    p.catch((e: Error) => {
      const cause = (e as Error & { cause?: { code?: string } }).cause?.code;
      errors.push(e.name === "TimeoutError" ? "タイムアウト" : cause ? `${e.message} (${cause})` : e.message);
      throw e;
    });
  try {
    const elements = await wrap(fetchOverpass(ENDPOINTS[0], body, 10000)).catch(() =>
      Promise.any([
        ...ENDPOINTS.slice(1).map((u) => wrap(fetchOverpass(u, body, 20000))),
        wrap(fetchOverpass(ENDPOINTS[0], body, 20000)),
      ]),
    );
    return parseOsm(elements, center, radiusM);
  } catch {
    throw new Error(`OpenStreetMap（Overpass）に接続できませんでした（${errors.join(" / ")}）`);
  }
}
