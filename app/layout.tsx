import type { Metadata } from "next";
import { DM_Mono, DM_Serif_Display, Sora, Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AnalyticsRoot } from "@/components/analytics/analytics-root";
import { AppShellProviders } from "@/components/providers/app-shell-providers";
import { buildRootMetadata, GoogleSiteSeo } from "@/components/seo/google-site-seo";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: ["400"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = buildRootMetadata();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={cn("h-full", "antialiased", dmSerif.variable, sora.variable, dmMono.variable, "font-sans", geist.variable)}
    >
      <body className="min-h-full flex flex-col font-sans">
        <GoogleSiteSeo />
        <AnalyticsRoot />
        <AppShellProviders>{children}</AppShellProviders>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="https://unpkg.com/react-grab@0.1.31/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </body>
    </html>
  );
}
