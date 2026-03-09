// Limit Order Strategy: buy when price <= buyPrice, sell when price >= sellPrice

import { config } from "../config";
import { getTokenPrice } from "../price";
import { executeSwap, usdToMicroUnits } from "../swap";

// USDC mint (input for buys)
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export function startLimitOrders(): void {
  const { tokenMint, buyPrice, sellPrice, amountUsd, pollSeconds } = config.limitOrder;

  console.log(`[LimitOrder] Starting - watching ${tokenMint}`);
  console.log(`[LimitOrder] Buy at <= $${buyPrice}, Sell at >= $${sellPrice}`);

  let buyFilled = false;
  let sellFilled = false;

  const poll = async () => {
    try {
      const { usdPrice } = await getTokenPrice(tokenMint);
      console.log(`[LimitOrder] Price: $${usdPrice}`);

      // Buy order
      if (!buyFilled && buyPrice > 0 && usdPrice <= buyPrice) {
        console.log(`[LimitOrder] BUY triggered at $${usdPrice} (target <= $${buyPrice})`);
        const result = await executeSwap({
          inputMint: USDC_MINT,
          outputMint: tokenMint,
          amountLamports: usdToMicroUnits(amountUsd, 6),
        });
        console.log(`[LimitOrder] Buy filled. Tx: ${result.signature}`);
        buyFilled = true;
      }

      // Sell order
      if (!sellFilled && sellPrice > 0 && usdPrice >= sellPrice) {
        console.log(`[LimitOrder] SELL triggered at $${usdPrice} (target >= $${sellPrice})`);
        // Sell amountUsd worth of the token - convert USD to token units
        const tokenUnits = Math.floor((amountUsd / usdPrice) * 1e9); // assume 9 decimals (SOL)
        const result = await executeSwap({
          inputMint: tokenMint,
          outputMint: USDC_MINT,
          amountLamports: tokenUnits,
        });
        console.log(`[LimitOrder] Sell filled. Tx: ${result.signature}`);
        sellFilled = true;
      }

      if (buyFilled && sellFilled) {
        console.log(`[LimitOrder] Both orders filled. Stopping.`);
        return;
      }
    } catch (err) {
      console.error(`[LimitOrder] Error:`, err);
    }

    setTimeout(poll, pollSeconds * 1000);
  };

  poll();
}
