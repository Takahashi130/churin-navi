import App from "@/components/App";

export default async function Page({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const { demo } = await searchParams;
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || undefined;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID";
  // ブラウザ用キーが無ければ地図を出せないので、明示的なデモモードにする
  return <App mapsKey={mapsKey} mapId={mapId} demo={!mapsKey || demo === "1"} />;
}
