import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EnglishMaster",
  description: "查詢英文單字、片語或整句：釋義、例句、翻譯與美式發音",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
