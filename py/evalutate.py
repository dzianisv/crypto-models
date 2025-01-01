import requests
import pandas as pd
import matplotlib.pyplot as plt
from stable import get_filtered_stablecoins_total_supply
import time
import matplotlib.pyplot as plt
from pycoingecko import CoinGeckoAPI
from datetime import datetime, timedelta
import os
import json

def get_historical_price_df(tokens):
    df_list = []  # List to store individual token dataframes
    cg = CoinGeckoAPI()
    
    # Calculate timestamps for the last 365 days
    end_date = datetime.now()
    start_date = end_date - timedelta(days=365)
    from_timestamp = int(start_date.timestamp())
    to_timestamp = int(end_date.timestamp())
    
    # Ensure cache directory exists
    cache_dir = '.cache'
    os.makedirs(cache_dir, exist_ok=True)
    
    for token in tokens:
        name, token_id = token['name'], token['token_id']
        cache_file = os.path.join(cache_dir, f"{name}.json")
        
        # Check if cache file exists and is valid
        if os.path.exists(cache_file):
            file_mod_time = datetime.fromtimestamp(os.path.getmtime(cache_file))
            if datetime.now() - file_mod_time < timedelta(days=1):
                with open(cache_file, 'r') as f:
                    data = json.load(f)
            else:
                data = fetch_and_cache_data(cg, token_id, from_timestamp, to_timestamp, cache_file)
        else:
            data = fetch_and_cache_data(cg, token_id, from_timestamp, to_timestamp, cache_file)

        # Convert data to pandas DataFrame
        df = pd.DataFrame(data['prices'], columns=['Date', name])
        df['Date'] = pd.to_datetime(df['Date'], unit='ms')
        df.set_index('Date', inplace=True)  # Set 'Date' as the index
        df_list.append(df)  # Append the dataframe to the list

    # Merge all dataframes on the 'Date' index
    merged_df = pd.concat(df_list, axis=1)
    return merged_df

def get_historical_market_cap_df(tokens):
    df_list = []  # List to store individual token dataframes
    cg = CoinGeckoAPI()
    
    # Calculate timestamps for the last 365 days
    end_date = datetime.now()
    start_date = end_date - timedelta(days=365)
    from_timestamp = int(start_date.timestamp())
    to_timestamp = int(end_date.timestamp())
    
    # Ensure cache directory exists
    cache_dir = '.cache'
    os.makedirs(cache_dir, exist_ok=True)
    
    for token in tokens:
        name, token_id = token['name'], token['token_id']
        cache_file = os.path.join(cache_dir, f"{name}.json")
        
        # Check if cache file exists and is valid
        if os.path.exists(cache_file):
            file_mod_time = datetime.fromtimestamp(os.path.getmtime(cache_file))
            if datetime.now() - file_mod_time < timedelta(days=1):
                with open(cache_file, 'r') as f:
                    data = json.load(f)
            else:
                data = fetch_and_cache_data(cg, token_id, from_timestamp, to_timestamp, cache_file)
        else:
            data = fetch_and_cache_data(cg, token_id, from_timestamp, to_timestamp, cache_file)


        df = pd.DataFrame(data['market_caps'], columns=['Date', f"{name}"])
        df['Date'] = pd.to_datetime(df['Date'], unit='ms')
        df.set_index('Date', inplace=True)  # Set 'Date' as the index
        df_list.append(df)  # Append the dataframe to the list

    # Merge all dataframes on the 'Date' index
    merged_df = pd.concat(df_list, axis=1)
    return merged_df

def fetch_and_cache_data(cg, token_id, from_timestamp, to_timestamp, cache_file):
    data = cg.get_coin_market_chart_range_by_id(
        id=token_id, 
        vs_currency='usd', 
        from_timestamp=from_timestamp,  # Start date
        to_timestamp=to_timestamp       # End date
    )
    with open(cache_file, 'w') as f:
        json.dump(data, f)
    return data

