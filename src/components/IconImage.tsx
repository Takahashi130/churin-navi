/** PWA アイコン（ImageResponse 用の JSX）。src/app/icon.svg と同じ図柄: 緑地に白い自転車 */
export function iconJsx(size: number) {
  const s = size * 0.8;
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "#188038",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={s} height={s} viewBox="0 0 64 64">
        <g transform="translate(0 -3)" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="17" cy="41" r="9" />
          <circle cx="47" cy="41" r="9" />
          <path d="M17 41 L25 26 L42 26 M25 26 L30 41 L17 41 M30 41 L42 26 L47 41 M25 26 L24 21 M20 21 H28 M39 19 L42 26 M37 19 H43" />
        </g>
      </svg>
    </div>
  );
}
