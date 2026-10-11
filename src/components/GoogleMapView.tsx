"use client";

import { useEffect, useRef, useState } from "react";
import { APIProvider, AdvancedMarker, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import type { MapProps } from "./App";
import type { LatLng } from "@/lib/types";

const INITIAL_CENTER = { lat: 35.6896, lng: 139.7006 };

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

export default function GoogleMapView(props: MapProps & { apiKey: string; mapId: string }) {
  const { apiKey, mapId, onMapClick } = props;
  const [authFailed, setAuthFailed] = useState(false);

  // API キーの認証に失敗した時に Maps JS が呼ぶ公式フック。地図だけ外して、一覧と経路は使えるようにする
  useEffect(() => {
    window.gm_authFailure = () => setAuthFailed(true);
    return () => {
      delete window.gm_authFailure;
    };
  }, []);

  if (authFailed) {
    return (
      <div className="map-failed" role="alert">
        <p>Google マップを表示できませんでした。</p>
        <p>API キーの設定（Maps JavaScript API の有効化・HTTP リファラ制限）を確認してください。</p>
        <p>「一覧」から駐輪場と経路は確認できます。</p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} language="ja" region="JP">
      <Map
        mapId={mapId}
        defaultCenter={INITIAL_CENTER}
        defaultZoom={16}
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
        style={{ width: "100%", height: "100%" }}
        onClick={(e) => {
          const ll = e.detail.latLng;
          if (ll) onMapClick({ lat: ll.lat, lng: ll.lng });
        }}
      >
        <MapContent {...props} />
      </Map>
    </APIProvider>
  );
}

function MapContent({ userPos, searchCenter, radius, facilities, selectedId, pending, fitKey, panTo, onSelect }: MapProps) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const circleRef = useRef<google.maps.Circle | null>(null);

  // 検索範囲の円
  useEffect(() => {
    if (!map || !mapsLib || !searchCenter) return;
    circleRef.current?.setMap(null);
    circleRef.current = new mapsLib.Circle({
      map,
      center: searchCenter,
      radius,
      strokeColor: "#1a73e8",
      strokeOpacity: 0.6,
      strokeWeight: 2,
      fillColor: "#1a73e8",
      fillOpacity: 0.05,
      clickable: false,
    });
    return () => circleRef.current?.setMap(null);
  }, [map, mapsLib, searchCenter, radius]);

  // 検索のたびに範囲全体が見えるように
  useEffect(() => {
    if (!map || !fitKey || !circleRef.current) return;
    const b = circleRef.current.getBounds();
    if (b) map.fitBounds(b, 24);
  }, [map, fitKey]);

  useEffect(() => {
    if (map && panTo) map.panTo(panTo.pos);
  }, [map, panTo]);

  return (
    <>
      {userPos && (
        <AdvancedMarker position={userPos} zIndex={1000} title="現在地">
          <div className="user-dot" />
        </AdvancedMarker>
      )}
      {searchCenter && !samePos(searchCenter, userPos) && (
        <AdvancedMarker position={searchCenter} zIndex={900} title="検索地点">
          <div className="search-center">✕</div>
        </AdvancedMarker>
      )}
      {pending && (
        <AdvancedMarker position={pending} zIndex={950} title="ここを探す">
          <div className="pending-pin">ここ</div>
        </AdvancedMarker>
      )}
      {facilities.map((f, i) => (
        <AdvancedMarker
          key={f.id}
          position={f.location}
          title={f.name}
          zIndex={f.id === selectedId ? 800 : 500 - i}
          onClick={() => onSelect(f.id)}
        >
          <div className={`pin ${f.tier}${f.id === selectedId ? " selected" : ""}`}>
            <span>{f.tier === "verified" ? "✓" : f.tier === "bicycle" ? "P" : "?"}</span>
          </div>
        </AdvancedMarker>
      ))}
    </>
  );
}

function samePos(a?: LatLng, b?: LatLng) {
  return !!a && !!b && Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7;
}
