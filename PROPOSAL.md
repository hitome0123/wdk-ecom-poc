# WDK in eCommerce — formal proposal

Submitted to the Tether developer grant program, bounty
[`WDK in eCommerce` (3,000 USDT)](https://tether.dev/grants/bounties/2800541093).

This document is the M1 deliverable. It states the problem, the chosen
platform, the architecture, the milestone plan, and the integration
strategy for two of the largest eCommerce backends in the world
(Shopify and WooCommerce). A working pre-M1 walking skeleton already
exists at
[`github.com/hitome0123/wdk-ecom-poc`](https://github.com/hitome0123/wdk-ecom-poc)
with end-to-end demo evidence on Sepolia.

---

## 1. Problem statement

Most merchants who want to accept USDT today are forced to choose between
two unappealing options:

1. **Custodial gateways** (BitPay, NowPayments, Coinbase Commerce) — the
   merchant gives up self-custody, pays processing fees, and inherits
   counterparty risk on funds in transit. Many small merchants are
   blocked from the gateway entirely for geographic or KYB reasons.
2. **Manual on-chain transfers** — the merchant publishes an address,
   the buyer copies and pastes, the merchant reconciles by hand.
   Conversion rate collapses, fraud is common, refunds are painful.

The bounty asks for an integration that lets merchants accept USDT,
BTC, or other tokens **without giving up self-custody and without
requiring deep blockchain expertise from either side of the
transaction**. WDK is the right primitive for this because it bundles
seed/account management, transaction signing, and indexer-backed
confirmation in one cohesive SDK — exactly the three pieces a payment
gateway has to glue together.

## 2. Chosen platform

**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind + viem.
**Network for the demo:** Sepolia testnet USDT, with Polygon mainnet
USDT as the smoke-test target for M3.

**Why Next.js headless instead of building inside Shopify/WooCommerce
directly:**

- The same core can be wrapped as a Shopify embedded app, a
  WooCommerce gateway plugin, a BigCommerce single-click app, or a
  drop-in script tag for a custom storefront. All four wrappers share
  one code path for wallet, signing, and indexer; only the merchant
  install UI and the order-bridge differ. This is the same separation
  Stripe Checkout uses internally.
- App Router route handlers map naturally onto the three responsibilities
  of a payment gateway: `POST /api/orders` (intent), `POST /api/pay`
  (signing surface for M2 Web Worker), `GET /api/orders/:id/stream`
  (indexer push). Each handler can be redeployed independently on the
  edge or in a Node region depending on latency needs.
- TypeScript surfaces WDK's types at the API boundary so merchant
  engineers get autocomplete instead of reading docs.
- Tailwind keeps the embedded checkout widget under 10 kB of CSS so it
  drops into any storefront theme without fighting cascade.

**Why Sepolia for the demo:** the Tether USDT test contract is widely
available on Sepolia, public RPCs are stable, faucets work without
KYC. The WDK Indexer API supports Sepolia natively. Polygon Amoy was
considered as a secondary testnet but its faucets are flakier and the
USDT test contract is harder to reach for a reviewer with no prior
setup.

## 3. Architecture

```
buyer browser                  Next.js server                chain
─────────────                  ──────────────                ─────
storefront ─ POST /api/orders ─▶  orders.ts (in-mem → Postgres in M2)
checkout   ─ POST /api/wallet/new ─▶  WDK.getRandomSeedPhrase
           ◀──── seed + address ──────
           ─ POST /api/pay ──────▶  WDK transferToken ──────▶ Sepolia
                                                                │
receipt    ─ GET /api/orders/:id/stream (SSE) ◀── WDK Indexer ◀┘
                                              (or RPC fallback)
```

The key design choice is that the **indexer/SSE confirmation path is
key-free**: it never sees a seed phrase, never signs a transaction,
only watches the chain. That means when M2 moves seed handling into a
browser-only Web Worker, the indexer layer stays exactly as it is. The
two endpoints that touch the seed (`/api/wallet/new`, `/api/pay`) are
scoped specifically so the migration is a one-file change per route,
not a refactor.

A reference implementation of every box above is already running and
reproducible — see the
[Live demo evidence](https://github.com/hitome0123/wdk-ecom-poc#live-demo-evidence-sepolia)
section of the repo README.

## 4. Milestone plan

| Milestone | Share | Deliverables |
|-----------|-------|--------------|
| **M1 — Proposal & Platform Selection** | 20% | This document; the public repo (already live); the architecture diagram; the integration design for Shopify and WooCommerce (sections 6 and 7 below). |
| **M2 — Core Payment Flow** | 40% | Browser-only key generation in a Web Worker; WDK-signed transfers from the browser, never on the server; Postgres-backed order persistence with idempotency keys; configurable confirmation thresholds per merchant; signed webhook payloads for order events. |
| **M3 — Final Delivery** | 40% | A Shopify embedded app and a WooCommerce gateway plugin that re-use the M2 core; a non-technical merchant setup guide; a 3-minute demo video showing a buyer paying with USDT and the merchant seeing it land in their wallet; transaction smoke tests on Sepolia and Polygon mainnet. |

I will publish weekly progress notes against the repo so the Tether
team can track status without scheduling sync calls.

## 5. Trust and self-custody contract

Three commitments the merchant gets:

- **No seed is ever sent to the merchant server in M2 onward.** The
  current snapshot generates the seed server-side for fast iteration
  and is labelled accordingly in the README. M2 makes this physically
  impossible by running WDK inside a sandboxed Web Worker that has no
  network access except `postMessage` to the parent frame.
- **The merchant can run the indexer themselves.** The PoC ships with
  both the WDK Indexer API integration and a public-RPC fallback via
  viem, so merchants who do not want to depend on Tether's infrastructure
  can replace one constant and keep running.
- **The buyer never trusts the merchant page.** The Web Worker is
  pinned to a specific WDK build hash; the merchant page can never
  inject code into it. (Implementation detail in M2: subresource
  integrity hash + content-security-policy.)

## 6. Shopify integration design

See [`docs/integration-shopify.md`](docs/integration-shopify.md) for
the architecture sketch. Headline summary: a Shopify embedded app
plus a Custom Checkout UI extension. The extension renders the WDK
checkout widget inside Shopify's checkout iframe; the embedded app
handles install, scopes, and the `orders/create` webhook that bridges
Shopify's order ID to our `POST /api/orders`.

## 7. WooCommerce integration design

See [`docs/integration-woocommerce.md`](docs/integration-woocommerce.md).
Headline summary: a WordPress plugin that registers a
`WC_Payment_Gateway` subclass. The gateway's `payment_fields()`
embeds the WDK widget, `process_payment()` polls the indexer-backed
order status, and a WP-cron task reconciles webhook drops.

## 8. Open-source commitment

The reference implementation, the Shopify app, the WooCommerce
plugin, and any extracted core package will all be released under the
**MIT license** on a public GitHub organization owned by the
applicant. License terms will be re-confirmed with the Tether team
before M1 sign-off in case the bounty agreement prefers Apache-2.0 or
similar.

## 9. About the applicant

Independent AI/automation engineer based in mainland China. Active
projects include cross-border eCommerce automation (Shopee Brazil
listing RPA, Mango × Ozon procurement agent), a Futu OpenD-backed
trading toolkit, and a Telegram-bridged Claude Code remote control
setup. Comfortable with the kind of native-binding gotchas WDK ships
with — already solved the webpack externalization for
`sodium-native` / `bare-*` packages in this PoC (see
`next.config.mjs`).

**Contact:** filled into the application form alongside this proposal.

---

_This document is versioned alongside the repo. Latest revision:
2026-05-13._
