// Thin wrapper around the WDK Indexer API.
//
// Docs: https://docs.wdk.tether.io/tools/indexer-api
// Base: https://wdk-api.tether.io/api/v1/
//
// The PoC degrades gracefully when no API key is configured: it falls back to
// a public RPC tx-receipt poll, so reviewers can run the full demo without
// signing up first.

import { createPublicClient, http } from "viem";
import { CHAIN } from "./chain";

const INDEXER_BASE = "https://wdk-api.tether.io/api/v1";

export type IndexedTxStatus = {
  txHash: string;
  status: "pending" | "confirmed" | "finalized" | "unknown";
  confirmations: number;
  source: "indexer" | "rpc-fallback";
};

export async function getTxStatus(txHash: string): Promise<IndexedTxStatus> {
  const apiKey = process.env.WDK_INDEXER_API_KEY;
  if (apiKey) {
    try {
      // Network path mirrors the Indexer docs convention: /{network}/transactions/{hash}
      const url = `${INDEXER_BASE}/${CHAIN.name}/transactions/${txHash}`;
      const res = await fetch(url, { headers: { "x-api-key": apiKey } });
      if (res.ok) {
        const data = (await res.json()) as {
          status?: string;
          confirmations?: number;
        };
        return {
          txHash,
          status: normaliseStatus(data.status),
          confirmations: data.confirmations ?? 0,
          source: "indexer"
        };
      }
    } catch {
      // fall through to rpc fallback
    }
  }
  return rpcFallback(txHash);
}

function normaliseStatus(s?: string): IndexedTxStatus["status"] {
  if (!s) return "pending";
  const low = s.toLowerCase();
  if (low.includes("final")) return "finalized";
  if (low.includes("confirm") || low.includes("success")) return "confirmed";
  if (low.includes("pending") || low.includes("mempool")) return "pending";
  return "unknown";
}

async function rpcFallback(txHash: string): Promise<IndexedTxStatus> {
  const client = createPublicClient({ transport: http(CHAIN.rpcUrl) });
  try {
    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`
    });
    const head = await client.getBlockNumber();
    const confirmations = Number(head - receipt.blockNumber);
    return {
      txHash,
      status:
        confirmations >= 12
          ? "finalized"
          : confirmations >= 1
          ? "confirmed"
          : "pending",
      confirmations,
      source: "rpc-fallback"
    };
  } catch {
    return {
      txHash,
      status: "pending",
      confirmations: 0,
      source: "rpc-fallback"
    };
  }
}
