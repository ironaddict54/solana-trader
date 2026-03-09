# Solana Automated Trader

A modular TypeScript trading bot for Solana. Routes all trades through Jupiter for best-price execution. Supports four independent strategies.

## Strategies

| Strategy | Description |
|---|---|
| DCA | Buy a fixed USD amount of a token on a cron schedule |
| Limit Orders | Buy when price drops to a target; sell when price rises |
| Take Profit / Stop Loss | Auto-sell when price gains or loses a % from your entry |
| Rebalancer | Maintain target % allocations across a portfolio of tokens |

## Requirements

- Node.js 18+
- A Solana wallet with SOL for transaction fees
- A dedicated RPC endpoint (Helius or QuickNode recommended -- public RPC is rate-limited)

## Setup

1. Clone and install dependencies:
   npm install

2. Copy the example env file and fill in your values:
   cp env.example .env

3. Edit .env with your RPC endpoint, wallet private key, and strategy config.

4. Build and run:
   npm run build
   npm start

   Or run in dev mode (no build step):
   npm run dev

## Security Notes

- NEVER commit your .env file or share your private key
- Add .env to your .gitignore
- Test with small amounts first
- This bot executes real transactions on mainnet -- use at your own risk

## Token Mints (Common)

| Token | Mint Address |
|---|---|
| SOL (wrapped) | So11111111111111111111111111111111111111112 |
| USDC | EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v |
| USDT | Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB |

## UI Dashboard

The bot includes a full web UI for wallet management, fund transfers, and strategy control.

### UI Setup

1. Install UI dependencies:
   ```bash
   cd ui && npm install
   ```

2. Run backend + UI together (recommended):
   ```bash
   npm run full:dev
   ```
   - Backend API + strategy engine: http://localhost:3000
   - Vite dev server (UI):          http://localhost:5173

3. Or build the UI for production (served by the Express backend):
   ```bash
   npm run ui:build
   npm start
   # Visit http://localhost:3000
   ```

### UI Pages

| Page | Description |
|---|---|
| Dashboard | Trading wallet balance, active strategy count, P&L, recent trades |
| Wallets | Generate new wallet, import existing key, set active trading wallet |
| Transfer | Move SOL/tokens between cold wallet (Phantom) and trading wallet |
| Strategies | Toggle all 4 strategies on/off at runtime |
| Trades | Full sortable/filterable trade history with Solscan links |

### Wallet Security

- Trading wallet private keys are encrypted with **AES-256-CBC + PBKDF2** using your password
- Encrypted keys are stored in `wallets.json` -- back this file up securely
- Your password is never stored -- it is only used to decrypt the key in memory at runtime
- To send funds OUT of the trading wallet, the UI requires your password at transfer time
- For cold -> trading transfers, your Phantom wallet signs the transaction locally -- the backend never sees your cold wallet key
- Add `wallets.json` and `.env` to `.gitignore` before committing

## Architecture

```
src/
  config.ts                    # All config loaded from .env
  wallet.ts                    # Keypair and connection management
  walletManager.ts             # Generate/import/encrypt/activate wallets
  transferSOL.ts               # SOL transfer between addresses
  transferSPL.ts               # SPL token transfer between addresses
  tradeLog.ts                  # Append swap results to trades.json
  price.ts                     # Jupiter Price API integration
  swap.ts                      # Jupiter swap execution
  server.ts                    # Express REST API + static UI serving
  index.ts                     # Entry point -- starts server + strategies
  strategies/
    dca.ts                     # DCA strategy
    limitOrder.ts              # Limit order strategy
    takeProfitStopLoss.ts      # TP/SL strategy
    rebalance.ts               # Portfolio rebalancer
ui/
  src/
    pages/                     # Dashboard, Wallets, Transfer, Strategies, Trades
    components/                # Navbar, BalanceCard, StrategyCard, TradeRow
    context/                   # Solana wallet-adapter provider
    api.ts                     # Typed fetch wrapper for backend API
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| RPC_ENDPOINT | Solana RPC URL | required |
| WALLET_PRIVATE_KEY | Base58 private key | required |
| SLIPPAGE_BPS | Slippage in basis points | 50 |
| ENABLED_STRATEGIES | Comma-separated strategy names | dca |
| DCA_TOKEN_MINT | Token to buy via DCA | SOL |
| DCA_AMOUNT_USD | USD amount per DCA buy | 10 |
| DCA_CRON | Cron schedule for DCA | 0 9 * * * |
| DCA_INPUT_MINT | Input token for DCA (spend token) | USDC |
| LIMIT_TOKEN_MINT | Token to watch for limit orders | SOL |
| LIMIT_BUY_PRICE | Buy trigger price in USD | 0 |
| LIMIT_SELL_PRICE | Sell trigger price in USD | 999999 |
| LIMIT_AMOUNT_USD | USD amount for limit orders | 50 |
| LIMIT_POLL_SECONDS | Price poll interval | 30 |
| TPSL_TOKEN_MINT | Token to watch for TP/SL | SOL |
| TPSL_ENTRY_PRICE | Entry price in USD | required |
| TPSL_TAKE_PROFIT_PCT | Take profit % above entry | 20 |
| TPSL_STOP_LOSS_PCT | Stop loss % below entry | 10 |
| TPSL_SELL_AMOUNT | Token units to sell (smallest unit) | 1000000000 |
| TPSL_POLL_SECONDS | Price poll interval | 15 |
| REBALANCE_TARGETS | JSON array of {mint, targetPct} | [] |
| REBALANCE_THRESHOLD_PCT | Drift % before rebalancing | 5 |
| REBALANCE_CRON | Cron schedule for rebalancing | 0 0 * * 0 |
