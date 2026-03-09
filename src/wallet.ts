import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { config } from "./config";

let _keypair: Keypair | null = null;
let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(config.rpcEndpoint, "confirmed");
  }
  return _connection;
}

export function getKeypair(): Keypair {
  if (!_keypair) {
    const secretKey = bs58.decode(config.walletPrivateKey);
    _keypair = Keypair.fromSecretKey(secretKey);
  }
  return _keypair;
}

export function getPublicKey(): PublicKey {
  return getKeypair().publicKey;
}

export async function getSolBalance(): Promise<number> {
  const conn = getConnection();
  const lamports = await conn.getBalance(getPublicKey());
  return lamports / LAMPORTS_PER_SOL;
}

export async function printWalletInfo(): Promise<void> {
  const pubkey = getPublicKey();
  const sol = await getSolBalance();
  console.log(`Wallet: ${pubkey.toBase58()}`);
  console.log(`SOL Balance: ${sol.toFixed(4)} SOL`);
}
