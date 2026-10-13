"use client";

import type { MapProps } from "./App";
import BikeGlyph from "./BikeGlyph";
import type { LatLng } from "@/lib/types";

/**
 * デモモード用の簡易「地図」。実際の地図タイルは使わず、検索地点を中心に
 * 方角と直線距離の関係だけを描く（API キーがなくても画面の動きを確認するため）。
 */
const SIZE = 1000;

export default function DemoMapView({ userPos, searchCenter, radius, facilities, selectedId, pending, onSelect, onMapClick }: MapProps) {
  const center = searchCenter ?? userPos ?? { lat: 35.6896, lng: 139.7006 };
  const scale = (SIZE * 0.4) / Math.max(radius, 500); // px per m
  const mLat = 111_320;
  const mLng = 111_320 * Math.cos((center.lat * Math.PI) / 180);
  const toXY = (p: LatLng) => ({
    x: SIZE / 2 + (p.lng - center.lng) * mLng * scale,
    y: SIZE / 2 - (p.lat - center.lat) * mLat * scale,
  });

  return (
    <svg
      className="demo-map"
      viewBox={`0 -150 ${SIZE} ${SIZE + 300}`}
      preserveAspectRatio="xMidYMid meet"
      onClick={(e) => {
        const svg = e.currentTarget;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const m = svg.getScreenCTM();
        if (!m) return;
        const p = pt.matrixTransform(m.inverse());
        onMapClick({
          lat: center.lat - (p.y - SIZE / 2) / scale / mLat,
          lng: center.lng + (p.x - SIZE / 2) / scale / mLng,
        });
      }}
    >
      <defs>
        <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M 50 0 L 0 0 0 50" fill="none" stroke="var(--grid)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="-3000" y="-3000" width="7000" height="7000" fill="url(#grid)" />
      {searchCenter && <circle cx={SIZE / 2} cy={SIZE / 2} r={radius * scale} fill="rgba(26,115,232,0.06)" stroke="#1a73e8" strokeWidth="3" />}
      <text x={SIZE / 2} y={60} textAnchor="middle" className="demo-north">
        ↑ 北
      </text>
      {searchCenter && (
        <text x={SIZE / 2} y={SIZE / 2} textAnchor="middle" dominantBaseline="central" fontSize="34" fontWeight="800" fill="#b3261e">
          ✕
        </text>
      )}
      {userPos && (() => {
        const { x, y } = toXY(userPos);
        return <circle cx={x} cy={y} r={16} fill="#1a73e8" stroke="#fff" strokeWidth="5" />;
      })()}
      {pending && (() => {
        const { x, y } = toXY(pending);
        return <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="40">📍</text>;
      })()}
      {facilities.map((f) => {
        const { x, y } = toXY(f.location);
        const sel = f.id === selectedId;
        return (
          <g
            key={f.id}
            transform={`translate(${x} ${y})`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(f.id);
            }}
            style={{ cursor: "pointer" }}
          >
            <circle r={sel ? 34 : 26} className={`demo-pin ${f.tier}`} />
            {f.tier === "bicycle" ? (
              <g transform="translate(-16 -16)" color="#fff">
                <BikeGlyph size={32} />
              </g>
            ) : (
              <text textAnchor="middle" dominantBaseline="central" fill={f.tier === "candidate" ? "#3d2c00" : "#fff"} fontSize="28" fontWeight="700">
                {f.tier === "verified" ? "✓" : "?"}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
