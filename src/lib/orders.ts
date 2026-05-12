// Tiny in-memory order store. The PoC stays stateless on the public-facing
// surface; a real deployment swaps this for Postgres/Redis.

import { findProduct } from "./catalog";

export type OrderStatus =
  | "awaiting_payment"
  | "broadcast"
  | "confirmed"
  | "finalized"
  | "expired";

export type Order = {
  id: string;
  productId: string;
  amountBaseUnits: string; // bigint as string for JSON safety
  amountHuman: string;
  merchantAddress: string;
  createdAt: number;
  status: OrderStatus;
  txHash?: string;
  payerAddress?: string;
  confirmations?: number;
};

const STORE = new Map<string, Order>();

export function createOrder(productId: string, merchantAddress: string): Order {
  const product = findProduct(productId);
  if (!product) throw new Error(`Unknown product: ${productId}`);

  const id = `ord_${Math.random().toString(36).slice(2, 10)}`;
  const order: Order = {
    id,
    productId,
    amountHuman: product.priceUsdt,
    amountBaseUnits: humanToBase(product.priceUsdt).toString(),
    merchantAddress,
    createdAt: Date.now(),
    status: "awaiting_payment"
  };
  STORE.set(id, order);
  return order;
}

export function getOrder(id: string): Order | undefined {
  return STORE.get(id);
}

export function updateOrder(id: string, patch: Partial<Order>): Order | undefined {
  const o = STORE.get(id);
  if (!o) return undefined;
  Object.assign(o, patch);
  STORE.set(id, o);
  return o;
}

function humanToBase(human: string, decimals = 6): bigint {
  const [whole, fraction = ""] = human.split(".");
  const padded = (fraction + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole + padded);
}
