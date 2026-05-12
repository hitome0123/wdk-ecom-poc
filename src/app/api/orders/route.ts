import { NextResponse } from "next/server";
import { createOrder } from "@/lib/orders";
import { CHAIN } from "@/lib/chain";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { productId?: string };
  if (!body.productId) {
    return NextResponse.json({ error: "productId required" }, { status: 400 });
  }
  try {
    const order = createOrder(body.productId, CHAIN.merchantAddress);
    return NextResponse.json(order);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}
