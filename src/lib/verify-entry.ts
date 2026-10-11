import type { LatLng, Pricing } from "./types.ts";
import type { VerifiedEntry } from "./merge.ts";

export type VerifyResult = "temporary" | "monthly" | "notBicycle";

export type VerifyRequest = {
  facility: { id: string; name: string; location: LatLng; googlePlaceId?: string };
  result: VerifyResult;
  pricing?: Pricing;
  payment?: string[];
  memo?: string;
};

const RESULTS: VerifyResult[] = ["temporary", "monthly", "notBicycle"];

export const RESULT_LABELS: Record<VerifyResult, string> = {
  temporary: "一時利用できる",
  monthly: "定期・月極専用",
  notBicycle: "自転車不可・駐輪場ではない",
};

function num(v: unknown, max: number): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n) : undefined;
}

function str(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

/** 入力を検証して VerifyRequest に整える。不正なら理由の文字列を返す */
export function parseVerifyRequest(body: unknown): VerifyRequest | string {
  const b = body as Record<string, unknown>;
  const f = b?.facility as Record<string, unknown> | undefined;
  const loc = f?.location as Record<string, unknown> | undefined;
  if (!f || typeof f.id !== "string" || !/^(osm|google|verified):[\w/.-]{1,200}$/.test(f.id)) return "施設IDが不正です";
  if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return "位置が不正です";
  if (!RESULTS.includes(b.result as VerifyResult)) return "確認結果が不正です";
  const p = (b.pricing ?? {}) as Record<string, unknown>;
  const pricing: Pricing = {
    freeMinutes: num(p.freeMinutes, 60 * 24 * 7),
    unitMinutes: num(p.unitMinutes, 60 * 24 * 31),
    unitYen: num(p.unitYen, 100000),
    maxYen: num(p.maxYen, 100000),
    note: str(p.note, 100),
  };
  const hasPricing = Object.values(pricing).some((v) => v !== undefined);
  const payment = Array.isArray(b.payment)
    ? b.payment.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 20)).slice(0, 8)
    : undefined;
  return {
    facility: {
      id: f.id,
      name: str(f.name, 100) ?? "名称なし",
      location: { lat: Number(loc.lat), lng: Number(loc.lng) },
      googlePlaceId: str(f.googlePlaceId, 300),
    },
    result: b.result as VerifyResult,
    pricing: hasPricing ? pricing : undefined,
    payment: payment?.length ? payment : undefined,
    memo: str(b.memo, 300),
  };
}

function todayJst(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

/**
 * 確認済みデータに1件追加（同じ施設があれば置き換え）した新しい配列を返す。
 * Google 由来の座標は保存しない（Places の規約で無期限保存できるのは place_id だけ）。
 */
export function upsertEntry(list: VerifiedEntry[], req: VerifyRequest): { list: VerifiedEntry[]; entry: VerifiedEntry } {
  const fid = req.facility.id;
  const osmId = fid.startsWith("osm:") ? fid.slice(4) : undefined;
  const existingId = fid.startsWith("verified:") ? fid.slice(9) : undefined;
  const idx = list.findIndex(
    (e) =>
      (existingId && e.id === existingId) ||
      (osmId && e.osmId === osmId) ||
      (req.facility.googlePlaceId && e.googlePlaceId === req.facility.googlePlaceId),
  );
  const prev = idx >= 0 ? list[idx] : undefined;
  const fromGoogleOnly = fid.startsWith("google:");
  const entry: VerifiedEntry = {
    id: prev?.id ?? `app-${fid.replace(/[^A-Za-z0-9]+/g, "-").slice(0, 60)}`,
    name: req.facility.name,
    ...(fromGoogleOnly ? {} : { location: prev?.location ?? req.facility.location }),
    ...(osmId ?? prev?.osmId ? { osmId: osmId ?? prev?.osmId } : {}),
    ...(req.facility.googlePlaceId ?? prev?.googlePlaceId
      ? { googlePlaceId: req.facility.googlePlaceId ?? prev?.googlePlaceId }
      : {}),
    bicycle: req.result !== "notBicycle",
    temporaryUse: req.result === "temporary",
    ...(req.pricing ?? prev?.pricing ? { pricing: req.pricing ?? prev?.pricing } : {}),
    ...(req.payment ?? prev?.payment ? { payment: req.payment ?? prev?.payment } : {}),
    source: {
      ...(prev?.source.url ? { url: prev.source.url } : {}),
      checkedAt: todayJst(),
      note: `現地確認（アプリから登録）${req.memo ? `：${req.memo}` : ""}`,
    },
  };
  const next = [...list];
  if (idx >= 0) next[idx] = entry;
  else next.push(entry);
  return { list: next, entry };
}
