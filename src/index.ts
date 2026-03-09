import { config } from "./config";
import { printWalletInfo } from "./wallet";
import { startDCA } from "./strategies/dca";
import { startLimitOrders } from "./strategies/limitOrder";
import { startTakeProfitStopLoss } from "./strategies/takeProfitStopLoss";
import { startRebalancer } from "./strategies/rebalance";
import { startServer } from "./server";
import { getActiveWallet } from "./walletManager";

async function main() {
  console.log("=== Solana Automated Trader ===");
  console.log("");

  // Start Express API + UI server
  startServer(config.serverPort);

  // Show wallet info if a wallet is active
  const active = getActiveWallet();
  if (active) {
    console.log(`Active wallet: ${active.address} (${active.label})`);
    try { await printWalletInfo(); } catch { /* balance fetch is non-fatal */ }
  } else if (config.walletPrivateKey) {
    try { await printWalletInfo(); } catch { /* balance fetch is non-fatal */ }
  } else {
    console.log(`No active wallet. Open http://localhost:${config.serverPort} to generate or import one.`);
  }

  console.log("");

  // Start strategies that were enabled via .env at startup
  const strategies = config.enabledStrategies;

  if (strategies.length === 0) {
    console.log("No strategies enabled at startup. Toggle them on via the UI.");
  } else {
    console.log(`Starting strategies: ${strategies.join(", ")}`);
  }

  if (strategies.includes("dca")) startDCA();
  if (strategies.includes("limitOrder")) startLimitOrders();
  if (strategies.includes("takeProfitStopLoss")) startTakeProfitStopLoss();
  if (strategies.includes("rebalance")) startRebalancer();
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
