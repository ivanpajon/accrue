import type { Metadata } from "next";
import "./globals.css";
import "./preferences.css";
import { preferenceBootstrap } from "@/lib/preferences";

export const metadata: Metadata = {
  title: "Compound — Compound interest calculator",
  description: "Explore investment growth with flexible contribution phases, interactive charts, and a year-by-year projection.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: preferenceBootstrap }} /></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
