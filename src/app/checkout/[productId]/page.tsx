import { notFound } from "next/navigation";
import { findProduct } from "@/lib/catalog";
import { CHAIN } from "@/lib/chain";
import CheckoutClient from "./checkout-client";

export default function CheckoutPage({
  params
}: {
  params: { productId: string };
}) {
  const product = findProduct(params.productId);
  if (!product) notFound();

  return (
    <div className="grid gap-8 md:grid-cols-[1.1fr_1fr]">
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Checkout</h1>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.image}
            alt={product.name}
            className="h-48 w-full rounded-lg object-cover"
          />
          <h2 className="mt-4 font-medium">{product.name}</h2>
          <p className="mt-1 text-sm text-neutral-600">{product.description}</p>
          <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 text-sm">
            <span className="text-neutral-500">Total due</span>
            <span className="font-mono">
              {product.priceUsdt}{" "}
              <span className="text-neutral-500">USDT</span>
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
            <span>Network</span>
            <span className="font-mono">{CHAIN.name}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
            <span>Merchant address</span>
            <span className="font-mono">
              {CHAIN.merchantAddress.slice(0, 8)}…
              {CHAIN.merchantAddress.slice(-6)}
            </span>
          </div>
        </div>
      </section>

      <CheckoutClient product={product} />
    </div>
  );
}
