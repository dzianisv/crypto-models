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

def get_historical_token_price_df(tokens):
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

def main():
    chains = [
        {"name": "Ethereum", "token_id": "ethereum"},
        {"name": "Solana", "token_id": "solana"},
        {"name": "TON", "token_id": "the-open-network"},
        {"name": "Avalanche", "token_id": "avalanche-2"},
        {"name": "Tron", "token_id": "tron"},
        {"name": "Near", "token_id": "near"},
        # {"name": "Polkadot", "token_id": "polkadot"}
        {"name": "Aptos", "token_id": "aptos"},
        {"name": "Near", "token_id": "near"},
    ]

    stablecoin_total_supply_df = get_filtered_stablecoins_total_supply(chains = [chain["name"] for chain in chains])
    if stablecoin_total_supply_df is None or stablecoin_total_supply_df.empty:
        print("Stablecoin total supply data is not available.")
        return

    historical_prices_df = get_historical_market_cap_df(chains)

    # Filter both DataFrames to only include the common dates
    common_dates = historical_prices_df.index.intersection(stablecoin_total_supply_df.index)

    historical_prices_df = historical_prices_df.loc[common_dates]
    stablecoin_total_supply_df = stablecoin_total_supply_df.loc[common_dates]

    print("Historical Prices")
    print(historical_prices_df)
    print("Stable Coins Total Supply")
    print(stablecoin_total_supply_df)

    historical_prices_df = historical_prices_df.loc[stablecoin_total_supply_df.index]
    stablecoin_total_supply_df = stablecoin_total_supply_df.loc[historical_prices_df.index]

    # Calculate the ratio of market cap to total supply
    ratio_df = historical_prices_df / stablecoin_total_supply_df

    print("Market cap to Total Supply")
    print(ratio_df)
    # Plot each chain's supply over time
    ratio_df.plot(figsize=(14, 8), title='Stablecoin Supply per Chain')
    
    # Set labels and title
    plt.xlabel('Date')
    plt.ylabel('Market Cap / USD Total Supply')
    plt.title('')
    
    # Show the plot
    plt.legend(title='Chain',  loc='upper left')
    plt.tight_layout()
    plt.savefig('total_cap_to_stablecoin.png')
    plt.show()


if __name__ == "__main__":
    main() 