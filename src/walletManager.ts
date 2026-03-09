import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const WALLETS_FILE = path.join(process.cwd(), "wallets.json");

export interface WalletEntry {
  address: string;
  label: string;
  encryptedKey: string; // AES-256-CBC encrypted base58 private key
  iv: string;           // hex-encoded IV
  isActive: boolean;
}

// ─── Encryption helpers ─────────────────────────────────────────────────

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100_000, 32, "sha256");
}

function encrypt(plaintext: string, password: string): { encrypted: string; iv: string; salt: string } {
  const salt = crypto.randomBytes(16);
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    encrypted: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    salt: salt.toString("hex"),
  };
}

function decrypt(encryptedHex: string, ivHex: string, saltHex: string, password: string): string {
  const salt = Buffer.from(saltHex, "hex");
  const key = deriveKey(password, salt);
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

// ─── Wallet file I/O ────────────────────────────────────────────────────

interface WalletStore {
  wallets: (WalletEntry & { salt: string })[];
}

function loadStore(): WalletStore {
  if (!fs.existsSync(WALLETS_FILE)) return { wallets: [] };
  return JSON.parse(fs.readFileSync(WALLETS_FILE, "utf8")) as WalletStore;
}

function saveStore(store: WalletStore): void {
  fs.writeFileSync(WALLETS_FILE, JSON.stringify(store, null, 2));
}

// ─── Active wallet runtime state ──────────────────────────────────────────────

let _activeKeypair: Keypair | null = null;
let _activeAddress: string | null = null;
let _activeLabel: string | null = null;

export function getActiveWallet(): { address: string; label: string; keypair: Keypair } | null {
  if (!_activeKeypair || !_activeAddress) return null;
  return { address: _activeAddress, label: _activeLabel ?? "", keypair: _activeKeypair };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function generateWallet(label: string, password: string): WalletEntry {
  const keypair = Keypair.generate();
  const address = keypair.publicKey.toBase58();
  const privateKeyB58 = bs58.encode(keypair.secretKey);

  const { encrypted, iv, salt } = encrypt(privateKeyB58, password);

  const store = loadStore();
  const isFirst = store.wallets.length === 0;
  store.wallets.push({ address, label, encryptedKey: encrypted, iv, salt, isActive: isFirst });
  saveStore(store);

  if (isFirst) {
    _activeKeypair = keypair;
    _activeAddress = address;
    _activeLabel = label;
  }

  return { address, label, encryptedKey: encrypted, iv, isActive: isFirst };
}

export function importWallet(privateKeyB58: string, label: string, password: string): WalletEntry {
  const secretKey = bs58.decode(privateKeyB58);
  const keypair = Keypair.fromSecretKey(secretKey);
  const address = keypair.publicKey.toBase58();

  const store = loadStore();
  if (store.wallets.find(w => w.address === address)) {
    throw new Error(`Wallet ${address} already exists`);
  }

  const { encrypted, iv, salt } = encrypt(privateKeyB58, password);
  const isFirst = store.wallets.length === 0;
  store.wallets.push({ address, label, encryptedKey: encrypted, iv, salt, isActive: isFirst });
  saveStore(store);

  if (isFirst) {
    _activeKeypair = keypair;
    _activeAddress = address;
    _activeLabel = label;
  }

  return { address, label, encryptedKey: encrypted, iv, isActive: isFirst };
}

export function listWallets(): WalletEntry[] {
  const store = loadStore();
  return store.wallets.map(({ address, label, encryptedKey, iv, isActive }) => ({
    address, label, encryptedKey, iv, isActive,
  }));
}

export function setActiveWallet(address: string, password: string): void {
  const store = loadStore();
  const entry = store.wallets.find(w => w.address === address);
  if (!entry) throw new Error(`Wallet ${address} not found`);

  const privateKeyB58 = decrypt(entry.encryptedKey, entry.iv, entry.salt, password);
  const keypair = Keypair.fromSecretKey(bs58.decode(privateKeyB58));

  store.wallets.forEach(w => { w.isActive = w.address === address; });
  saveStore(store);

  _activeKeypair = keypair;
  _activeAddress = address;
  _activeLabel = entry.label;
}

export function getActiveKeypair(): Keypair {
  if (!_activeKeypair) {
    const envKey = process.env.WALLET_PRIVATE_KEY;
    if (envKey) {
      const keypair = Keypair.fromSecretKey(bs58.decode(envKey));
      _activeKeypair = keypair;
      _activeAddress = keypair.publicKey.toBase58();
      _activeLabel = "env";
      return keypair;
    }
    const store = loadStore();
    const active = store.wallets.find(w => w.isActive);
    if (!active) throw new Error("No active wallet. Generate or activate a wallet first.");
    throw new Error("Active wallet found but not unlocked. Call setActiveWallet with password first.");
  }
  return _activeKeypair;
}

// Auto-load from env if available at startup
(function autoLoadEnv() {
  const envKey = process.env.WALLET_PRIVATE_KEY;
  if (envKey && !_activeKeypair) {
    try {
      const keypair = Keypair.fromSecretKey(bs58.decode(envKey));
      _activeKeypair = keypair;
      _activeAddress = keypair.publicKey.toBase58();
      _activeLabel = "env";
    } catch {
      // ignore invalid key
    }
  }
})();
