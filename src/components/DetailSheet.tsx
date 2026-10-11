"use client";

import { useState } from "react";
import type { Facility } from "@/lib/types";
import { directionLabel, formatStraightDistance } from "@/lib/geo";
import { feeDisplay } from "@/lib/pricing";
import TierBadge from "./TierBadge";

export function routeUrl(f: Facility): string {
  const p = new URLSearchParams({ api: "1", destination: `${f.location.lat},${f.location.lng}` });
  if (f.googlePlaceId) p.set("destination_place_id", f.googlePlaceId);
  return `https://www.google.com/maps/dir/?${p.toString()}`;
}

export default function DetailSheet({ facility: f, demo, onClose }: { facility: Facility; demo: boolean; onClose: () => void }) {
  const [showPhotos, setShowPhotos] = useState(false);
  const dir = directionLabel(f.bearingDeg);
  const fee = feeDisplay(f);

  return (
    <section className="sheet detail" aria-label="施設の詳細">
      <div className="sheet-head">
        <h2>{f.name}</h2>
        <button className="close" onClick={onClose} aria-label="閉じる">
          ✕
        </button>
      </div>
      <TierBadge tier={f.tier} />

      <p className="distance">
        <span className="arrow" style={{ transform: `rotate(${f.bearingDeg}deg)` }} aria-hidden>
          ↑
        </span>
        {dir.name}へ {formatStraightDistance(f.distanceM)}
        <small>（道のりではありません）</small>
      </p>

      <a
        className={`primary big route${demo ? " disabled" : ""}`}
        href={demo ? undefined : routeUrl(f)}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={demo}
      >
        Googleマップで経路を見る
      </a>
      {demo && <p className="note">デモの施設は架空のため経路は開けません。</p>}

      <dl className="info">
        <dt>料金</dt>
        <dd className={fee.confirmed ? "" : "unconfirmed"}>{fee.text}</dd>
        {f.payment && (
          <>
            <dt>支払方法</dt>
            <dd>{f.payment.join("・")}</dd>
          </>
        )}
        {f.capacity !== undefined && (
          <>
            <dt>収容台数</dt>
            <dd>{f.capacity}台（OSM登録）</dd>
          </>
        )}
        {f.openingHours && (
          <>
            <dt>利用時間</dt>
            <dd>{f.openingHours}（OSM登録）</dd>
          </>
        )}
        {f.motorcycleShared && (
          <>
            <dt>車種</dt>
            <dd>自転車・バイク共用</dd>
          </>
        )}
        {f.accessNote && (
          <>
            <dt>利用条件</dt>
            <dd>{f.accessNote}</dd>
          </>
        )}
        {f.operator && (
          <>
            <dt>運営</dt>
            <dd>{f.operator}</dd>
          </>
        )}
        {f.address && (
          <>
            <dt>住所</dt>
            <dd>{f.address}</dd>
          </>
        )}
        {f.googleName && (
          <>
            <dt>近くのGoogle掲載地点</dt>
            <dd>{f.googleName}（同一施設とは限りません）</dd>
          </>
        )}
      </dl>

      {f.website && (
        <a className="secondary link-btn" href={f.website} target="_blank" rel="noopener noreferrer">
          運営会社のページ（空き状況が載っている場合あり）
        </a>
      )}

      {f.photos && f.photos.length > 0 && !showPhotos && (
        <button className="secondary link-btn" onClick={() => setShowPhotos(true)}>
          写真を見る（Google・{f.photos.length}枚）
        </button>
      )}
      {showPhotos && f.photos && (
        <div className="photos">
          {f.photos.map((ph) => (
            <figure key={ph.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photo?name=${encodeURIComponent(ph.name)}`} alt={`${f.name} の写真`} loading="lazy" />
              {ph.authors.length > 0 && (
                <figcaption>
                  写真:{" "}
                  {ph.authors.map((a, i) => (
                    <span key={i}>
                      {a.uri ? (
                        <a href={a.uri} target="_blank" rel="noopener noreferrer">
                          {a.displayName}
                        </a>
                      ) : (
                        a.displayName
                      )}
                    </span>
                  ))}
                </figcaption>
              )}
            </figure>
          ))}
          <p className="note">写真は Google Maps のユーザー投稿等で、この施設の写真とは限りません。</p>
        </div>
      )}

      <Sources f={f} />
    </section>
  );
}

function Sources({ f }: { f: Facility }) {
  return (
    <div className="sources">
      <span>情報源:</span>
      {f.verifiedSource && (
        <span>
          確認済みデータ（{f.verifiedSource.checkedAt}確認
          {f.verifiedSource.url && (
            <>
              ・
              <a href={f.verifiedSource.url} target="_blank" rel="noopener noreferrer">
                出典
              </a>
            </>
          )}
          ）
        </span>
      )}
      {f.osmUrl && (
        <a href={f.osmUrl} target="_blank" rel="noopener noreferrer">
          © OpenStreetMap contributors
        </a>
      )}
      {f.googleMapsUri && (
        <a href={f.googleMapsUri} target="_blank" rel="noopener noreferrer" translate="no">
          Google Maps
        </a>
      )}
      {f.sources.length === 0 && <span>デモ（架空）</span>}
    </div>
  );
}
