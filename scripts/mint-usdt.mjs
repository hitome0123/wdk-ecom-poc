// One-shot helper: mint Sepolia test USDT via the Aave V3 permissionless
// faucet so reviewers can fund a freshly-generated WDK wallet without
// hunting for a USDT faucet UI.
//
// Usage:
//   BUYER_SEED="twelve words ..." node scripts/mint-usdt.mjs
//
// The seed is the same one returned by POST /api/wallet/new — viem's
// mnemonicToAccount uses the standard BIP-44 path (m/44'/60'/0'/0/0)
// which matches what WDK derives, so the address printed below will
// equal `account.getAddress()` inside the PoC.

import { mnemonicToAccount } from "viem/accounts";
import { createWalletClient, createPublicClient, http, encodeFunctionData } from "viem";
import { sepolia } from "viem/chains";

const SEED   = process.env.BUYER_SEED;
const RPC    = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const FAUCET = "0xC959483DBa39aa9E78757139af0e9a2EDEb3f42D"; // Aave V3 Sepolia testnet faucet
const USDT   = "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0"; // matches NEXT_PUBLIC_USDT_ADDRESS
const AMOUNT = 100_000_000n; // 100 USDT (6 decimals)

if (!SEED) {
  console.error("Set BUYER_SEED to the 12-word seed phrase printed by /api/wallet/new.");
  process.exit(1);
}

const account = mnemonicToAccount(SEED);
console.log("Derived address:", account.address);

const data = encodeFunctionData({
  abi: [{
    name: "mint", type: "function", stateMutability: "nonpayable",
    inputs: [{type:"address"},{type:"address"},{type:"uint256"}], outputs: [{type:"uint256"}]
  }],
  functionName: "mint",
  args: [USDT, account.address, AMOUNT]
});

const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC) });
const pub    = createPublicClient({ chain: sepolia, transport: http(RPC) });

const hash = await wallet.sendTransaction({ to: FAUCET, data });
console.log("Tx hash:", hash);
console.log("Etherscan:", `https://sepolia.etherscan.io/tx/${hash}`);
const receipt = await pub.waitForTransactionReceipt({ hash });
console.log("Status:", receipt.status, "block", receipt.blockNumber);
