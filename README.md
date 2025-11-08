# Crypto Models - Market Cap to Stablecoin Supply Ratios

A realtime web application that displays market capitalization to stablecoin supply ratios for various blockchain networks.

## Features

- Real-time data fetching from CoinGecko and DefiLlama APIs
- Automatic updates every 5 minutes
- Responsive web interface
- Client-side caching for improved performance

## Technologies Used

- HTML5, CSS3, JavaScript (ES6 Modules)
- Chart.js for data visualization
- CoinGecko API for market data
- DefiLlama API for stablecoin data

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Open http://localhost:3000 in your browser

If you need to test the Netlify serverless function locally (recommended for validating CoinGecko proxying and avoiding CORS issues), install the Netlify CLI and run the local dev environment which serves functions under `/api/*`:

```bash
# install once (optional)
npm install -g netlify-cli

# run the local dev server (serves functions and static files)
npx netlify dev
```

This will run a local server that proxies `/api/*` to the function in `netlify/functions/` so the browser can call `/api/coingecko` just like in production.

## Deployment to Netlify

1. Push this code to a GitHub repository
2. Connect your GitHub account to Netlify
3. Create a new site from your repository
4. Netlify will automatically detect the `netlify.toml` configuration and deploy the static site
5. Your site will be live with automatic deployments on every push

## Data Sources

- **Market Caps**: CoinGecko API
- **Stablecoin Supplies**: DefiLlama Stablecoins API

## License

MIT