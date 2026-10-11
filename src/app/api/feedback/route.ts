import { NextResponse, type NextRequest } from "next/server";
import { checkPasscode } from "@/lib/passcode.ts";
import { createIssue } from "@/lib/github.ts";

export const dynamic = "force-dynamic";

/** 開発への要望を GitHub Issue（ラベル「要望」）として登録する */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!checkPasscode(body?.passcode)) {
    return NextResponse.json({ error: "合言葉が違います" }, { status: 401 });
  }
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 4000) : "";
  if (!text) return NextResponse.json({ error: "要望を入力してください" }, { status: 400 });
  const context = typeof body?.context === "string" ? body.context.slice(0, 200) : "";

  const firstLine = text.split("\n")[0].slice(0, 50);
  const sentAt = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 16).replace("T", " ");
  const issueBody = `${text}\n\n---\nアプリから送信（${sentAt} JST）${context ? `\n画面: ${context}` : ""}`;
  try {
    const url = await createIssue(`[要望] ${firstLine}`, issueBody, ["要望"]);
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
