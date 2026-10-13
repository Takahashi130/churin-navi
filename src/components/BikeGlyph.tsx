/** 地図ピン用の小さな自転車マーク（アプリアイコンと同じ図柄。小さく表示するので線を太めに） */
export default function BikeGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="4 10 56 48" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="17" cy="41" r="10" />
        <circle cx="47" cy="41" r="10" />
        <path d="M17 41 L25 26 L42 26 M25 26 L30 41 L17 41 M30 41 L42 26 L47 41 M20 20 H29 M37 19 H44" />
      </g>
    </svg>
  );
}
