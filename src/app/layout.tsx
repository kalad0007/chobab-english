import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import TopLoader from "@/components/ui/TopLoader";
import ServiceWorkerRegister from "@/components/ui/ServiceWorkerRegister";

export const viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "에듀원 TOEFL",
  description: "TOEFL iBT 대비 학습 플랫폼",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "에듀원TOEFL",
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
      <body className={`${geist.className} min-h-full antialiased`} suppressHydrationWarning>
        <TopLoader />
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
