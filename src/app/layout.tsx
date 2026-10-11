import type { Metadata, Viewport } from "next";
import "./globals.css";
import SwRegister from "@/components/SwRegister";

export const metadata: Metadata = {
  title: "ちかくの駐輪場",
  description: "現在地の近くで自転車を一時利用できる駐輪場を探す（自分用）",
  appleWebApp: { capable: true, title: "駐輪場", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1a73e8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
