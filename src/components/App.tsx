"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Facility, LatLng, SearchResponse } from "@/lib/types";
import { demoSearch } from "@/lib/demo";
import GoogleMapView from "./GoogleMapView";
import DemoMapView from "./DemoMapView";
import DetailSheet from "./DetailSheet";
import ListSheet from "./ListSheet";

/** 位置情報が使えない時の初期表示（新宿駅） */
const FALLBACK_CENTER: LatLng = { lat: 35.6896, lng: 139.7006 };
const RADII = [500, 1000, 2000] as const;
type Radius = (typeof RADII)[number];

type Props = { mapsKey?: string; mapId: string; demo: boolean };

export type MapProps = {
  userPos?: LatLng;
  searchCenter?: LatLng;
  radius: number;
  facilities: Facility[];
  selectedId?: string;
  pending?: LatLng;
  fitKey: number;
  panTo?: { pos: LatLng; key: number };
  onSelect: (id: string | undefined) => void;
  onMapClick: (pos: LatLng) => void;
};

function getPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("この端末では位置情報が使えません"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? "位置情報の利用が許可されていません"
              : e.code === e.TIMEOUT
                ? "位置情報の取得がタイムアウトしました"
                : "現在地を取得できませんでした",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}

export default function App({ mapsKey, mapId, demo }: Props) {
  const [userPos, setUserPos] = useState<LatLng>();
  const [searchCenter, setSearchCenter] = useState<LatLng>();
  const [radius, setRadius] = useState<Radius>(500);
  const [result, setResult] = useState<SearchResponse>();
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(true);
  const [error, setError] = useState<string>();
  const [geoError, setGeoError] = useState<string>();
  const [pending, setPending] = useState<LatLng>();
  const [selectedId, setSelectedId] = useState<string>();
  const [showCandidates, setShowCandidates] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [fitKey, setFitKey] = useState(0);
  const [panTo, setPanTo] = useState<{ pos: LatLng; key: number }>();
  const reqId = useRef(0);

  const search = useCallback(
    async (center: LatLng, r: Radius) => {
      const id = ++reqId.current;
      setSearchCenter(center);
      setRadius(r);
      setPending(undefined);
      setSelectedId(undefined);
      setLoading(true);
      setError(undefined);
      try {
        let data: SearchResponse;
        if (demo) {
          await new Promise((res) => setTimeout(res, 300));
          data = demoSearch(center, r);
        } else {
          const res = await fetch(`/api/search?lat=${center.lat.toFixed(6)}&lng=${center.lng.toFixed(6)}&r=${r}`, {
            cache: "no-store",
          });
          if (!res.ok) throw new Error(`検索に失敗しました（HTTP ${res.status}）`);
          data = await res.json();
        }
        if (id !== reqId.current) return;
        setResult(data);
        setFitKey((k) => k + 1);
      } catch (e) {
        if (id !== reqId.current) return;
        setError((e as Error).message);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [demo],
  );

  const locateAndSearch = useCallback(
    async (r: Radius) => {
      setLocating(true);
      try {
        const pos = await getPosition();
        setUserPos(pos);
        setGeoError(undefined);
        setLocating(false);
        await search(pos, r);
      } catch (e) {
        setGeoError((e as Error).message);
        setPanTo((p) => ({ pos: searchCenter ?? FALLBACK_CENTER, key: (p?.key ?? 0) + 1 }));
      } finally {
        setLocating(false);
      }
    },
    [search, searchCenter],
  );

  // 起動したら現在地を取って自動検索（検索ボタン不要）
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void locateAndSearch(500);
  }, [locateAndSearch]);

  const recenter = async () => {
    setLocating(true);
    try {
      const pos = await getPosition();
      setUserPos(pos);
      setGeoError(undefined);
      setPanTo((p) => ({ pos, key: (p?.key ?? 0) + 1 }));
    } catch (e) {
      setGeoError((e as Error).message);
    } finally {
      setLocating(false);
    }
  };

  const research = () => {
    // 位置情報が使えるなら現在地で、使えないなら直前の検索地点で再検索
    if (geoError && searchCenter) void search(searchCenter, radius);
    else void locateAndSearch(radius);
  };

  const allFacilities = result?.facilities ?? [];
  const candidateCount = allFacilities.filter((f) => f.tier === "candidate").length;
  const visible = useMemo(
    () => allFacilities.filter((f) => showCandidates || f.tier !== "candidate"),
    [allFacilities, showCandidates],
  );
  const selected = visible.find((f) => f.id === selectedId);

  const mapProps: MapProps = {
    userPos,
    searchCenter,
    radius,
    facilities: visible,
    selectedId,
    pending,
    fitKey,
    panTo,
    onSelect: (id) => {
      setSelectedId(id);
      setPending(undefined);
    },
    onMapClick: (pos) => {
      setSelectedId(undefined);
      setPending(pos);
    },
  };

  const busy = loading || locating;

  return (
    <main className="app">
      <div className="map-area">
        {demo ? <DemoMapView {...mapProps} /> : <GoogleMapView {...mapProps} apiKey={mapsKey!} mapId={mapId} />}
      </div>

      {demo && (
        <div className="demo-banner" role="status">
          デモモード：API キー未設定のため、架空のサンプルを表示しています（実際の検索ではありません）
        </div>
      )}

      <div className="top-status" aria-live="polite">
        {locating && <span className="chip">現在地を取得中…</span>}
        {loading && !locating && <span className="chip">検索中…</span>}
        {geoError && !locating && (
          <span className="chip warn">{geoError}。地図をタップして探す場所を指定できます</span>
        )}
        {error && <span className="chip error">{error}</span>}
      </div>

      <div className="bottom-stack">
      <div className="fab-column">
        <button className="fab" onClick={recenter} disabled={locating} aria-label="現在地に戻る">
          <span aria-hidden>◎</span>
          <small>現在地</small>
        </button>
        <button className="fab" onClick={research} disabled={busy} aria-label="再検索">
          <span aria-hidden>↻</span>
          <small>再検索</small>
        </button>
      </div>

      {pending && (
        <div className="pending-bar">
          <button className="primary big" onClick={() => void search(pending, radius)}>
            この地点の周辺を探す
          </button>
          <button className="secondary" onClick={() => setPending(undefined)}>
            やめる
          </button>
        </div>
      )}

      {selected ? (
        <DetailSheet key={selected.id} facility={selected} demo={demo} onClose={() => setSelectedId(undefined)} />
      ) : (
        !pending && (
          <section className="bottom-panel">
            <div className="summary-row">
              <div className="summary">
                {result ? (
                  <>
                    <strong>{visible.length}件</strong>
                    <span>（{radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}以内・直線距離）</span>
                  </>
                ) : busy ? (
                  "準備中…"
                ) : (
                  "検索地点を指定してください"
                )}
              </div>
              <button className="secondary" onClick={() => setListOpen(true)} disabled={!result}>
                一覧
              </button>
            </div>

            {result && visible.length === 0 && !busy && (
              <p className="empty">この範囲では見つかりませんでした。</p>
            )}

            <div className="radius-row" role="group" aria-label="検索範囲">
              {RADII.map((r) => (
                <button
                  key={r}
                  className={r === radius ? "radius active" : "radius"}
                  disabled={busy || !searchCenter}
                  onClick={() => searchCenter && void search(searchCenter, r)}
                >
                  {r === 500 ? "500m" : `${r / 1000}kmまで探す`}
                </button>
              ))}
            </div>

            {candidateCount > 0 && (
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={showCandidates}
                  onChange={(e) => setShowCandidates(e.target.checked)}
                />
                自転車対応が未確認の候補（Google）も表示 {candidateCount}件
              </label>
            )}

            {result && <Legend />}
          </section>
        )
      )}

      </div>

      {listOpen && result && (
        <ListSheet
          result={result}
          facilities={visible}
          onPick={(id) => {
            setSelectedId(id);
            setListOpen(false);
            const f = visible.find((x) => x.id === id);
            if (f) setPanTo((p) => ({ pos: f.location, key: (p?.key ?? 0) + 1 }));
          }}
          onClose={() => setListOpen(false)}
        />
      )}
    </main>
  );
}

function Legend() {
  return (
    <div className="legend">
      <span>
        <i className="dot verified" />一時利用 確認済み
      </span>
      <span>
        <i className="dot bicycle" />自転車用（一時利用は未確認）
      </span>
      <span>
        <i className="dot candidate" />未確認候補
      </span>
    </div>
  );
}
