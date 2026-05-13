# Shopify integration design

This is an architectural sketch for the M3 deliverable. It is not yet
implemented — the goal here is to prove the integration is concretely
designed before any code is written, so reviewers can sanity-check the
plan against Shopify's actual APIs.

## Why an embedded app + checkout extension (and not a Shopify Payments competitor)

Shopify Payments is a regulated card processor; replacing it would
require us to become one of Shopify's certified payment providers, a
multi-month compliance project. We do not need to be a payment
**processor** to accept USDT — we need to be an **alternative payment
method** that sits next to "credit card" and "PayPal" at checkout.

Shopify exposes two surface areas that together cover this use case:

1. **Custom App + App Bridge** — for the merchant install flow, scopes
   request, and store-side configuration (which wallet should receive
   payouts, which currencies, which confirmation threshold).
2. **Checkout UI Extensions** (`purchase.checkout.payment-method-list`
   target) — for rendering a "Pay with USDT" option inside the
   merchant's checkout. This lives inside Shopify's checkout iframe so
   PCI scope stays with Shopify, not us.

## Buyer flow

```
shopper picks "Pay with USDT (WDK)"      Shopify checkout iframe
        │                                       │
        │  Checkout extension renders our       │
        │  embedded React component             │
        ▼                                       ▼
WDK widget (Web Worker)  ─ POST /api/orders ──▶ our Next.js app
   │                                              │
   │  signs USDT transfer locally                 │
   │                                              │
   ▼                                              │
broadcasts to chain     ◀── tx hash returned ─────┘
   │
   ▼
indexer confirms        ──▶ POST /webhooks/shopify/order-paid
                              (we forward to Shopify's Order API,
                               marks the order as paid)
```

Key invariant: **Shopify never sees the seed, the merchant server
never sees the seed, the buyer never copies an address by hand.**

## Merchant install flow

1. Merchant clicks "Add app" on the Shopify App Store listing or via a
   direct install link.
2. Shopify OAuth redirects to our app's `/install/shopify` route. We
   request scopes: `read_orders`, `write_orders`,
   `write_checkout_extension_configurations`.
3. After install, the merchant lands on our embedded admin page where
   they paste their **merchant receiving address** (this is the public
   address — we never ask for a seed) and pick a confirmation
   threshold (1 / 3 / 12 blocks).
4. We register a webhook for `orders/create` so we get notified the
   instant a buyer initiates checkout.
5. We push the checkout extension config so the new payment option
   appears in the merchant's checkout immediately.

## Mapping Shopify constructs to our PoC

| Shopify side | PoC equivalent |
|--------------|-----------------|
| `Checkout.Order.id` | `Order.id` (from `lib/orders.ts`) |
| `Checkout.Order.totalPrice` (in cart currency) | `Order.amountHuman` (converted via merchant-side FX feed) |
| `Checkout.Buyer.email` | logged on `Order` for the merchant's reconciliation |
| Shopify `orders/create` webhook | calls our `POST /api/orders` |
| Our SSE `status` event = `finalized` | triggers `Shopify Order API: mark as paid` |

The `lib/orders.ts` order ledger gets an extra column in M2: a
`platformOrderId` string and a `platformKind: "shopify" | "woocommerce" | "self"`
discriminator. The rest of the schema is unchanged.

## Currency handling

Shopify checkout amounts are denominated in the merchant's
configured presentment currency. At checkout time we:

1. Fetch the merchant's preferred USDT FX source (defaulting to
   CoinGecko spot, with a configurable per-merchant override for
   merchants who want a fixed peg or a Tether-issued reference rate).
2. Convert the line-item subtotal to USDT base units.
3. Quote a 5-minute price lock to the buyer (re-quoted automatically
   if they idle). The quote is signed server-side and stored on the
   order so the buyer cannot tamper with the displayed amount.

## Why this design beats the alternatives

- **Embedding inside the checkout iframe (vs redirecting to our app)**
  keeps abandonment rate low. Shopify's own data shows that any
  redirect during checkout costs 15-30% conversion.
- **Web Worker signing (vs sending the seed back to our server)**
  matches the bounty's self-custody requirement and means we can
  publish the worker bundle with subresource integrity, so the merchant
  page cannot inject malicious code into the signing path.
- **Indexer + RPC fallback (vs polling Shopify)** means the buyer's
  receipt updates within ~4 seconds of finalization instead of waiting
  for Shopify's eventual consistency on payment status.

## What's left for M3 implementation

- Shopify Partner account + app submission (free, ~2 days to approval).
- Checkout UI extension built against
  `@shopify/checkout-ui-extensions-react`.
- Embedded admin built against `@shopify/polaris` + `@shopify/app-bridge`.
- Webhook signature verification middleware.
- Optional: Shopify Functions for cart-level discount triggers when
  paying in USDT (e.g. "2% off for paying in stablecoin").
