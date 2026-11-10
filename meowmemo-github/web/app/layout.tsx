import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Consent } from "@/components/Consent";

export const metadata: Metadata = {
  title: "MeowMemo",
  description: "A journal for your cat's sounds. Record a meow, see what it resembles, and note what was really going on.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef1f6" },
    { media: "(prefers-color-scheme: dark)", color: "#151b2e" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <main className="mx-auto max-w-xl px-5 pb-32 pt-8">{children}</main>
        <Nav />
        <Consent />
      </body>
    </html>
  );
}
