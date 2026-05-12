"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/catalog";

type Step = "intro" | "wallet" | "signing" | "broadcast" | "error";

export default function CheckoutClient({ product }: { product: Product }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("intro");
  const [seedPhrase, setSeedPhrase] = useState<string>("");
  const [payerAddress, setPayerAddress] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function handleCreateWallet() {
    setStep("wallet");
    setError("");
    try {
      const res = await fetch("/api/wallet/new", { method: "POST" });
      if (!res.ok) throw new Error(`Wallet creation failed: ${res.status}`);
      const data = (await res.json()) as { seedPhrase: string; address: string };
      setSeedPhrase(data.seedPhrase);
      setPayerAddress(data.address);
    } catch (err) {
      setError((err as Error).message);
      setStep("error");
    }
  }

  async function handlePay() {
    if (!seedPhrase) return;
    setStep("signing");
    setError("");
    try {
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: product.id })
      });
      if (!orderRes.ok) throw new Error("Order creation failed");
      const order = (await orderRes.json()) as { id: string };

      setStep("broadcast");
      const payRes = await fetch("/api/pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          seedPhrase,
          payerAddress
        })
      });
      if (!payRes.ok) {
        const txt = await payRes.text();
        throw new Error(`Payment broadcast failed: ${txt || payRes.status}`);
      }
      const result = (await payRes.json()) as { txHash: string };
      router.push(`/receipt/${order.id}?tx=${result.txHash}`);
    } catch (err) {
      setError((err as Error).message);
      setStep("error");
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Pay with WDK wallet</h2>
        <p className="mt-1 text-sm text-neutral-600">
          A fresh self-custodial wallet is generated for this checkout. The
          seed phrase stays in your browser memory until the transaction is
          broadcast.
        </p>

        {step === "intro" && (
          <button
            onClick={handleCreateWallet}
            className="mt-5 w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Generate self-custodial wallet
          </button>
        )}

        {step !== "intro" && (
          <div className="mt-5 space-y-4 text-sm">
            <div>
              <div className="text-xs uppercase tracking-widest text-neutral-500">
                Payer address
              </div>
              <div className="mt-1 break-all font-mono text-xs">
                {payerAddress || "…"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-neutral-500">
                Seed phrase (held in browser memory only)
              </div>
              <div className="mt-1 break-all rounded-md bg-neutral-100 p-2 font-mono text-[11px] text-neutral-700">
                {seedPhrase || "…"}
              </div>
              <p className="mt-1 text-[11px] text-amber-700">
                Demo only: a production checkout would inject the user&apos;s
                existing WDK wallet via extension / deep-link / RN bridge
                rather than generating a fresh seed.
              </p>
            </div>

            {step === "wallet" && (
              <button
                onClick={handlePay}
                disabled={!payerAddress}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Sign &amp; pay {product.priceUsdt} USDT
              </button>
            )}

            {(step === "signing" || step === "broadcast") && (
              <div className="rounded-lg bg-neutral-50 p-3 text-xs text-neutral-700">
                {step === "signing" && "Constructing and signing transfer…"}
                {step === "broadcast" && "Broadcasting to Sepolia…"}
              </div>
            )}

            {step === "error" && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {error}
                <button
                  onClick={() => setStep(payerAddress ? "wallet" : "intro")}
                  className="ml-2 underline"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
