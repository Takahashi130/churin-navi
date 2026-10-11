import type { Tier } from "@/lib/types";

const LABELS: Record<Tier, string> = {
  verified: "自転車・一時利用 確認済み",
  bicycle: "自転車用（一時利用は未確認）",
  candidate: "未確認候補（自転車対応・一時利用とも不明）",
};

export default function TierBadge({ tier }: { tier: Tier }) {
  return <span className={`badge ${tier}`}>{LABELS[tier]}</span>;
}
