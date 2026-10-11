import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const NAME_RE = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

/**
 * Place Photos (New)。API キーをブラウザに出さないためサーバー経由で photoUri を取り、
 * そこへリダイレクトする。写真名・画像はキャッシュしない（規約上キャッシュ不可）。
 */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") ?? "";
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY が未設定" }, { status: 503 });
  if (!NAME_RE.test(name)) return NextResponse.json({ error: "name が不正です" }, { status: 400 });

  const url = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=800&skipHttpRedirect=true&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ error: `Places Photo HTTP ${res.status}` }, { status: 502 });
  const { photoUri } = (await res.json()) as { photoUri?: string };
  if (!photoUri) return NextResponse.json({ error: "photoUri がありません" }, { status: 502 });
  return NextResponse.redirect(photoUri, { status: 302, headers: { "Cache-Control": "no-store" } });
}
