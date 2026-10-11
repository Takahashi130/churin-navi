import { ImageResponse } from "next/og";
import { iconJsx } from "@/components/IconImage";

export const dynamic = "force-static";
export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }];
}

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const n = size === "512" ? 512 : 192;
  return new ImageResponse(iconJsx(n), { width: n, height: n });
}
