import { NextResponse, type NextRequest } from "next/server";
import { checkPasscode } from "@/lib/passcode.ts";
import { getJsonFile, putJsonFile } from "@/lib/github.ts";
import { parseVerifyRequest, upsertEntry, RESULT_LABELS } from "@/lib/verify-entry.ts";
import type { VerifiedEntry } from "@/lib/merge.ts";

export const dynamic = "force-dynamic";

const PATH = "src/data/verified.json";

/**
 * 現地で確認した結果を src/data/verified.json に書き込む（GitHub にコミット）。
 * main への push で Vercel が再デプロイし、1分ほどで全端末に反映される。
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!checkPasscode(body?.passcode)) {
    return NextResponse.json({ error: "合言葉が違います" }, { status: 401 });
  }
  const parsed = parseVerifyRequest(body);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

  try {
    // 同時に書き込まれて sha が古くなった場合（409）だけ1回やり直す
    for (let attempt = 0; ; attempt++) {
      const { data, sha } = await getJsonFile<VerifiedEntry[]>(PATH);
      const { list, entry } = upsertEntry(data, parsed);
      try {
        await putJsonFile(PATH, list, sha, `確認済みデータ: ${entry.name} を「${RESULT_LABELS[parsed.result]}」で登録（アプリから）`);
        return NextResponse.json({ ok: true, entry });
      } catch (e) {
        if ((e as { status?: number }).status === 409 && attempt === 0) continue;
        throw e;
      }
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
