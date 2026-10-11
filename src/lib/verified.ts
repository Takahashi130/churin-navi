import data from "../data/verified.json" with { type: "json" };
import type { VerifiedEntry } from "./merge.ts";

export function loadVerified(): VerifiedEntry[] {
  return data as VerifiedEntry[];
}
