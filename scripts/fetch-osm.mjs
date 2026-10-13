// 東京都内の OSM 自転車駐車場（amenity=bicycle_parking）を取得して src/data/osm-tokyo.json に保存する。
// 検索のたびに公開 Overpass サーバーへ問い合わせると遅く・よく落ちるため、事前に取っておいて同梱する。
// 使い方: node scripts/fetch-osm.mjs   （GitHub Actions で毎週実行）
import { writeFileSync } from "node:fs";

/** 東京都本土（島しょ部を除く）を覆う範囲 [south, west, north, east] */
const BBOX = [35.5, 138.94, 35.9, 139.93];

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

/** アプリで使うタグだけ残してサイズを抑える */
const KEEP = new Set(["amenity", "name", "name:ja", "access", "bicycle", "fee", "charge", "capacity", "opening_hours", "operator", "motorcycle", "website", "contact:website"]);

// 駐輪場に加えて、名前のない駐輪場を「◯◯駅 南東の駐輪スペース」と呼ぶための駅も取る
const query = `[out:json][timeout:180];(nwr["amenity"="bicycle_parking"](${BBOX.join(",")});node["railway"="station"]["name"](${BBOX.join(",")}););out center tags;`;

async function fetchOnce(url) {
  const res = await fetch(url, {
    method: "POST",
    body: new URLSearchParams({ data: query }),
    headers: { "User-Agent": "churin-navi/0.1 (+https://github.com/Takahashi130/churin-navi)", Accept: "application/json" },
    signal: AbortSignal.timeout(200_000),
  });
  const text = await res.text();
  if (!res.ok || !text.startsWith("{")) throw new Error(`${new URL(url).host}: HTTP ${res.status}`);
  const json = JSON.parse(text);
  if (json.remark && /error|timed out/i.test(json.remark)) throw new Error(`${new URL(url).host}: ${json.remark}`);
  return json;
}

let json;
const errors = [];
for (let round = 0; round < 3 && !json; round++) {
  for (const url of ENDPOINTS) {
    try {
      json = await fetchOnce(url);
      break;
    } catch (e) {
      errors.push(e.message);
    }
  }
  if (!json) await new Promise((r) => setTimeout(r, 20_000));
}
if (!json) {
  console.error("取得に失敗しました:", errors.join(" / "));
  process.exit(1);
}

const round6 = (n) => Math.round(n * 1e6) / 1e6;
// 駅は名前ごとに1点（路線ごとに別ノードがあるので重複を除く）
const stationMap = new Map();
for (const e of json.elements) {
  if (e.tags?.railway !== "station" || !e.tags.name || e.lat === undefined) continue;
  const name = e.tags.name.endsWith("駅") ? e.tags.name : `${e.tags.name}駅`;
  const list = stationMap.get(name) ?? [];
  list.push({ name, lat: round6(e.lat), lon: round6(e.lon) });
  stationMap.set(name, list);
}
// 同名の別駅（離れた場所）を潰さないよう、500m以上離れたものは別に残す
const stations = [];
for (const list of stationMap.values()) {
  const kept = [];
  for (const s of list) {
    if (!kept.some((k) => Math.abs(k.lat - s.lat) < 0.0045 && Math.abs(k.lon - s.lon) < 0.0055)) kept.push(s);
  }
  stations.push(...kept);
}
stations.sort((a, b) => a.name.localeCompare(b.name) || a.lat - b.lat);

const elements = json.elements
  .filter((e) => e.tags?.amenity === "bicycle_parking")
  .map((e) => {
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (lat === undefined || lon === undefined) return null;
    const tags = Object.fromEntries(
      Object.entries(e.tags ?? {}).filter(([k, v]) => KEEP.has(k) || (k.startsWith("payment:") && v === "yes")),
    );
    return { type: e.type, id: e.id, lat: round6(lat), lon: round6(lon), tags };
  })
  .filter(Boolean)
  .sort((a, b) => (a.type + a.id).localeCompare(b.type + b.id));

// 件数が急減した場合は取得異常とみなして上書きしない
if (elements.length < 3000) {
  console.error(`件数が少なすぎます（${elements.length}件）。上書きしません`);
  process.exit(1);
}

const out = {
  attribution: "© OpenStreetMap contributors",
  license: "ODbL 1.0 (https://opendatacommons.org/licenses/odbl/)",
  fetchedAt: json.osm3s?.timestamp_osm_base ?? new Date().toISOString(),
  bbox: BBOX,
  elements,
  stations,
};
writeFileSync(new URL("../src/data/osm-tokyo.json", import.meta.url), JSON.stringify(out) + "\n");
console.log(`${elements.length}件・駅${stations.length}件を保存しました（OSM ${out.fetchedAt}）`);
