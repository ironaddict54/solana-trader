import {
  Connection,
  Keypair,
  VersionedTransaction,
} from "@solana/web3.js";
import { config } from "./config";
import { getConnection, getKeypair } from "./wallet";

const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_API = "https://quote-api.jup.ag/v6/swap";

export interface SwapParams {
  inputMint: string;
  outputMint: string;
  amountLamports: number; // amount in smallest units of input token
  slippageBps?: number;
}

export interface SwapResult {
  signature: string;
  inputMint: string;
  outputMint: string;
  inAmount: number;
  outAmount: number;
}

interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  routePlan: unknown[];
}

export async function getQuote(params: SwapParams): Promise<JupiterQuote> {
  const slippage = params.slippageBps ?? config.slippageBps;
  const url = new URL(JUPITER_QUOTE_API);
  url.searchParams.set("inputMint", params.inputMint);
  url.searchParams.set("outputMint", params.outputMint);
  url.searchParams.set("amount", params.amountLamports.toString());
  url.searchParams.set("slippageBps", slippage.toString());

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Jupiter quote error: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<JupiterQuote>;
}

export async function executeSwap(params: SwapParams): Promise<SwapResult> {
  const conn: Connection = getConnection();
  const keypair: Keypair = getKeypair();

  console.log(`[swap] Getting quote: ${params.inputMint} -> ${params.outputMint}, amount=${params.amountLamports}`);
  const quote = await getQuote(params);
  console.log(`[swap] Quote received: out=${quote.outAmount}`);

  // Get swap transaction
  const swapRes = await fetch(JUPITER_SWAP_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: keypair.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });

  if (!swapRes.ok) {
    throw new Error(`Jupiter swap error: ${swapRes.status} ${await swapRes.text()}`);
  }

  const { swapTransaction } = await swapRes.json() as { swapTransaction: string };

  // Deserialize, sign, and send
  const txBuf = Buffer.from(swapTransaction, "base64");
  const tx = VersionedTransaction.deserialize(txBuf);
  tx.sign([keypair]);

  const signature = await conn.sendTransaction(tx, { maxRetries: 3 });
  console.log(`[swap] Transaction sent: ${signature}`);

  // Confirm
  const latestBlockhash = await conn.getLatestBlockhash();
  await conn.confirmTransaction(
    { signature, ...latestBlockhash },
    "confirmed"
  );
  console.log(`[swap] Confirmed: https://solscan.io/tx/${signature}`);

  return {
    signature,
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    inAmount: parseInt(quote.inAmount),
    outAmount: parseInt(quote.outAmount),
  };
}

// Helper: convert USD amount to lamports given current price
// Assumes input token is a stablecoin (USDC) with 6 decimals
export function usdToMicroUnits(usdAmount: number, decimals = 6): number {
  return Math.floor(usdAmount * Math.pow(10, decimals));
}
