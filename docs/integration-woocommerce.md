# WooCommerce integration design

Architectural sketch for the M3 deliverable. Like the Shopify
counterpart, this document is intentionally code-light — the point is
to demonstrate the integration is concretely planned, not to ship the
plugin before M2 is approved.

## Why a WC_Payment_Gateway plugin (and not a custom checkout block)

WooCommerce treats payment options through a stable abstraction:
**every payment method is a class that extends `WC_Payment_Gateway`**.
Stripe, PayPal, and bank transfer all implement the same five hooks.
Implementing our gateway against this contract gives us:

- Automatic placement in the WooCommerce settings UI (`WooCommerce →
  Payments`).
- Built-in compatibility with the Classic checkout, the Blocks-based
  checkout, and the new Cart and Checkout blocks (because all three
  call `WC_Payment_Gateways::get_available_payment_gateways()`).
- Free integration with order-level features merchants already use:
  refund flows, partial captures, subscription renewals (via
  WooCommerce Subscriptions).
- A familiar code shape so any WordPress developer can audit the
  plugin without learning a new framework.

## Plugin structure

```
wdk-commerce-woocommerce/
├── wdk-commerce.php              # bootstrap, hooks init_payment_gateways
├── includes/
│   ├── class-wdk-gateway.php     # extends WC_Payment_Gateway
│   ├── class-wdk-order-bridge.php # talks to our Next.js /api
│   ├── class-wdk-webhook.php     # verifies signed events
│   └── class-wdk-cron.php        # reconciles missed webhooks every 5 min
├── assets/
│   └── checkout.js               # mounts the WDK widget on the buyer page
└── readme.txt                    # standard WP plugin manifest
```

## Buyer flow

```
shopper clicks "Place order"           WordPress / WooCommerce
        │                                       │
        │  WC_Payment_Gateway::process_payment  │
        │  returns a redirect URL to our        │
        │  embedded receipt page                ▼
        │                              order saved as on-hold
        ▼
WDK widget (Web Worker, iframe)
   │
   │  signs USDT transfer locally
   ▼
broadcasts to chain
   │
   ▼
indexer confirms    ──▶ POST /webhooks/woocommerce/wdk-paid
                          │
                          ▼
                   $order->payment_complete($txHash)
```

The shopper never leaves the merchant's domain — the embedded widget
runs inside a sandboxed iframe served from our app, with `postMessage`
as the only communication channel.

## Merchant install flow

1. Merchant uploads the plugin zip via `wp-admin → Plugins → Add New`,
   or installs from the WordPress.org repository in M3.
2. After activation, a settings page appears under WooCommerce →
   Payments → "Self-custodial USDT (WDK)".
3. The merchant pastes their **receiving address** (public address
   only), picks a confirmation threshold, and saves. The plugin
   registers a webhook secret with our Next.js app via a one-time
   API call (the secret is rotated automatically every 30 days).
4. WooCommerce checkout now shows the new payment method
   automatically; no theme changes required for the Classic checkout,
   and a Blocks-compatible registration entry covers the new
   block-based checkout.

## Key code shape (illustrative, not final)

```php
class WDK_Gateway extends WC_Payment_Gateway {
    public function __construct() {
        $this->id                 = 'wdk_usdt';
        $this->method_title       = __( 'Self-custodial USDT (WDK)', 'wdk' );
        $this->supports           = array( 'products', 'refunds' );
        $this->init_form_fields();
        $this->init_settings();
        add_action( 'woocommerce_update_options_payment_gateways_' . $this->id,
                    array( $this, 'process_admin_options' ) );
    }

    public function payment_fields() {
        // Renders an iframe pointing to /checkout/{wc_order_id} on our app.
        // The iframe loads the WDK Web Worker bundle and signs locally.
    }

    public function process_payment( $order_id ) {
        $order = wc_get_order( $order_id );
        $order->update_status( 'on-hold',
            __( 'Awaiting USDT confirmation.', 'wdk' ) );

        return array(
            'result'   => 'success',
            'redirect' => add_query_arg(
                'wdk_order', $order_id,
                $this->get_return_url( $order )
            )
        );
    }
}
```

The actual finalisation (status `on-hold` → `processing`) happens in
the webhook handler, not in `process_payment()` itself — so even if
the buyer closes the tab, the order eventually completes once the tx
finalises on-chain.

## Mapping WooCommerce constructs to our PoC

| WooCommerce side | PoC equivalent |
|-------------------|-----------------|
| `$order->get_id()` | `Order.platformOrderId` |
| `$order->get_total()` | quoted via merchant FX feed → `Order.amountHuman` |
| `$order->update_status('on-hold')` | `Order.status = 'awaiting_payment'` |
| `$order->payment_complete($tx)` | `Order.status = 'finalized'` + `txHash` |
| WP-cron `wdk_reconcile` | re-fetches `Order.status` from our SSE / indexer |

## Why this design beats the alternatives

- **Plugin + WP-cron reconciliation (vs polling from the merchant
  browser)** survives the buyer closing the tab. WooCommerce's reality
  is that half of buyers abandon the receipt page before the chain
  confirms; reconciliation has to be server-driven.
- **Iframe-embedded Web Worker (vs raw script on the merchant theme)**
  isolates the signing surface from theme XSS, ad scripts, and
  Elementor plugins. A self-custody guarantee that breaks because the
  merchant installed a sketchy social-feed plugin would be worthless.
- **WC_Payment_Gateway extension (vs custom checkout block only)**
  ensures compatibility with the long tail of WooCommerce installs
  still using the Classic checkout — that's still ~60% of stores as of
  2025.

## What's left for M3 implementation

- WordPress.org plugin submission (free, ~2-3 weeks to review).
- Blocks-based registration via
  `@woocommerce/blocks-registry` so the gateway shows up in the new
  block-based checkout.
- Refund handler that calls our `/api/refunds` (M3 only — the buyer
  must consent client-side because we cannot move funds out of their
  wallet).
- WooCommerce Subscriptions adapter for recurring USDT payments
  (stretch goal, may slide to a follow-up bounty).
