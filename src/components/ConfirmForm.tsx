"use client";

import { useState } from "react";
import type { Facility, Pricing } from "@/lib/types";
import type { VerifyResult } from "@/lib/verify-entry";
import { clearPasscode, loadPasscode, savePasscode } from "@/lib/stored-passcode";
import { UNNAMED } from "@/lib/osm";
import PasscodeField from "./PasscodeField";

const PAYMENTS = ["現金", "交通系IC", "QRコード決済", "クレジットカード"];

const RESULT_CHOICES: [VerifyResult, string][] = [
  ["temporary", "自転車を一時利用できた"],
  ["monthly", "定期・月極専用だった"],
  ["notBicycle", "自転車は停められない／駐輪場ではない"],
];

export type ConfirmedInfo = { result: VerifyResult; pricing?: Pricing; payment?: string[]; checkedAt?: string };

type Props = { facility: Facility; onDone: (info: ConfirmedInfo) => void };

/** 現地で確認した結果を登録するフォーム（確認済みデータへの書き込み） */
export default function ConfirmForm({ facility: f, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<VerifyResult>("temporary");
  const [freeHours, setFreeHours] = useState("");
  const [unitHours, setUnitHours] = useState("");
  const [unitYen, setUnitYen] = useState("");
  const [maxYen, setMaxYen] = useState("");
  const [payment, setPayment] = useState<string[]>([]);
  const [memo, setMemo] = useState("");
  const [passcode, setPasscode] = useState(() => loadPasscode());
  const [needPasscode, setNeedPasscode] = useState(() => !loadPasscode());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  if (!open) {
    return (
      <button className="secondary link-btn" onClick={() => setOpen(true)}>
        {f.tier === "verified" ? "確認内容を修正する" : "現地で確認した結果を登録する"}
      </button>
    );
  }

  const hoursToMin = (v: string) => (v.trim() === "" ? undefined : Math.round(Number(v) * 60));
  const yen = (v: string) => (v.trim() === "" ? undefined : Number(v));

  const submit = async () => {
    setSending(true);
    setError(undefined);
    const pricing: Pricing | undefined =
      result === "temporary"
        ? { freeMinutes: hoursToMin(freeHours), unitMinutes: hoursToMin(unitHours), unitYen: yen(unitYen), maxYen: yen(maxYen) }
        : undefined;
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passcode,
          // Google から借りた仮の名前は保存しない（表示時に毎回 Google から付け直す）
          facility: { id: f.id, name: f.nameFromGoogle || f.provisionalName ? UNNAMED : f.name, location: f.location, googlePlaceId: f.googlePlaceId },
          result,
          pricing,
          payment: result === "temporary" && payment.length ? payment : undefined,
          memo,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearPasscode();
        setNeedPasscode(true);
        throw new Error("合言葉が違います");
      }
      if (!res.ok) throw new Error(json.error ?? `登録に失敗しました（HTTP ${res.status}）`);
      savePasscode(passcode);
      onDone({ result, pricing: json.entry?.pricing, payment: json.entry?.payment, checkedAt: json.entry?.source?.checkedAt });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="form-card">
      <h3>現地で確認した結果</h3>
      <div className="choices" role="radiogroup">
        {RESULT_CHOICES.map(([v, label]) => (
          <label key={v} className={`choice${result === v ? " on" : ""}`}>
            <input type="radio" name="result" checked={result === v} onChange={() => setResult(v)} />
            {label}
          </label>
        ))}
      </div>

      {result === "temporary" && (
        <>
          <p className="form-label">料金（わかる所だけ・任意）</p>
          <div className="price-row">
            最初の
            <input inputMode="decimal" value={freeHours} onChange={(e) => setFreeHours(e.target.value)} />
            時間無料
          </div>
          <div className="price-row">
            その後
            <input inputMode="decimal" value={unitHours} onChange={(e) => setUnitHours(e.target.value)} />
            時間ごとに
            <input inputMode="numeric" value={unitYen} onChange={(e) => setUnitYen(e.target.value)} />円
          </div>
          <div className="price-row">
            上限
            <input inputMode="numeric" value={maxYen} onChange={(e) => setMaxYen(e.target.value)} />円
          </div>
          <p className="form-label">支払方法（任意）</p>
          <div className="pay-row">
            {PAYMENTS.map((p) => (
              <label key={p} className={`choice small${payment.includes(p) ? " on" : ""}`}>
                <input
                  type="checkbox"
                  checked={payment.includes(p)}
                  onChange={(e) => setPayment((cur) => (e.target.checked ? [...cur, p] : cur.filter((x) => x !== p)))}
                />
                {p}
              </label>
            ))}
          </div>
        </>
      )}

      <label className="field">
        <span>メモ（任意）</span>
        <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="例: 入口は北側、ラック式" />
      </label>
      {needPasscode && <PasscodeField value={passcode} onChange={setPasscode} />}
      {error && <p className="form-error">{error}</p>}
      <button className="primary big" onClick={submit} disabled={sending || !passcode}>
        {sending ? "登録中…" : "登録する"}
      </button>
      <button className="secondary link-btn" onClick={() => setOpen(false)} disabled={sending}>
        やめる
      </button>
      <p className="note">登録内容は公開リポジトリの確認済みデータに保存され、1分ほどで全端末に反映されます。</p>
    </div>
  );
}
