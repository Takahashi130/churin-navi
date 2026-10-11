import type { Facility, Pricing } from "./types.ts";

function duration(min: number): string {
  if (min % 60 === 0) return `${min / 60}時間`;
  if (min > 60) return `${Math.floor(min / 60)}時間${min % 60}分`;
  return `${min}分`;
}

/** 例: 「最初の2時間無料、その後4時間ごとに100円」 */
export function formatPricing(p: Pricing): string | undefined {
  const parts: string[] = [];
  if (p.freeMinutes && p.freeMinutes > 0) parts.push(`最初の${duration(p.freeMinutes)}無料`);
  if (p.unitMinutes && p.unitYen !== undefined) {
    const prefix = parts.length ? "その後" : "";
    parts.push(`${prefix}${duration(p.unitMinutes)}ごとに${p.unitYen}円`);
  } else if (p.freeMinutes === 0 && p.unitYen !== undefined) {
    parts.push(`1回${p.unitYen}円`);
  }
  if (p.maxYen !== undefined) parts.push(`上限${p.maxYen}円`);
  let s = parts.join("、");
  if (p.note) s = s ? `${s}（${p.note}）` : p.note;
  return s || undefined;
}

export type FeeDisplay = { text: string; confirmed: boolean };

/**
 * 料金表示。確認済みの構造化料金だけを「確認済み」とし、
 * それ以外は出典付きの参考情報か「料金未確認」にする。不明を無料扱いしない。
 */
export function feeDisplay(f: Facility): FeeDisplay {
  if (f.pricing) {
    const t = formatPricing(f.pricing);
    if (t) return { text: t, confirmed: true };
  }
  if (f.feeText) return { text: `${f.feeText}（OSM登録情報・未確認）`, confirmed: false };
  if (f.osmFee === true) return { text: "有料（金額は未確認・OSM登録情報）", confirmed: false };
  if (f.osmFee === false) return { text: "無料と登録あり（OSM登録情報・未確認）", confirmed: false };
  return { text: "料金未確認", confirmed: false };
}
