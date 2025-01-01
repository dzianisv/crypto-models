import os
import json
import requests
import pandas as pd
from datetime import datetime, timedelta

CACHE_TTL = timedelta(hours=24)  # 24 hours

# Define Ethereum, L2 chains, and other specific chains of interest
ETH_CHAIN = "Ethereum"
L2_CHAINS = ["Optimism", "Arbitrum", "Polygon", "zkSync", "Base", "StarkNet", "Scroll"]

def is_cache_valid(cache_file_path):
    if not os.path.exists(cache_file_path):
        return False

    file_mtime = datetime.fromtimestamp(os.path.getmtime(cache_file_path))
    now = datetime.now()

    return now - file_mtime < CACHE_TTL

def load_cache(cache_file_path):
    if os.path.exists(cache_file_path):
        with open(cache_file_path, 'r') as file:
            return json.load(file)
    return None

def save_cache(cache_file_path, data):
    with open(cache_file_path, 'w') as file:
        json.dump(data, file, indent=2)

def get_stablecoin_circulation(asset_id):
    cache_dir = os.path.join(os.path.dirname(__file__), '.cache')
    os.makedirs(cache_dir, exist_ok=True)

    cache_file = os.path.join(cache_dir, f'{asset_id}.json')

    if is_cache_valid(cache_file):
        data = load_cache(cache_file)
    else:
        url = f'https://stablecoins.llama.fi/stablecoin/{asset_id}'
        print(f'GET {url}')
        response = requests.get(url)

        if not response.ok:
            raise Exception(f'HTTP Error: {response.status_code}')

        data = response.json()
        save_cache(cache_file, data)

    return process_stablecoin_data(data)

def process_stablecoin_data(data):
    if not data or 'chainBalances' not in data:
        raise Exception("Invalid data format.")

    eth_l1_l2_key = "Ethereum L1 + L2"
    chain_balances = data['chainBalances']
    records = []

    for chain, balances in chain_balances.items():
        for token in balances.get('tokens', []):
            date = datetime.utcfromtimestamp(token['date']).strftime('%Y-%m-%d')
            supply = token.get('circulating', {}).get('peggedUSD', 0)
            records.append({'Date': date, 'Chain': chain, 'Supply': supply})

    # Convert the records to a DataFrame
    df = pd.DataFrame(records)
    df = df.pivot(index='Date', columns='Chain', values='Supply').fillna(0)
    return df


def fetch_and_cache_assets():
    cache_dir = os.path.join(os.path.dirname(__file__), '.cache')
    os.makedirs(cache_dir, exist_ok=True)

    cache_file_path = os.path.join(cache_dir, 'assets.json')

    if is_cache_valid(cache_file_path):
        return load_cache(cache_file_path)
    else:
        url = "https://stablecoins.llama.fi/stablecoins"
        print(f'GET {url}')
        response = requests.get(url)

        if not response.ok:
            raise Exception(f'HTTP Error: {response.status_code}')

        data = response.json()
        fiat_backed_assets = [asset for asset in data['peggedAssets'] if asset['pegMechanism'] == "fiat-backed"]
        save_cache(cache_file_path, fiat_backed_assets)

        return fiat_backed_assets

def get_stablecoins_total_supply():
    total_supply_df = pd.DataFrame()
    assets = fetch_and_cache_assets()

    for asset in assets:
        print(f'Fetching total supply of {asset["name"]}...')
        token_total_supply_df = get_stablecoin_circulation(asset['id'])
        # return token_total_supply_df
        total_supply_df = total_supply_df.add(token_total_supply_df, fill_value=0)

    return total_supply_df

def plot_stablecoin_supply(df):
    import matplotlib.pyplot as plt

    # Plot each chain's supply over time
    df.plot(figsize=(14, 8), title='Stablecoin Supply per Chain')
    
    # Set labels and title
    plt.xlabel('Date')
    plt.ylabel('Supply (USD)')
    plt.title('Stablecoin Supply per Chain Over Time')
    
    # Show the plot
    plt.legend(title='Chain',  loc='upper left')
    plt.tight_layout()
    plt.show()

def get_filtered_stablecoins_total_supply(chains = ["Ethereum", "TON", "Avalanche", "Solana"]):
    total_supply_df = get_stablecoins_total_supply()
    # Define L2 chains to merge with Ethereum
    l2_chains = ["Base", "Optimism", "Arbitrum", "Polygon", "zkSync Lite", "StarkNet", "Scroll"]
     # Create a new column for Ethereum + L2
    total_supply_df['Ethereum'] = total_supply_df['Ethereum'] + total_supply_df[l2_chains].sum(axis=1)
    return total_supply_df[chains]

if __name__ == "__main__":
    total_supply_df = get_filtered_stablecoins_total_supply()
    plot_stablecoin_supply(total_supply_df)