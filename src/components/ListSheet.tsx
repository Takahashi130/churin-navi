"use client";

import type { Facility, SearchResponse } from "@/lib/types";
import { directionLabel, formatStraightDistance } from "@/lib/geo";
import { feeDisplay } from "@/lib/pricing";
import TierBadge from "./TierBadge";

type Props = {
  result: SearchResponse;
  facilities: Facility[];
  onPick: (id: string) => void;
  onClose: () => void;
};

export default function ListSheet({ result, facilities, onPick, onClose }: Props) {
  const { status } = result;
  return (
    <section className="sheet list" aria-label="一覧">
      <div className="sheet-head">
        <h2>近い順（直線距離）</h2>
        <button className="close" onClick={onClose} aria-label="閉じる">
          ✕
        </button>
      </div>
      <ol className="facility-list">
        {facilities.map((f) => {
          const dir = directionLabel(f.bearingDeg);
          return (
            <li key={f.id}>
              <button onClick={() => onPick(f.id)}>
                <span className="row1">
                  <span className="dist">
                    {dir.arrow} {formatStraightDistance(f.distanceM)}
                  </span>
                  <span className="name">{f.name}</span>
                </span>
                <TierBadge tier={f.tier} />
                <span className="fee">{feeDisplay(f).text}</span>
              </button>
            </li>
          );
        })}
        {facilities.length === 0 && <li className="empty">この範囲には表示できる施設がありません。</li>}
      </ol>

      <div className="search-meta">
        {result.notices.map((n) => (
          <p key={n} className="note">
            ※ {n}
          </p>
        ))}
        <p className="note">
          データ: OpenStreetMap {status.osm.ok ? `${status.osm.count}件` : `取得失敗/未使用（${status.osm.message ?? ""}）`}
          ／ Google {status.google.ok ? `${status.google.count}件（${status.google.message}）` : `未使用（${status.google.message ?? ""}）`}
          ／ 確認済み {status.verified.count}件
        </p>
        <p className="note">
          ※ 検索結果は網羅的ではありません。OSM・Google に登録されていない駐輪場や、自治体の小規模な路上駐輪場は表示されないことがあります。
        </p>
        {!result.demo && <p className="note">© OpenStreetMap contributors（ODbL）</p>}
      </div>
    </section>
  );
}
