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
 * Main function to compute and display Market Cap to TVL ratios for predefined tokens.
 */
async function main() {
    const tokensAndChains = [
        { name: "Ethereum", tokenId: "ethereum", stableCoinSupplyKey: "Ethereum L1 + L2" },
        { name: "Solana", tokenId: "solana"  },
        { name: "TON", tokenId: "the-open-network" },
        { name: "Avalanche", tokenId: "avalanche-2" }, 
        { name: "Tron", tokenId: "tron" },
        { name: "Sui", tokenId: "sui" },
        { name: "Aptos", tokenId: "aptos" },
        { name: "Near", tokenId: "near" },
        { name: "Polkadot", tokenId: "polkadot" }
    ];

    const allStableCoinsSupply = await getStableCoinsTotalSupply();

    console.log("Market Cap to Fiat StableCoins Total Supply");
    for (const { name, tokenId, stableCoinSupplyKey } of tokensAndChains) {
        const marketCap = await getTokenMarketCap(tokenId);
        const stableCoinsTotalSupply = allStableCoinsSupply[stableCoinSupplyKey || name];
        const ratio = marketCap / stableCoinsTotalSupply;
        console.log(`- ${name}:\t${ratio}`)
    }
}


main().catch(console.error);