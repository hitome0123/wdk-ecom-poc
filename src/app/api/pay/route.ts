// Signs and broadcasts the USDT transfer using WDK.
//
// For the PoC the seed phrase is posted back from the browser; in production
// this entire flow runs client-side and only the resulting tx hash is
// reported to the merchant. See README "Roadmap" for the migration path.

import { NextResponse } from "next/server";
import WDK from "@tetherto/wdk";
import WalletManagerEvm, {
  type WalletAccountEvm
} from "@tetherto/wdk-wallet-evm";
import { CHAIN } from "@/lib/chain";
import { getOrder, updateOrder } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { orderId, seedPhrase, payerAddress } = (await req.json()) as {
    orderId?: string;
    seedPhrase?: string;
    payerAddress?: string;
  };

  if (!orderId || !seedPhrase) {
    return NextResponse.json(
      { error: "orderId and seedPhrase required" },
      { status: 400 }
    );
  }
  const order = getOrder(orderId);
  if (!order) {
    return NextResponse.json({ error: "order not found" }, { status: 404 });
  }

  const wdk = new WDK(seedPhrase);
  wdk.registerWallet("ethereum", WalletManagerEvm, { provider: CHAIN.rpcUrl });
  const account = (await wdk.getAccount(
    "ethereum",
    0
  )) as unknown as WalletAccountEvm;

  try {
    const result = await account.transfer({
      token: CHAIN.usdtAddress,
      recipient: order.merchantAddress,
      amount: BigInt(order.amountBaseUnits)
    });

    updateOrder(orderId, {
      status: "broadcast",
      txHash: result.hash,
      payerAddress
    });

    return NextResponse.json({ txHash: result.hash });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  } finally {
    wdk.dispose?.();
  }
}
