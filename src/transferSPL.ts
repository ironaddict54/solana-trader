import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
  getMint,
} from "@solana/spl-token";
import { getConnection } from "./wallet";
import { getActiveKeypair } from "./walletManager";

export interface TransferSPLParams {
  fromAddress: string;
  toAddress: string;
  mint: string;
  /** Human-readable token amount (e.g. 10.5 USDC) -- converted to raw units using mint decimals */
  amount: number;
  password?: string;
}

export async function transferSPL(params: TransferSPLParams): Promise<string> {
  const conn: Connection = getConnection();
  const keypair: Keypair = getActiveKeypair();

  if (keypair.publicKey.toBase58() !== params.fromAddress) {
    throw new Error(
      `Active wallet (${keypair.publicKey.toBase58()}) does not match fromAddress (${params.fromAddress}). Activate the correct wallet first.`
    );
  }

  const mintPubkey = new PublicKey(params.mint);
  const toPubkey = new PublicKey(params.toAddress);

  // Fetch mint decimals
  const mintInfo = await getMint(conn, mintPubkey);
  const rawAmount = BigInt(Math.floor(params.amount * Math.pow(10, mintInfo.decimals)));

  // Get or create ATAs for both sender and recipient
  const fromATA = await getOrCreateAssociatedTokenAccount(
    conn,
    keypair,
    mintPubkey,
    keypair.publicKey
  );

  const toATA = await getOrCreateAssociatedTokenAccount(
    conn,
    keypair,       // payer for account creation if needed
    mintPubkey,
    toPubkey
  );

  if (fromATA.amount < rawAmount) {
    throw new Error(
      `Insufficient token balance. Have ${fromATA.amount}, need ${rawAmount} raw units.`
    );
  }

  const tx = new Transaction().add(
    createTransferInstruction(
      fromATA.address,
      toATA.address,
      keypair.publicKey,
      rawAmount
    )
  );

  const signature = await sendAndConfirmTransaction(conn, tx, [keypair], {
    commitment: "confirmed",
  });

  console.log(`[transferSPL] Sent ${params.amount} tokens (mint: ${params.mint})`);
  console.log(`[transferSPL] From ${params.fromAddress} -> ${params.toAddress}`);
  console.log(`[transferSPL] Signature: https://solscan.io/tx/${signature}`);

  return signature;
}
