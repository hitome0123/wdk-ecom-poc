// Server-Sent Events stream that polls the WDK Indexer (or RPC fallback)
// and pushes payment status to both the buyer and the merchant dashboard.

import { getOrder, updateOrder } from "@/lib/orders";
import { getTxStatus } from "@/lib/indexer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let cancelled = false;
      const push = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const tick = async () => {
        const order = getOrder(params.id);
        if (!order) {
          push("error", { message: "order not found" });
          controller.close();
          return true;
        }
        if (!order.txHash) {
          push("status", { ...order });
          return false;
        }
        const status = await getTxStatus(order.txHash);
        const next =
          status.status === "finalized"
            ? "finalized"
            : status.status === "confirmed"
            ? "confirmed"
            : "broadcast";
        const updated = updateOrder(order.id, {
          status: next,
          confirmations: status.confirmations
        });
        push("status", { ...updated, indexer: status });
        return status.status === "finalized";
      };

      while (!cancelled) {
        const done = await tick();
        if (done) break;
        await new Promise((r) => setTimeout(r, 4000));
      }
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    }
  });
}
