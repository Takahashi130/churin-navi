"use client";

/** 合言葉の入力欄。一度通ればこの端末に保存されるので、次回からは表示しない */
export default function PasscodeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span>合言葉（初回のみ）</span>
      <input type="password" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
