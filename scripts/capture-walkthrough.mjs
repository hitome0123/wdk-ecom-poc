// Programmatic walkthrough capture for README.
//
// Drives a real browser through storefront → checkout → wallet
// generation, intercepts /api/wallet/new and /api/pay so the funded
// buyer wallet is used (lets us record a real on-chain success instead
// of a fresh-but-unfunded wallet), and writes four PNGs into
// docs/walkthrough/.
//
// Usage:
//   BUYER_SEED="twelve words ..." \
//   BUYER_TX=0x8d1b...                 # optional, reuses a real tx
//   node scripts/capture-walkthrough.mjs

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const SERVER = "http://localhost:3000";
const OUT = "docs/walkthrough";
const SEED = process.env.BUYER_SEED;
const ADDRESS = "0x9D14899c140aa5f1DEB09F37066D96263107727a";
const REUSE_TX = process.env.BUYER_TX;

if (!SEED) { console.error("Set BUYER_SEED."); process.exit(1); }

await mkdir(OUT, { recursive: true });

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// Intercept /api/wallet/new so the checkout flow uses our funded wallet.
await page.route("**/api/wallet/new", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ seedPhrase: SEED, address: ADDRESS })
  });
});

// 1) Storefront
await page.goto(SERVER, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/01-storefront.png`, fullPage: false });

// 2) Checkout intro
await page.locator("a[href^='/checkout/']").first().click();
await page.waitForSelector("button:has-text('Generate self-custodial wallet')");
await page.screenshot({ path: `${OUT}/02-checkout-intro.png` });

// 3) Wallet generated
await page.locator("button:has-text('Generate self-custodial wallet')").click();
await page.waitForSelector("button:has-text('Sign & pay')");
await page.screenshot({ path: `${OUT}/03-wallet-ready.png` });

// 4) Receipt (real on-chain payment OR reuse an existing tx hash)
if (REUSE_TX) {
  // Skip clicking pay; jump straight to a fresh order page seeded with REUSE_TX
  const orderRes = await page.evaluate(async () => {
    const r = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId: "tee-001" })
    });
    return r.json();
  });
  await page.goto(`${SERVER}/receipt/${orderRes.id}?tx=${REUSE_TX}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500); // let SSE push at least one event
} else {
  await page.locator("button:has-text('Sign & pay')").click();
  await page.waitForURL(/\/receipt\//, { timeout: 60_000 });
  await page.waitForTimeout(3000); // settle SSE state
}
await page.screenshot({ path: `${OUT}/04-receipt.png` });

await browser.close();
console.log(`Wrote 4 PNGs into ${OUT}/`);
