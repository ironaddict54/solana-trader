// DCA Strategy: buy a fixed USD amount of a target token on a schedule

import cron from "node-cron";
import { config } from "../config";
import { executeSwap, usdToMicroUnits } from "../swap";
import { getTokenPrice } from "../price";

export function startDCA(): void {
  const { tokenMint, inputMint, amountUsd, cron: cronExpr } = config.dca;

  console.log(`[DCA] Starting - buying $${amountUsd} of ${tokenMint} on schedule: ${cronExpr}`);

  cron.schedule(cronExpr, async () => {
    try {
      console.log(`[DCA] Running buy: $${amountUsd} of ${tokenMint}`);

      const price = await getTokenPrice(tokenMint);
      console.log(`[DCA] Current price: $${price.usdPrice}`);

      // USDC has 6 decimals
      const amountMicroUnits = usdToMicroUnits(amountUsd, 6);

      const result = await executeSwap({
        inputMint,
        outputMint: tokenMint,
        amountLamports: amountMicroUnits,
      });

      console.log(`[DCA] Buy complete. Tx: ${result.signature}`);
      console.log(`[DCA] Spent ${amountUsd} USD, received ${result.outAmount} units of ${tokenMint}`);
    } catch (err) {
      console.error(`[DCA] Error:`, err);
    }
  });
}
