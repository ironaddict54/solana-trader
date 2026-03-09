// Portfolio Rebalancer: maintain target % allocations, rebalance on cron

import cron from "node-cron";
import { config, RebalanceTarget } from "../config";
import { getMultipleTokenPrices } from "../price";
import { executeSwap, usdToMicroUnits } from "../swap";
import { getConnection, getPublicKey } from "../wallet";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL_MINT = "So11111111111111111111111111111111111111112";

async function getTokenBalances(targets: RebalanceTarget[]): Promise<Map<string, number>> {
  const conn = getConnection();
  const pubkey = getPublicKey();
  const balances = new Map<string, number>();

  // Get SOL balance
  const lamports = await conn.getBalance(pubkey);
  balances.set(SOL_MINT, lamports / 1e9);

  // Get SPL token balances
  const tokenAccounts = await conn.getParsedTokenAccountsByOwner(pubkey, {
    programId: TOKEN_PROGRAM_ID,
  });

  for (const { account } of tokenAccounts.value) {
    const parsed = account.data.parsed.info;
    const mint: string = parsed.mint;
    const amount: number = parseFloat(parsed.tokenAmount.uiAmount ?? "0");
    balances.set(mint, amount);
  }

  return balances;
}

export function startRebalancer(): void {
  const { targets, thresholdPct, cron: cronExpr } = config.rebalance;

  if (targets.length === 0) {
    console.warn(`[Rebalance] No targets configured. Skipping.`);
    return;
  }

  const totalPct = targets.reduce((sum, t) => sum + t.targetPct, 0);
  if (Math.abs(totalPct - 100) > 0.01) {
    throw new Error(`[Rebalance] Target percentages must sum to 100. Got: ${totalPct}`);
  }

  console.log(`[Rebalance] Starting - schedule: ${cronExpr}`);
  targets.forEach(t => console.log(`  ${t.mint}: ${t.targetPct}%`));

  cron.schedule(cronExpr, async () => {
    console.log(`[Rebalance] Running rebalance check...`);
    try {
      const mints = targets.map(t => t.mint);
      const prices = await getMultipleTokenPrices(mints);
      const balances = await getTokenBalances(targets);

      // Calculate current USD values
      const usdValues = new Map<string, number>();
      let totalUsd = 0;
      for (const target of targets) {
        const price = prices.get(target.mint)?.usdPrice ?? 0;
        const balance = balances.get(target.mint) ?? 0;
        const usd = balance * price;
        usdValues.set(target.mint, usd);
        totalUsd += usd;
      }

      console.log(`[Rebalance] Total portfolio value: $${totalUsd.toFixed(2)}`);

      // Check each target for drift
      for (const target of targets) {
        const currentUsd = usdValues.get(target.mint) ?? 0;
        const currentPct = totalUsd > 0 ? (currentUsd / totalUsd) * 100 : 0;
        const drift = Math.abs(currentPct - target.targetPct);

        console.log(`[Rebalance] ${target.mint}: current=${currentPct.toFixed(1)}% target=${target.targetPct}% drift=${drift.toFixed(1)}%`);

        if (drift < thresholdPct) {
          console.log(`[Rebalance] Within threshold (${thresholdPct}%), no action needed.`);
          continue;
        }

        const targetUsd = (target.targetPct / 100) * totalUsd;
        const diffUsd = targetUsd - currentUsd;

        if (diffUsd > 0) {
          // Need to buy this token - sell USDC
          console.log(`[Rebalance] BUY $${diffUsd.toFixed(2)} of ${target.mint}`);
          await executeSwap({
            inputMint: USDC_MINT,
            outputMint: target.mint,
            amountLamports: usdToMicroUnits(Math.abs(diffUsd), 6),
          });
        } else {
          // Need to sell this token - buy USDC
          console.log(`[Rebalance] SELL $${Math.abs(diffUsd).toFixed(2)} of ${target.mint}`);
          const price = prices.get(target.mint)?.usdPrice ?? 1;
          const tokenUnits = Math.floor((Math.abs(diffUsd) / price) * 1e9);
          await executeSwap({
            inputMint: target.mint,
            outputMint: USDC_MINT,
            amountLamports: tokenUnits,
          });
        }
      }

      console.log(`[Rebalance] Done.`);
    } catch (err) {
      console.error(`[Rebalance] Error:`, err);
    }
  });
}
