import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { QueryProvider } from "@/components/providers/QueryProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "일정 및 매출 관리 시스템",
  description: "스케줄 관리, 매출 추적, 거래처 관리를 위한 통합 시스템",
  icons: {
    icon: [
      { url: '/app-icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/app-icon-64.png', sizes: '64x64', type: 'image/png' },
      { url: '/app-icon-128.png', sizes: '128x128', type: 'image/png' },
      { url: '/app-icon-256.png', sizes: '256x256', type: 'image/png' },
    ],
    apple: [
      { url: '/app-icon-256.png', sizes: '256x256', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* 카카오 주소검색 API */}
        <Script
          src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
          strategy="lazyOnload"
        />
      </head>
      <body
        className="antialiased min-h-screen bg-white font-sans"
      >
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
