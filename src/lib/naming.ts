import type { Facility, Landmark } from "./types.ts";
import { UNNAMED } from "./osm.ts";
import { bearingDeg, directionLabel, distanceM } from "./geo.ts";

/** 「◯◯付近」と呼んでよい目印までの距離 */
const NEAR_M = 60;
/** 「◯◯駅 南東」と呼んでよい駅までの距離 */
const STATION_M = 800;

/**
 * 名前のない駐輪場に、表示用の仮の名前を付ける（保存はしない）。
 * 1. 60m 以内の名前付きの駐輪場・目印 →「◯◯付近の駐輪スペース」
 * 2. 800m 以内の最寄り駅 →「◯◯駅 南東の駐輪スペース」
 * どれも無ければ「名称未登録の駐輪スペース」のまま。
 */
export function assignProvisionalNames(facilities: Facility[], landmarks: Landmark[], stations: Landmark[]) {
  // 名前付きの駐輪場自体も目印にする（仮の名前どうしを連鎖させないよう、元から名前のあるものだけ）
  const named: Landmark[] = facilities
    .filter((f) => f.name !== UNNAMED && !f.provisionalName)
    .map((f) => ({ name: f.name, location: f.location }));
  const marks = [...named, ...landmarks];

  for (const f of facilities) {
    if (f.name !== UNNAMED) continue;
    const near = nearest(f, marks, NEAR_M);
    if (near) {
      f.name = `${near.name}付近の駐輪スペース`;
      f.provisionalName = true;
      continue;
    }
    const st = nearest(f, stations, STATION_M);
    if (st) {
      const dir = directionLabel(bearingDeg(st.location, f.location)).name;
      f.name = `${st.name} ${dir}の駐輪スペース`;
      f.provisionalName = true;
    }
  }
}

function nearest(f: Facility, marks: Landmark[], maxM: number): Landmark | undefined {
  let best: Landmark | undefined;
  let bestD = maxM;
  for (const m of marks) {
    const d = distanceM(f.location, m.location);
    if (d <= bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}
