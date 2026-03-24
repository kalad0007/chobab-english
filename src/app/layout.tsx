import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import TopLoader from "@/components/ui/TopLoader";
import ServiceWorkerRegister from "@/components/ui/ServiceWorkerRegister";

export const viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "초밥샘의 영어공부",
  description: "중고등학교 영어 교육 및 모의고사 플랫폼",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "초밥샘영어",
  },
  icons: {
    icon: "/icons/icon-32x32.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className={`${geist.className} min-h-full antialiased`}>
        <TopLoader />
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
