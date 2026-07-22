import type { Metadata } from "next";
import { siteMetadata } from "@/content/site-metadata";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = siteMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={fontVariables}
      data-entry-state="loading"
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
