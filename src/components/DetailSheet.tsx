"use client";

import { useState } from "react";
import type { Facility, Photo } from "@/lib/types";
import { feeDisplay } from "@/lib/pricing";
import TierBadge from "./TierBadge";
import ConfirmForm, { type ConfirmedInfo } from "./ConfirmForm";

export function routeUrl(f: Facility): string {
  const p = new URLSearchParams({ api: "1", destination: `${f.location.lat},${f.location.lng}` });
  if (f.googlePlaceId) p.set("destination_place_id", f.googlePlaceId);
  return `https://www.google.com/maps/dir/?${p.toString()}`;
}

type Props = { facility: Facility; demo: boolean; onClose: () => void; onConfirmed: (info: ConfirmedInfo) => void };

export default function DetailSheet({ facility: f, demo, onClose, onConfirmed }: Props) {
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const photos = f.photos ?? [];
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
      {f.nameFromGoogle && <p className="note">名前は近くのGoogle掲載地点のものです（同一施設とは限りません）</p>}

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

      {photos.length > 0 && (
        <div className="photos">
          {/* 1枚目は自動表示（1回の表示で Place Photos を1リクエスト）。残りは押した時だけ読む */}
          {(showAllPhotos ? photos : photos.slice(0, 1)).map((ph, i) => (
            <PhotoFigure key={ph.name} photo={ph} alt={`${f.name} の写真`} eager={i === 0} />
          ))}
          {!showAllPhotos && photos.length > 1 && (
            <button className="secondary link-btn" onClick={() => setShowAllPhotos(true)}>
              他の写真を見る（あと{photos.length - 1}枚）
            </button>
          )}
          <p className="note">写真は Google Maps のユーザー投稿等で、この施設の写真とは限りません。</p>
        </div>
      )}

      {!demo && <ConfirmForm facility={f} onDone={onConfirmed} />}

      <Sources f={f} />
    </section>
  );
}

function PhotoFigure({ photo, alt, eager }: { photo: Photo; alt: string; eager: boolean }) {
  return (
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/photo?name=${encodeURIComponent(photo.name)}`} alt={alt} loading={eager ? "eager" : "lazy"} />
      {photo.authors.length > 0 && (
        <figcaption>
          写真:{" "}
          {photo.authors.map((a, i) => (
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
