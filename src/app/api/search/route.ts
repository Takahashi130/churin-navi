import { NextResponse, type NextRequest } from "next/server";
import { searchOsm } from "@/lib/osm.ts";
import { searchGoogle } from "@/lib/google.ts";
import { mergeFacilities } from "@/lib/merge.ts";
import { loadVerified } from "@/lib/verified.ts";
import type { Facility, SearchResponse } from "@/lib/types.ts";

export const dynamic = "force-dynamic";

const ALLOWED_RADII = [500, 1000, 2000];

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const radiusM = Number(sp.get("r") ?? 500);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "lat/lng が不正です" }, { status: 400 });
  }
  if (!ALLOWED_RADII.includes(radiusM)) {
    return NextResponse.json({ error: "r は 500/1000/2000 のいずれか" }, { status: 400 });
  }
  const center = { lat, lng };
  const notices: string[] = [];
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  const [osmRes, googleRes] = await Promise.allSettled([
    searchOsm(center, radiusM),
    apiKey ? searchGoogle(center, radiusM, apiKey) : Promise.reject(new Error("GOOGLE_PLACES_API_KEY が未設定")),
  ]);

  const osm: Facility[] = osmRes.status === "fulfilled" ? osmRes.value : [];
  const google = googleRes.status === "fulfilled" ? googleRes.value : undefined;
  const verified = loadVerified();
  const merged = mergeFacilities(center, radiusM, osm, google?.facilities ?? [], verified);

  if (osmRes.status === "rejected") {
    notices.push("OpenStreetMap の取得に失敗したため、自転車用と判別できる施設が表示されていない可能性があります。再検索してください。");
  }
  if (google?.truncated) {
    notices.push("Google の検索結果が上限に達しました。範囲内のすべての候補ではありません。");
  }
  if (merged.verifiedCount === 0) {
    notices.push("この範囲には「一時利用 確認済み」の登録データがありません（青ピンは一時利用が未確認です）。");
  }

  const body: SearchResponse = {
    center,
    radiusM,
    facilities: merged.facilities,
    status: {
      osm:
        osmRes.status === "fulfilled"
          ? { ok: true, count: osm.length }
          : { ok: false, count: 0, message: (osmRes.reason as Error).message },
      google: google
        ? {
            ok: true,
            count: google.facilities.length,
            message: `リクエスト${google.requests}回／駐車場以外の type ${google.droppedNonParking}件を除外`,
          }
        : { ok: false, count: 0, message: (googleRes as PromiseRejectedResult).reason?.message },
      verified: { ok: true, count: merged.verifiedCount },
    },
    notices,
    demo: false,
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
