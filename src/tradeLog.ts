import fs from "fs";
import path from "path";

const TRADES_FILE = path.join(process.cwd(), "trades.json");

export interface TradeRecord {
  timestamp: string;      // ISO 8601
  strategy: string;       // "dca" | "limitOrder" | "takeProfitStopLoss" | "rebalance"
  inputMint: string;
  outputMint: string;
  inAmount: number;       // raw units
  outAmount: number;      // raw units
  inAmountUsd: number;    // USD value at time of trade
  outAmountUsd: number;
  signature: string;
  solscan: string;
}

function loadTrades(): TradeRecord[] {
  if (!fs.existsSync(TRADES_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(TRADES_FILE, "utf8")) as TradeRecord[];
  } catch {
    return [];
  }
}

export function appendTrade(record: TradeRecord): void {
  const trades = loadTrades();
  trades.push(record);
  fs.writeFileSync(TRADES_FILE, JSON.stringify(trades, null, 2));
  console.log(`[tradeLog] Logged trade: ${record.strategy} | ${record.signature}`);
}

export function readTrades(): TradeRecord[] {
  return loadTrades().reverse(); // newest first
}

export function buildTradeRecord(
  strategy: string,
  inputMint: string,
  outputMint: string,
  inAmount: number,
  outAmount: number,
  signature: string,
  inAmountUsd = 0,
  outAmountUsd = 0
): TradeRecord {
  return {
    timestamp: new Date().toISOString(),
    strategy,
    inputMint,
    outputMint,
    inAmount,
    outAmount,
    inAmountUsd,
    outAmountUsd,
    signature,
    solscan: `https://solscan.io/tx/${signature}`,
  };
}
