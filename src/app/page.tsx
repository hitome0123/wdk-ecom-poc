import Link from "next/link";
import { CATALOG } from "@/lib/catalog";

export default function StorefrontPage() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">Storefront</h1>
        <p className="mt-2 max-w-2xl text-neutral-600">
          A minimal headless storefront. Every checkout below opens a
          self-custodial WDK wallet inside the browser, signs a USDT transfer,
          and broadcasts on Sepolia testnet. The merchant&apos;s server only
          observes the chain via the WDK Indexer — it never touches a private
          key.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {CATALOG.map((p) => (
          <article
            key={p.id}
            className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.image}
              alt={p.name}
              className="h-44 w-full object-cover"
            />
            <div className="space-y-3 p-4">
              <h2 className="font-medium">{p.name}</h2>
              <p className="line-clamp-3 text-sm text-neutral-600">
                {p.description}
              </p>
              <div className="flex items-center justify-between pt-2">
                <span className="font-mono text-sm">
                  {p.priceUsdt}{" "}
                  <span className="text-neutral-500">USDT</span>
                </span>
                <Link
                  href={`/checkout/${p.id}`}
                  className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
                >
                  Checkout
                </Link>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
