import fs from "fs";
import path from "path"

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);;

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

  const cacheDir = path.join(__dirname, '.cache');

  // Check if the cache directory exists, if not, create it
  if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir);
  }

  const cache_file = path.join(cacheDir, `${assetId}.json`);

  // Check if cache is valid
  if (isCacheValid(cache_file)) {
    data = loadCache(cache_file);
  } else {
    const url = `https://stablecoins.llama.fi/stablecoin/${assetId}`;
    console.log(`GET ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    data = await response.json();

    // Save the fresh data to the cache
    saveCache(cache_file, data);
  }

  return processStablecoinData(data);
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

/**
 * Fetch and cache the list of assets from the API.
 */
async function fetchAndCacheAssets() {
  const cacheDir = path.join(__dirname, '.cache');
  const cacheFilePath = path.join(cacheDir, 'assets.json');

  // Check if the cache directory exists, if not, create it
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir);
  }

  // Check if cache is valid
  if (isCacheValid(cacheFilePath)) {
    return loadCache(cacheFilePath);
  } else {
    const url = "https://stablecoins.llama.fi/stablecoins";
    console.log(`GET ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();

    // Filter assets with "pegMechanism": "fiat-backed"
    const fiatBackedAssets = data.peggedAssets.filter(asset => asset.pegMechanism === "fiat-backed");

    // Save the filtered data to the cache
    saveCache(cacheFilePath, fiatBackedAssets);

    return fiatBackedAssets;
  }
}

// Update the getStableCoinsTotalSupply function to use the fetched assets
// returns object, key - chain name, value - array of [unix timestamp, total supply]
export async function getStableCoinsTotalSupply() {
  let totalSupply = {};
  const assets = await fetchAndCacheAssets();

  for (let asset of assets) {
    console.log(`Fetching total supply of ${asset.name}...`);
    const tokenTotalSupply = await getStableCoinCirculation(asset.id);
    totalSupply = merge(totalSupply, tokenTotalSupply);
  }

  return totalSupply;
}