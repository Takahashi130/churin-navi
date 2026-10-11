/** PWA アイコン（ImageResponse 用の JSX） */
export function iconJsx(size: number) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "#1a73e8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: size * 0.58,
        fontWeight: 700,
        fontFamily: "sans-serif",
      }}
    >
      P
    </div>
  );
}
