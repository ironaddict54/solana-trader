import dotenv from "dotenv";
dotenv.config();

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optionalEnv(key: string, defaultVal: string): string {
  return process.env[key] ?? defaultVal;
}

export interface RebalanceTarget {
  mint: string;
  targetPct: number;
}

export const config = {
  rpcEndpoint: requireEnv("RPC_ENDPOINT"),
  // WALLET_PRIVATE_KEY is now optional — wallets can be managed via the UI / walletManager instead
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY ?? null,
  slippageBps: parseInt(optionalEnv("SLIPPAGE_BPS", "50")),
  serverPort: parseInt(optionalEnv("SERVER_PORT", "3000")),
  enabledStrategies: optionalEnv("ENABLED_STRATEGIES", "").split(",").map(s => s.trim()).filter(Boolean),

  dca: {
    tokenMint: optionalEnv("DCA_TOKEN_MINT", "So11111111111111111111111111111111111111112"),
    inputMint: optionalEnv("DCA_INPUT_MINT", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
    amountUsd: parseFloat(optionalEnv("DCA_AMOUNT_USD", "10")),
    cron: optionalEnv("DCA_CRON", "0 9 * * *"),
  },

  limitOrder: {
    tokenMint: optionalEnv("LIMIT_TOKEN_MINT", "So11111111111111111111111111111111111111112"),
    buyPrice: parseFloat(optionalEnv("LIMIT_BUY_PRICE", "0")),
    sellPrice: parseFloat(optionalEnv("LIMIT_SELL_PRICE", "999999")),
    amountUsd: parseFloat(optionalEnv("LIMIT_AMOUNT_USD", "50")),
    pollSeconds: parseInt(optionalEnv("LIMIT_POLL_SECONDS", "30")),
  },

  tpsl: {
    tokenMint: optionalEnv("TPSL_TOKEN_MINT", "So11111111111111111111111111111111111111112"),
    entryPrice: parseFloat(optionalEnv("TPSL_ENTRY_PRICE", "0")),
    takeProfitPct: parseFloat(optionalEnv("TPSL_TAKE_PROFIT_PCT", "20")),
    stopLossPct: parseFloat(optionalEnv("TPSL_STOP_LOSS_PCT", "10")),
    sellAmount: parseInt(optionalEnv("TPSL_SELL_AMOUNT", "1000000000")),
    pollSeconds: parseInt(optionalEnv("TPSL_POLL_SECONDS", "15")),
  },

  rebalance: {
    targets: JSON.parse(optionalEnv("REBALANCE_TARGETS", "[]")) as RebalanceTarget[],
    thresholdPct: parseFloat(optionalEnv("REBALANCE_THRESHOLD_PCT", "5")),
    cron: optionalEnv("REBALANCE_CRON", "0 0 * * 0"),
  },
};
