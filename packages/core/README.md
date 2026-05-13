# `@wdk-commerce/core` — extracted SDK design

> **Status:** design doc only. Code lives in `src/lib/` and
> `src/app/api/` today; this README sketches the M2 extraction so the
> Shopify embedded app and the WooCommerce plugin (M3) both consume one
> implementation instead of duplicating logic.

## Why a separate package

The current PoC keeps everything inside the Next.js app for fast
iteration. That works for M1. But M3 needs the same payment logic
running inside:

1. A Shopify Checkout UI Extension (bundled with
   `@shopify/checkout-ui-extensions-react`, no Next.js runtime).
2. A WooCommerce gateway plugin's checkout iframe (served as a static
   bundle from a CDN, mounted by PHP).
3. A "drop-in script tag" for custom storefronts (vanilla TS, no
   framework).

Three consumers, one payment surface. Either we copy-paste, or we
extract — extraction wins because the on-chain semantics
(amount-in-base-units, confirmation thresholds, indexer ↔ RPC
fallback) must be byte-for-byte identical across consumers.

## Target file layout

```
packages/core/
├── package.json          # name: "@wdk-commerce/core", peer: @tetherto/wdk*
├── tsconfig.json
├── README.md             # this file
└── src/
    ├── index.ts          # public surface (re-exports below)
    ├── chain.ts          # network config types + defaults (moved from src/lib)
    ├── pay.ts            # buildAndSendTransfer(seed, order)
    ├── wallet.ts         # createWallet() / restoreWallet(seed)
    ├── indexer.ts        # waitForFinalization(txHash, threshold)
    ├── orders.ts         # PaymentIntent / PaymentStatus types (no storage)
    └── events.ts         # signed webhook payload helpers
```

The Next.js app shrinks accordingly:

```
src/lib/
├── catalog.ts            # demo-only, stays in the app
└── order-store.ts        # Postgres adapter, app-specific
src/app/api/
├── orders/route.ts       # thin wrapper: calls @wdk-commerce/core
├── wallet/new/route.ts   # (M2: deleted — wallet generation moves to Web Worker)
├── pay/route.ts          # (M2: deleted — signing moves to Web Worker)
└── orders/[id]/stream/route.ts  # SSE wrapper around core indexer.ts
```

## Public API surface (illustrative)

```ts
// packages/core/src/index.ts
export { CHAIN, toBaseUnits, type ChainConfig } from "./chain";
export { createWallet, restoreWallet, type Wallet } from "./wallet";
export { buildAndSendTransfer, type TransferRequest } from "./pay";
export {
  waitForFinalization,
  subscribeStatus,
  type PaymentStatus
} from "./indexer";
export {
  signWebhook,
  verifyWebhook,
  type PaidEvent
} from "./events";
```

### Worked example — Shopify checkout extension

```ts
import {
  createWallet,
  buildAndSendTransfer,
  subscribeStatus,
  toBaseUnits
} from "@wdk-commerce/core";

const wallet = await createWallet();         // browser Web Worker
const { txHash } = await buildAndSendTransfer(wallet, {
  token: "USDT",
  recipient: merchantAddress,
  amount: toBaseUnits("12.50")
});
for await (const status of subscribeStatus(txHash, { confirmations: 3 })) {
  if (status === "finalized") {
    shopify.checkout.complete();             // back to Shopify SDK
  }
}
```

The identical four-line call works inside the WooCommerce iframe and
the script-tag bundle. Only `merchantAddress` differs (read from the
embedded config the host page injects via `postMessage`).

## What stays out of the core package

- **Catalog / product data** — every consumer has its own (Shopify
  `Storefront.product`, WooCommerce `WC_Product`, custom JSON).
- **Order storage** — Shopify stores it in Shopify, WooCommerce in
  `wp_posts`, our reference app in Postgres. The core package only
  defines the `PaymentIntent` shape so all three can map to it.
- **Authentication / merchant install** — each platform's OAuth is
  different; lives in the host wrapper.
- **UI** — buttons, copy, layout all belong to the consumer.

## Migration plan (M2)

1. **Move first, refactor second.** Copy `src/lib/{chain,indexer}.ts`
   verbatim into `packages/core/src/`. Update Next.js app to import
   from `@wdk-commerce/core` via a workspace alias. CI stays green.
2. **Lift the seed-touching code into the Worker boundary.** The
   current `/api/pay/route.ts` becomes `buildAndSendTransfer()` in
   `pay.ts`, called from the browser Worker. The Next.js route is
   deleted in the same PR — there's no compatibility shim because the
   server should never see a seed again.
3. **Add `signWebhook` / `verifyWebhook`.** Shopify and WooCommerce
   both need this; building it once in core means the two host
   wrappers cannot disagree on the signature scheme (HMAC-SHA256 over
   `${timestamp}.${body}` with a per-merchant secret).
4. **Pin the worker bundle hash.** The published package emits a
   `worker.bundle.js` whose SHA-384 is committed alongside it. Both
   host wrappers load it with `<script integrity="sha384-...">` so a
   compromised host page cannot inject code into the signing path.
5. **Publish to npm under `@wdk-commerce/core`**, MIT licensed, with
   `engines.node >= 18` and a browser entry point. Versioning follows
   the same semver as `@tetherto/wdk` to make peer-dep upgrades
   obvious.

## Open questions for M2 review

- **Bundle size budget.** WDK + viem + the worker glue currently
  weighs ~280 KB minified. Shopify's checkout extensions budget is
  100 KB per extension. We will need a slim WDK build or lazy-load the
  signer chunk; needs measurement before locking the design.
- **Confirmation threshold defaults.** Sepolia uses 3 blocks today.
  Polygon mainnet (M3 smoke test target) finalises differently —
  `subscribeStatus()` should accept a chain-aware default rather than
  a single constant.
- **Token-agnosticism.** The current code is USDT-only by string
  identifier. M3 may want USDC and BTC; the `TransferRequest` shape
  should already accept `{ token: "USDT" | "USDC" | "BTC", ... }` so
  M3 doesn't need an API break.

## Why publish this README before any extraction code exists

A reviewer reading the M1 deliverable wants to know: _is M2's "core
SDK" a real boundary or a buzzword?_ Sketching the file layout, the
public surface, the migration steps, and the open questions before
writing the code shows there's a concrete plan — and lets the Tether
team flag scope issues now, when changing direction is cheap.
