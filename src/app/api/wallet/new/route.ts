// Generates a fresh self-custodial WDK wallet for the demo checkout.
//
// IMPORTANT: this endpoint exists for PoC convenience only. A production
// integration MUST NOT have the server generate keys — keys must be created
// and held entirely on the user's device (browser extension, mobile app,
// hardware wallet). The reference implementation will be migrated to a
// browser-only generator (WDK in a Web Worker) in v0.2; this route is the
// fastest path to a working end-to-end demo for the M1 milestone.

import { NextResponse } from "next/server";
import WDK from "@tetherto/wdk";
import WalletManagerEvm from "@tetherto/wdk-wallet-evm";
import { CHAIN } from "@/lib/chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const seedPhrase = WDK.getRandomSeedPhrase(12);
  const wdk = new WDK(seedPhrase);
  wdk.registerWallet("ethereum", WalletManagerEvm, {
    provider: CHAIN.rpcUrl
  });

  const account = await wdk.getAccount("ethereum", 0);
  const address = await account.getAddress();
  wdk.dispose?.();

  return NextResponse.json({ seedPhrase, address });
}
