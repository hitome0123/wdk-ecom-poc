// Demo product catalog. In a real merchant integration this comes from
// Shopify/Woo/headless API. Kept inline so the PoC is self-contained.

export type Product = {
  id: string;
  name: string;
  description: string;
  priceUsdt: string; // human-readable, e.g. "12.50"
  image: string;
};

export const CATALOG: Product[] = [
  {
    id: "tee-001",
    name: "WDK Tee — Self-Custody Edition",
    description:
      "A reference garment. Settles in USDT on Sepolia. Burns no gas during testnet runs.",
    priceUsdt: "12.50",
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=70"
  },
  {
    id: "mug-001",
    name: "USD₮ Espresso Mug",
    description:
      "Ceramic, 300 ml. Pay-once, brew-many. Demonstrates a sub-$5 USDT settlement flow.",
    priceUsdt: "3.20",
    image:
      "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=800&q=70"
  },
  {
    id: "key-001",
    name: "Hardware Recovery Card",
    description:
      "Steel-plated seed backup. Higher-value item to demonstrate >50 USDT settlement and confirmation UX.",
    priceUsdt: "89.00",
    image:
      "https://images.unsplash.com/photo-1591488320495-2f5e1d8e26b4?auto=format&fit=crop&w=800&q=70"
  }
];

export function findProduct(id: string): Product | undefined {
  return CATALOG.find((p) => p.id === id);
}
