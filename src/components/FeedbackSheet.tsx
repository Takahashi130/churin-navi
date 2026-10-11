"use client";

import { useState } from "react";
import { clearPasscode, loadPasscode, savePasscode } from "@/lib/stored-passcode";
import PasscodeField from "./PasscodeField";

/** 開発への要望を送る（GitHub Issue になる） */
export default function FeedbackSheet({ context, onClose }: { context: string; onClose: () => void }) {
  const [text, setText] = useState("");
  const [passcode, setPasscode] = useState(() => loadPasscode());
  const [needPasscode, setNeedPasscode] = useState(() => !loadPasscode());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setSending(true);
    setError(undefined);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode, text, context }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearPasscode();
        setNeedPasscode(true);
        throw new Error("合言葉が違います");
      }
      if (!res.ok) throw new Error(json.error ?? `送信に失敗しました（HTTP ${res.status}）`);
      savePasscode(passcode);
      setSent(true);
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="sheet list" aria-label="開発への要望">
      <div className="sheet-head">
        <h2>開発への要望を送る</h2>
        <button className="close" onClick={onClose} aria-label="閉じる">
          ✕
        </button>
      </div>
      {sent ? (
        <>
          <p>送信しました。次に開発を進めるときに確認します。</p>
          <button className="secondary link-btn" onClick={() => setSent(false)}>
            続けて送る
          </button>
        </>
      ) : (
        <>
          <textarea
            className="feedback-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例: ピンが重なって押しにくい／料金の表示を一覧にも出してほしい"
            rows={7}
          />
          {needPasscode && <PasscodeField value={passcode} onChange={setPasscode} />}
          {error && <p className="form-error">{error}</p>}
          <button className="primary big" onClick={submit} disabled={sending || !text.trim() || !passcode}>
            {sending ? "送信中…" : "送信する"}
          </button>
          <p className="note">送った内容は GitHub の公開リポジトリに Issue として残ります。個人情報は書かないでください。</p>
        </>
      )}
    </section>
  );
}
