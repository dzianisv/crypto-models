import {getStableCoinsTotalSupply} from "./stableCoinTotalSupply.js";

/**
 * Fetches data from a given URL with a retry mechanism for handling rate limits.
 * @param {string} url - The URL to fetch.
 * @param {object} options - Fetch options.
 * @param {number} maxRetries - Maximum number of retries.
 * @param {number} retryDelay - Initial delay before retrying (in milliseconds).
 * @returns {Promise<Response|null>} - The fetch response or null if all retries fail.
 */
async function fetchWithRetry(url, options = {}, maxRetries = 3, retryDelay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (response.status === 429) { // Too Many Requests
                const retryAfter = response.headers.get('Retry-After');
                const delay = retryAfter ? parseInt(retryAfter) * 1000 : retryDelay * attempt;
                console.warn(`Rate limited. Retrying in ${delay} ms... (Attempt ${attempt}/${maxRetries})`);
                await new Promise(res => setTimeout(res, delay));
            } else if (!response.ok) {
                console.error(`Error fetching URL: ${url} - ${response.status} ${response.statusText}`);
                return null;
            } else {
                return response;
            }
        } catch (error) {
            console.error(`Exception during fetch: ${error}. Retrying... (Attempt ${attempt}/${maxRetries})`);
            await new Promise(res => setTimeout(res, retryDelay * attempt));
        }
    }
    console.error(`Failed to fetch URL after ${maxRetries} attempts: ${url}`);
    return null;
}

/**
 * Fetches the current market capitalization (in USD) of the token from CoinGecko.
 * @param {string} tokenId - The CoinGecko ID of the token.
 * @returns {Promise<number|null>} - The market cap in USD or null if not found.
 */
async function getTokenMarketCap(tokenId) {
    // Directly call CoinGecko from the browser (they allow CORS) to reduce load on serverless functions.
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(tokenId)}&order=market_cap_desc&per_page=1&page=1&sparkline=false`;
    const response = await fetchWithRetry(url);
    if (!response) {
        console.error(`Could not fetch market cap for token: ${tokenId}`);
        return null;
    }
    try {
        const data = await response.json();
        if (data && data.length > 0 && data[0].market_cap !== undefined) {
            return data[0].market_cap;
        } else {
            console.error(`Market cap data for ${tokenId} not found.`);
            return null;
        }
    } catch (error) {
        console.error(`Error parsing JSON for token market cap (${tokenId}):`, error);
        return null;
    }
}

/**
 * Fetch market caps for multiple token IDs in one request.
 * Returns a map { tokenId: market_cap }
 */
async function getMultipleMarketCaps(tokenIds) {
    if (!tokenIds || tokenIds.length === 0) return {};
    const idsParam = tokenIds.map(encodeURIComponent).join(',');
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${idsParam}&order=market_cap_desc&per_page=250&page=1&sparkline=false`;
    const response = await fetchWithRetry(url);
    if (!response) {
        console.error('Could not fetch multiple market caps');
        return {};
    }
    try {
        const data = await response.json();
        const map = {};
        data.forEach(item => {
            if (item && item.id) map[item.id] = item.market_cap || null;
        });
        return map;
    } catch (e) {
        console.error('Error parsing multiple market caps JSON', e);
        return {};
    }
}

/**
 * Fetches historical stablecoin supply data.
 * @param {number} days - Number of days of historical data.
 * @returns {Promise<Object|null>} - Object with chain names as keys and arrays of [timestamp, supply] as values.
 */
async function getHistoricalStableCoinsSupply(days = 30) {
    // For simplicity, we'll use current data for all historical points
    // In a real implementation, you'd need to fetch historical stablecoin data
    const currentSupply = await getStableCoinsTotalSupply();
    
    // Create mock historical data by using current values for all days
    // This is a simplification - real historical stablecoin data would be more complex
    const historicalData = {};
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    for (let i = days; i >= 0; i--) {
        const date = now - (i * dayMs);
        Object.keys(currentSupply).forEach(chain => {
            if (!historicalData[chain]) historicalData[chain] = [];
            historicalData[chain].push([date, currentSupply[chain]]);
        });
    }
    
    return historicalData;
}

/**
 * Main function to compute and return Market Cap to TVL ratios for predefined tokens.
 */
export async function getRatiosData(days = 365) {
    // Prefer server-side aggregated historical ratios when available (faster and avoids CORS)
    try {
            // Try the proxy route first (/api/ratios). If that fails in some
            // Netlify setups or due to a CDN/proxy issue, fall back to the
            // direct functions path (/.netlify/functions/ratios)
            let res = await fetchWithRetry(`/api/ratios?days=${days}`);
            if (res && res.ok) {
                const json = await res.json();
                return json;
            }

            console.warn('/api/ratios failed, trying direct function path');
            res = await fetchWithRetry(`/.netlify/functions/ratios?days=${days}`);
            if (res && res.ok) {
                const json = await res.json();
                return json;
            }
    } catch (e) {
        console.warn('Failed to fetch server-side ratios, falling back to client-side generation:', e && e.message);
    }

    // Fallback to minimal mock data if server-side function is not available
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // current results (mocked)
    const currentResults = [
        { name: "Ethereum", marketCap: 300000000000, stableSupply: 100000000000, ratio: 3.0 },
        { name: "Solana", marketCap: 50000000000, stableSupply: 20000000000, ratio: 2.5 },
        { name: "TON", marketCap: 10000000000, stableSupply: 5000000000, ratio: 2.0 },
        { name: "Avalanche", marketCap: 5000000000, stableSupply: 3000000000, ratio: 1.67 },
        { name: "Tron", marketCap: 8000000000, stableSupply: 6000000000, ratio: 1.33 },
        { name: "Sui", marketCap: 2000000000, stableSupply: 1000000000, ratio: 2.0 },
        { name: "Aptos", marketCap: 1500000000, stableSupply: 800000000, ratio: 1.88 },
        { name: "Near", marketCap: 3000000000, stableSupply: 1500000000, ratio: 2.0 },
        { name: "Polkadot", marketCap: 7000000000, stableSupply: 4000000000, ratio: 1.75 }
    ];

    // Build per-chain historical mock data: chains array + data array where each point has per-chain values
    const chains = currentResults.map(r => ({ name: r.name }));
    const historicalData = [];

    for (let i = days; i >= 0; i--) {
        const timestamp = now - (i * dayMs);
        const point = { timestamp };

        // Give each chain a slightly different base and noise so lines are distinguishable
        currentResults.forEach((r, idx) => {
            const base = Math.max(0.5, r.ratio || 1.5);
            // cycle variation by index so lines don't overlap exactly
            const seasonal = Math.sin((i / days) * Math.PI * 2 + idx) * 0.2;
            const noise = (Math.random() - 0.5) * 0.15;
            const value = Math.max(0.01, base + seasonal + noise);
            point[r.name] = Number(value.toFixed(4));
        });

        historicalData.push(point);
    }

    return {
        current: currentResults,
        historical: {
            chains: chains,
            data: historicalData
        }
    };
}