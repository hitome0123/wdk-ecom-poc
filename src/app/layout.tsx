import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "WDK Commerce — Self-custodial checkout reference",
  description:
    "Reference implementation showing how WDK powers headless commerce checkout with USDT settlement."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <a href="/" className="font-semibold tracking-tight">
              WDK Commerce
            </a>
            <span className="text-xs uppercase tracking-widest text-neutral-500">
              Tether grant PoC · Sepolia testnet
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        <footer className="mx-auto max-w-5xl px-6 py-8 text-xs text-neutral-500">
          Reference implementation for the &quot;WDK in eCommerce&quot; bounty ·
          USDT settlement on Sepolia · self-custodial · stateless server.
        </footer>
      </body>
    </html>
  );
}
