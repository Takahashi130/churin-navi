import { createHash, timingSafeEqual } from "node:crypto";

/** 書き込み系 API の合言葉チェック（サーバー専用）。APP_PASSCODE 未設定なら常に拒否 */
export function checkPasscode(input: unknown): boolean {
  const expected = process.env.APP_PASSCODE;
  if (!expected || typeof input !== "string" || input.length === 0) return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
