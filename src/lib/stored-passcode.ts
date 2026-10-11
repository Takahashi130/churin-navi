/** 合言葉はこの端末のブラウザにだけ覚えておく（使えない環境では毎回入力） */
const KEY = "churin-navi:passcode";

export function loadPasscode(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function savePasscode(v: string) {
  try {
    localStorage.setItem(KEY, v);
  } catch {}
}

export function clearPasscode() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
