import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPricing, feeDisplay } from "./pricing.ts";
import { distanceM, directionLabel, formatStraightDistance, bearingDeg } from "./geo.ts";
import { parseOsm } from "./osm.ts";
import { isParkingLike } from "./google.ts";
import { mergeFacilities, type VerifiedEntry } from "./merge.ts";
import type { Facility } from "./types.ts";

const C = { lat: 35.6896, lng: 139.7006 };
const off = (dx: number, dy: number) => ({ lat: C.lat + dy / 111320, lng: C.lng + dx / (111320 * Math.cos((C.lat * Math.PI) / 180)) });

test("料金を「最初の2時間無料、その後4時間ごとに100円」の形にする", () => {
  assert.equal(formatPricing({ freeMinutes: 120, unitMinutes: 240, unitYen: 100 }), "最初の2時間無料、その後4時間ごとに100円");
  assert.equal(formatPricing({ unitMinutes: 1440, unitYen: 150, maxYen: 150 }), "24時間ごとに150円、上限150円");
});

test("不明な料金を無料扱いしない", () => {
  const f = { tier: "bicycle", sources: ["osm"] } as unknown as Facility;
  assert.equal(feeDisplay(f).text, "料金未確認");
  assert.equal(feeDisplay(f).confirmed, false);
  assert.match(feeDisplay({ ...f, osmFee: false }).text, /未確認/);
});

test("距離は直線と明記、方角", () => {
  const d = distanceM(C, off(0, 300));
  assert.ok(Math.abs(d - 300) < 2);
  assert.equal(formatStraightDistance(d), "直線 約300m");
  assert.equal(formatStraightDistance(1530), "直線 約1.5km");
  assert.equal(directionLabel(bearingDeg(C, off(200, 200))).name, "北東");
});

test("OSM: 私有・許可制を除外、範囲外を除外、customers は注記付き", () => {
  const p = off(100, 0);
  const far = off(900, 0);
  const res = parseOsm(
    [
      { type: "node", id: 1, lat: p.lat, lon: p.lng, tags: { amenity: "bicycle_parking", fee: "yes", name: "A" } },
      { type: "node", id: 2, lat: p.lat, lon: p.lng, tags: { amenity: "bicycle_parking", access: "private" } },
      { type: "node", id: 3, lat: p.lat, lon: p.lng, tags: { amenity: "bicycle_parking", access: "permit" } },
      { type: "way", id: 4, center: { lat: p.lat, lon: p.lng }, tags: { amenity: "bicycle_parking", access: "customers", motorcycle: "yes" } },
      { type: "node", id: 5, lat: far.lat, lon: far.lng, tags: { amenity: "bicycle_parking" } },
    ],
    C,
    500,
  );
  assert.deepEqual(res.map((f) => f.id), ["osm:node/1", "osm:way/4"]);
  assert.equal(res[0].osmFee, true);
  assert.equal(res[0].tier, "bicycle");
  assert.ok(res[1].accessNote);
  assert.equal(res[1].motorcycleShared, true);
});

test("Google: 駐車場系 type 以外は候補から外す", () => {
  assert.equal(isParkingLike(["parking", "point_of_interest"]), true);
  assert.equal(isParkingLike(["point_of_interest", "establishment"]), true);
  assert.equal(isParkingLike(["bicycle_store", "store"]), false);
  assert.equal(isParkingLike(["bike_sharing_station"]), false);
});

function fac(id: string, tier: Facility["tier"], loc: { lat: number; lng: number }, extra: Partial<Facility> = {}): Facility {
  return { id, name: id, location: loc, tier, sources: [tier === "candidate" ? "google" : "osm"], distanceM: distanceM(C, loc), bearingDeg: 0, ...extra };
}

test("統合: 確認済みで昇格・定期専用は除外・近接Googleは統合・遠いGoogleは未確認候補", () => {
  const osm = [fac("osm:way/1", "bicycle", off(100, 0)), fac("osm:way/2", "bicycle", off(-100, 0)), fac("osm:node/3", "bicycle", off(0, 200))];
  const google = [
    fac("google:G1", "candidate", off(110, 5), { googlePlaceId: "G1" }),
    fac("google:G2", "candidate", off(0, -300), { googlePlaceId: "G2" }),
  ];
  const verified: VerifiedEntry[] = [
    { id: "v1", name: "確認済みA", osmId: "way/1", bicycle: true, temporaryUse: true, pricing: { freeMinutes: 120, unitMinutes: 240, unitYen: 100 }, source: { checkedAt: "2026-10-11" } },
    { id: "v2", name: "定期専用B", osmId: "way/2", bicycle: true, temporaryUse: false, source: { checkedAt: "2026-10-11" } },
  ];
  const r = mergeFacilities(C, 500, osm, google, verified);
  const ids = r.facilities.map((f) => f.id);
  assert.deepEqual(ids, ["osm:way/1", "osm:node/3", "google:G2"]);
  assert.equal(r.facilities[0].tier, "verified");
  assert.equal(r.facilities[0].googlePlaceId, "G1");
  assert.equal(r.facilities[2].tier, "candidate");
  assert.equal(r.excludedByVerified, 1);
});

import { parseVerifyRequest, upsertEntry } from "./verify-entry.ts";

test("確認結果の入力検証", () => {
  assert.equal(typeof parseVerifyRequest({ facility: { id: "evil id", location: C }, result: "temporary" }), "string");
  assert.equal(typeof parseVerifyRequest({ facility: { id: "osm:way/1", location: C }, result: "maybe" }), "string");
  const ok = parseVerifyRequest({ facility: { id: "osm:way/1", name: "A", location: C }, result: "temporary", pricing: { freeMinutes: 120, unitYen: "100" } });
  assert.notEqual(typeof ok, "string");
  if (typeof ok !== "string") assert.deepEqual([ok.pricing?.freeMinutes, ok.pricing?.unitYen], [120, 100]);
});

test("確認結果の保存: OSMは座標とID、Googleのみは座標を保存しない、同じ施設は置き換え", () => {
  const osmReq = parseVerifyRequest({ facility: { id: "osm:way/9", name: "OSM駐輪場", location: C }, result: "temporary" });
  const gReq = parseVerifyRequest({ facility: { id: "google:G9", name: "G駐輪場", location: C, googlePlaceId: "G9" }, result: "monthly" });
  if (typeof osmReq === "string" || typeof gReq === "string") throw new Error("parse failed");
  let { list } = upsertEntry([], osmReq);
  ({ list } = upsertEntry(list, gReq));
  assert.equal(list.length, 2);
  assert.equal(list[0].osmId, "way/9");
  assert.deepEqual(list[0].location, C);
  assert.equal(list[0].temporaryUse, true);
  assert.equal(list[1].location, undefined);
  assert.equal(list[1].googlePlaceId, "G9");
  assert.equal(list[1].temporaryUse, false);
  const again = parseVerifyRequest({ facility: { id: "osm:way/9", name: "OSM駐輪場", location: C }, result: "notBicycle" });
  if (typeof again === "string") throw new Error("parse failed");
  ({ list } = upsertEntry(list, again));
  assert.equal(list.length, 2);
  assert.equal(list[0].bicycle, false);
});

import { searchOsmFast } from "./osm-snapshot.ts";

test("都内は同梱データから即座に返す", async () => {
  const t = Date.now();
  const r = await searchOsmFast(C, 500);
  assert.ok(r.snapshotAt);
  assert.ok(r.facilities.length > 10);
  assert.ok(Date.now() - t < 500);
  assert.ok(r.facilities.some((f) => f.id === "osm:way/1203906504"));
});
