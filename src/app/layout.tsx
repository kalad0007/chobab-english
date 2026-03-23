import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "초밥샘의 영어공부",
  description: "중고등학교 영어 교육 및 모의고사 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className={`${geist.className} min-h-full antialiased`}>{children}</body>
    </html>
  );
}