def _get_historical_chain_tvl(chain_name):
    # Construct the API URL
    url = f"https://api.llama.fi/v2/historicalChainTvl/{chain_name}"
    params = {
        'chain': chain_name
    }
    
    response = requests.get(url, params=params)
    if response.status_code != 200:
        print(f"Could not fetch historical TVL data for chain: {chain_name}")
        return None
    try:
        data = response.json()
        # Assuming the API returns a list of TVL data points with 'date' and 'tvl' keys
        tvl_data = [(entry['date'], entry['tvl']) for entry in data]
        # Convert to DataFrame
        df = pd.DataFrame(tvl_data, columns=['Date', chain_name])
        df['Date'] = pd.to_datetime(df['Date'], unit='s')  # Convert to datetime
        df.set_index('Date', inplace=True)  # Set 'Date' as the index
        return df
    except Exception as e:
        print(f"Error parsing JSON for historical chain TVL ({chain_name}): {e}")
        return None
    
def get_historical_chain_tvl_df(chains):
    df_list = []  # List to store individual token dataframes
    cg = CoinGeckoAPI()
    
    # Calculate timestamps for the last 365 days
    end_date = datetime.now()
    start_date = end_date - timedelta(days=365)
    from_timestamp = int(start_date.timestamp())
    to_timestamp = int(end_date.timestamp())
    
    dfs = []
    for token in chains:
        name, token_id = token['name'], token['token_id']
        # cache_file = os.path.join(cache_dir, f"{name}.json")
        df = _get_historical_chain_tvl(name)
        dfs.append(df)
    
    return pd.concat(dfs, axis=1)

def compute_ratio(df1, df2):
    common_dates = df1.index.intersection(df2.index)
    print(df1.index)
    print(df2.index)
    df1 = df1.loc[common_dates]
    df2 = df2.loc[common_dates]
    return df1 / df2

def main():
    chains = [
        {"name": "Ethereum", "token_id": "ethereum"},
        {"name": "Solana", "token_id": "solana"},
        # {"name": "TON", "token_id": "the-open-network"},
        {"name": "Avalanche", "token_id": "avalanche-2"},
        {"name": "Tron", "token_id": "tron"},
        {"name": "Near", "token_id": "near"},
        {"name": "Aptos", "token_id": "aptos"},
    ]

    stablecoin_total_supply_df = get_filtered_stablecoins_total_supply(chains=[chain["name"] for chain in chains])
    if stablecoin_total_supply_df is None or stablecoin_total_supply_df.empty:
        print("Stablecoin total supply data is not available.")
        return

    market_cap_df = get_historical_market_cap_df(chains)
    tvl_df = get_historical_chain_tvl_df(chains)

    print("Market Cap by Chain")
    print(market_cap_df)

    print("TVL by Chain")
    print(stablecoin_total_supply_df)
    market_cap_to_total_supply = compute_ratio(market_cap_df, stablecoin_total_supply_df)
    market_cap_to_tlv = compute_ratio(market_cap_df, tvl_df)

    print("Market Cap to TVL by Chain")
    print(market_cap_to_tlv)
 
    # Plot Market Cap to Total Supply
    market_cap_to_total_supply.plot(figsize=(14, 8), title='Market Cap to Total Supply')
    plt.xlabel('Date')
    plt.ylabel('Market Cap / Total Supply')
    plt.legend(title='Chain', loc='upper left')
    plt.tight_layout()
    plt.savefig('market_cap_to_total_supply.png')
    plt.show()
    plt.close()

    # Plot Market Cap to TVL
    market_cap_to_tlv.plot(figsize=(14, 8), title='Market Cap to TVL')
    plt.title('Market Cap to TVL')
    plt.xlabel('Chain')
    plt.ylabel('Market Cap / TVL')
    plt.tight_layout()
    plt.savefig('market_cap_to_tvl.png')
    plt.show()

if __name__ == "__main__":
    main() 