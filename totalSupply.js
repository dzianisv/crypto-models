const fs = require("fs");
const path = require("path");


const Assets = {
  USDT: 1,
  USDC: 2
};

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Define Ethereum, L2 chains, and other specific chains of interest
const ETH_CHAIN = "Ethereum";
const L2_CHAINS = ["Optimism", "Arbitrum", "Polygon", "zkSync", "Base", "StarkNet", "Scroll", ];

/**
 * Check if the cached data is still valid.
 */
function isCacheValid(cacheFilePath) {
  if (!fs.existsSync(cacheFilePath)) return false;

  const stats = fs.statSync(cacheFilePath);
  const now = Date.now();

  return now - stats.mtimeMs < CACHE_TTL; // Check if the file is within the TTL
}

/**
 * Load data from the cache file.
 */
function loadCache(cacheFilePath) {
  if (fs.existsSync(cacheFilePath)) {
    const data = fs.readFileSync(cacheFilePath, "utf8");
    return JSON.parse(data);
  }
  return null;
}

/**
 * Save data to the cache file.
 */
function saveCache(cacheFilePath, data) {
  fs.writeFileSync(cacheFilePath, JSON.stringify(data, null, 2), "utf8");
}

/**
 * Fetch and process stablecoin data for a specific asset.
 * @param {number} assetId - The ID of the asset (e.g., USDT = 1).
 */
async function getStableCoinCirculation(assetId) {
  let data;
  // Define constants
  const CACHE_FILE = path.join(__dirname, `${assetId}.cache.json`);

  // Check if cache is valid
  if (isCacheValid(CACHE_FILE)) {
    console.log("Using cached data...");
    data = loadCache(CACHE_FILE);
  } else {
    console.log("Fetching fresh data from API...");
    const response = await fetch(`https://stablecoins.llama.fi/stablecoin/${assetId}`);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    data = await response.json();

    // Save the fresh data to the cache
    saveCache(CACHE_FILE, data);
  }

  processStablecoinData(data);
}

/**
 * Process and display stablecoin data.
 */
function processStablecoinData(data) {
  if (!data || !data.chainBalances) {
    throw new Error("Invalid data format.");
  }

  const ethL1L2Key = "Ethereum L1 + L2";
  const chainBalances = data.chainBalances;
  let totalSupplyByChain = {[ethL1L2Key]: 0};


  // Iterate over chain balances to calculate total supply
  for (const [chain, balances] of Object.entries(chainBalances)) {
    // Get the latest balance for the chain
    const latestBalance = balances.tokens?.[balances.tokens.length - 1];

    if (latestBalance && latestBalance.circulating?.peggedUSD) {
      const totalSupply = latestBalance.circulating.peggedUSD;

      // Add to total supply by chain
      totalSupplyByChain[chain] = totalSupply;

      // If the chain is Ethereum or an L2 chain, add to the combined total
      if (chain === ETH_CHAIN || L2_CHAINS.includes(chain)) {
        totalSupplyByChain[ethL1L2Key]  += totalSupply;
      }
    }
  }
  return totalSupplyByChain;
}


function merge(obj1, obj2) {
  const merged = { ...obj1 };

  for (const key in obj2) {
    if (merged.hasOwnProperty(key)) {
      merged[key] += obj2[key];
    } else {
      merged[key] = obj2[key];
    }
  }
  return merged;
}

async function main() {
  // Run the script for USDT (assetId = 1)
  const usdtTotalSupply = await getStableCoinCirculation(Assets.USDT);
  const usdcTotalSupply = await getStableCoinCirculation(Assets.USDC);
  const totalSupply = merge(usdtTotalSupply, usdcTotalSupply);
  for (const symbol of ['Ethereum L1 + L2', 'Solana', 'TON', 'Avalanche', 'Near', 'Aptos', 'Sui']) {
    console.log(symbol, totalSupply[symbol]);
  }
}

main().catch(console.error);