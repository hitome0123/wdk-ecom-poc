"use client";

import { useEffect, useState } from "react";

type StatusEvent = {
  id: string;
  status: string;
  txHash?: string;
  confirmations?: number;
  amountHuman: string;
  merchantAddress: string;
  payerAddress?: string;
  indexer?: { source: string; confirmations: number };
};

export default function ReceiptClient({
  orderId,
  initialTx
}: {
  orderId: string;
  initialTx?: string;
}) {
  const [state, setState] = useState<StatusEvent | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/orders/${orderId}/stream`);
    es.addEventListener("status", (e) => {
      try {
        setState(JSON.parse((e as MessageEvent).data));
      } catch {
        /* ignore */
      }
    });
    es.addEventListener("error", () => es.close());
    return () => es.close();
  }, [orderId]);

  const status = state?.status ?? "awaiting_payment";
  const tx = state?.txHash ?? initialTx;
  const confs = state?.confirmations ?? 0;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Order receipt</h1>
        <p className="text-sm text-neutral-600">
          Order <span className="font-mono">{orderId}</span>
        </p>
      </header>

      <StatusCard status={status} confirmations={confs} />

      <dl className="grid grid-cols-3 gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-sm">
        <Row label="Amount" value={state ? `${state.amountHuman} USDT` : "…"} />
        <Row label="Confirmations" value={String(confs)} />
        <Row
          label="Indexer source"
          value={state?.indexer?.source ?? "—"}
        />
        <Row
          label="Payer"
          value={state?.payerAddress ? short(state.payerAddress) : "—"}
        />
        <Row
          label="Merchant"
          value={state ? short(state.merchantAddress) : "—"}
        />
        <Row
          label="Tx hash"
          value={
            tx ? (
              <a
                className="break-all font-mono text-xs underline"
                href={`https://sepolia.etherscan.io/tx/${tx}`}
                target="_blank"
                rel="noreferrer"
              >
                {tx.slice(0, 14)}…
              </a>
            ) : (
              "—"
            )
          }
        />
      </dl>
    </div>
  );
}

function StatusCard({
  status,
  confirmations
}: {
  status: string;
  confirmations: number;
}) {
  const tone =
    status === "finalized"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "confirmed"
      ? "bg-sky-50 text-sky-700 border-sky-200"
      : status === "broadcast"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-neutral-50 text-neutral-600 border-neutral-200";

  const label =
    status === "finalized"
      ? "Payment finalized"
      : status === "confirmed"
      ? `Confirmed (${confirmations} confs)`
      : status === "broadcast"
      ? "Broadcast — awaiting confirmation"
      : "Awaiting payment";

  return (
    <div className={`rounded-xl border p-5 ${tone}`}>
      <div className="text-xs uppercase tracking-widest opacity-70">Status</div>
      <div className="mt-1 text-lg font-semibold">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="col-span-3 grid grid-cols-3 border-b border-neutral-100 pb-2 last:border-0">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="col-span-2 break-all">{value}</dd>
    </div>
  );
}

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
