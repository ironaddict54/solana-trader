// Jupiter Price API v3 - fetch USD price for any token mint

const JUPITER_PRICE_API = "https://price.jup.ag/v6/price";

export interface TokenPrice {
  mint: string;
  usdPrice: number;
  timestamp: number;
}

export async function getTokenPrice(mint: string): Promise<TokenPrice> {
  const url = `${JUPITER_PRICE_API}?ids=${mint}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Jupiter price API error: ${res.status} ${res.statusText}`);
  }
  const json = await res.json() as { data: Record<string, { price: number }> };
  const entry = json.data[mint];
  if (!entry) {
    throw new Error(`No price data returned for mint: ${mint}`);
  }
  return {
    mint,
    usdPrice: entry.price,
    timestamp: Date.now(),
  };
}

export async function getMultipleTokenPrices(mints: string[]): Promise<Map<string, TokenPrice>> {
  const url = `${JUPITER_PRICE_API}?ids=${mints.join(",")}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Jupiter price API error: ${res.status} ${res.statusText}`);
  }
  const json = await res.json() as { data: Record<string, { price: number }> };
  const result = new Map<string, TokenPrice>();
  for (const mint of mints) {
    const entry = json.data[mint];
    if (entry) {
      result.set(mint, { mint, usdPrice: entry.price, timestamp: Date.now() });
    }
  }
  return result;
}
