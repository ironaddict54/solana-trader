// Take Profit / Stop Loss: auto-sell when price hits gain% or loss% from entry

import { config } from "../config";
import { getTokenPrice } from "../price";
import { executeSwap } from "../swap";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export function startTakeProfitStopLoss(): void {
  const { tokenMint, entryPrice, takeProfitPct, stopLossPct, sellAmount, pollSeconds } = config.tpsl;

  const takeProfitPrice = entryPrice * (1 + takeProfitPct / 100);
  const stopLossPrice = entryPrice * (1 - stopLossPct / 100);

  console.log(`[TPSL] Starting - watching ${tokenMint}`);
  console.log(`[TPSL] Entry: $${entryPrice} | TP: $${takeProfitPrice.toFixed(4)} (+${takeProfitPct}%) | SL: $${stopLossPrice.toFixed(4)} (-${stopLossPct}%)`);

  let triggered = false;

  const poll = async () => {
    if (triggered) return;

    try {
      const { usdPrice } = await getTokenPrice(tokenMint);
      const pctChange = ((usdPrice - entryPrice) / entryPrice) * 100;
      console.log(`[TPSL] Price: $${usdPrice} (${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(2)}%)`);

      if (usdPrice >= takeProfitPrice) {
        console.log(`[TPSL] TAKE PROFIT triggered at $${usdPrice}`);
        await sell(tokenMint, sellAmount, usdPrice);
        triggered = true;
        return;
      }

      if (usdPrice <= stopLossPrice) {
        console.log(`[TPSL] STOP LOSS triggered at $${usdPrice}`);
        await sell(tokenMint, sellAmount, usdPrice);
        triggered = true;
        return;
      }
    } catch (err) {
      console.error(`[TPSL] Error:`, err);
    }

    setTimeout(poll, pollSeconds * 1000);
  };

  poll();
}

async function sell(tokenMint: string, amount: number, currentPrice: number): Promise<void> {
  try {
    const result = await executeSwap({
      inputMint: tokenMint,
      outputMint: USDC_MINT,
      amountLamports: amount,
    });
    const usdReceived = (result.outAmount / 1e6).toFixed(2);
    console.log(`[TPSL] Sold. Received ~$${usdReceived} USDC. Tx: ${result.signature}`);
  } catch (err) {
    console.error(`[TPSL] Sell failed:`, err);
  }
}
