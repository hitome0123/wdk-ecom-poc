// Centralized chain config so the merchant only edits .env.local.
// All other modules import from here.

export const CHAIN = {
  name: process.env.NEXT_PUBLIC_CHAIN || "sepolia",
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.sepolia.org",
  usdtAddress:
    process.env.NEXT_PUBLIC_USDT_ADDRESS ||
    "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0",
  usdtDecimals: Number(process.env.NEXT_PUBLIC_USDT_DECIMALS || 6),
  merchantAddress:
    process.env.NEXT_PUBLIC_MERCHANT_ADDRESS ||
    "0x0000000000000000000000000000000000000000"
};

export function toBaseUnits(human: string, decimals = CHAIN.usdtDecimals): bigint {
  const [whole, fraction = ""] = human.split(".");
  const padded = (fraction + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole + padded);
}
