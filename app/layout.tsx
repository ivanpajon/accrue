import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
