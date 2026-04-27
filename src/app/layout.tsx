import "./globals.css";
import type { Metadata } from "next";
import { ensureBootstrap } from "@/server/bootstrap";

export const metadata: Metadata = {
  title: "Donatelko",
  description: "Платформа донатів для стрімера: UAH, CryptoBOT, TonPay",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await ensureBootstrap();
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
