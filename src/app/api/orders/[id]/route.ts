import { NextResponse } from "next/server";
import { getOrder } from "@/lib/orders";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const order = getOrder(params.id);
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(order);
}
