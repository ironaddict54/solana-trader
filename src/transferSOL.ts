import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { getConnection } from "./wallet";
import { getActiveKeypair } from "./walletManager";

export interface TransferSOLParams {
  fromAddress: string;
  toAddress: string;
  amountSol: number;
  /** Password to decrypt the from-wallet. If omitted, uses the already-unlocked active wallet. */
  password?: string;
}

export async function transferSOL(params: TransferSOLParams): Promise<string> {
  const conn: Connection = getConnection();

  // Resolve sender keypair -- must match fromAddress
  const keypair: Keypair = getActiveKeypair();
  if (keypair.publicKey.toBase58() !== params.fromAddress) {
    throw new Error(
      `Active wallet (${keypair.publicKey.toBase58()}) does not match fromAddress (${params.fromAddress}). Activate the correct wallet first.`
    );
  }

  const toPublicKey = new PublicKey(params.toAddress);
  const lamports = Math.floor(params.amountSol * LAMPORTS_PER_SOL);

  // Check balance
  const balance = await conn.getBalance(keypair.publicKey);
  if (balance < lamports + 5000) {
    throw new Error(
      `Insufficient SOL balance. Have ${balance / LAMPORTS_PER_SOL} SOL, need ${params.amountSol} SOL + fees.`
    );
  }

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: toPublicKey,
      lamports,
    })
  );

  const signature = await sendAndConfirmTransaction(conn, tx, [keypair], {
    commitment: "confirmed",
  });

  console.log(`[transferSOL] Sent ${params.amountSol} SOL from ${params.fromAddress} to ${params.toAddress}`);
  console.log(`[transferSOL] Signature: https://solscan.io/tx/${signature}`);

  return signature;
}
