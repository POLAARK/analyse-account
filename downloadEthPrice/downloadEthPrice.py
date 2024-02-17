import requests
import json
import time
import argparse
import os
from datetime import datetime

def read_params_from_file(file_path):
    params = {}
    with open(file_path, 'r') as file:
        for line in file:
            key, value = line.strip().split('=')
            params[key] = value
    return params

file_params = read_params_from_file('config.txt')

# Set up argument parser
parser = argparse.ArgumentParser(description='Fetch OHLC data for a specific token and save to a JSON file.')
parser.add_argument('--start_timestamp', type=int, help='Starting timestamp for the data fetch. Optional if continuing from file.')
parser.add_argument('--end_timestamp', type=int, help='Ending timestamp for the data fetch. Defaults to current time.')
args = parser.parse_args()

# Function to send request and return data
def get_data(url, params):
    response = requests.get(url, params=params)
    # if current_start == 1680592680:
    #     print(response.json())
    if response.status_code != 200:
        raise Exception("API request failed with status code " + str(response.status_code))
    return response.json()

# Function to get the last timestamp from the file
def get_last_timestamp(file_name):
    if os.path.exists(file_name):
        with open(file_name, 'r') as file:
            data = json.load(file)
            if data:
                return data[-1]['timestamp_close']
    return None

# Constants
MAX_RECORDS_PER_REQUEST = 2500
SECONDS_PER_MINUTE = 60
filename = 'ohlc_data_ETH2.json'

# Determine start and end timestamps
last_timestamp = get_last_timestamp(filename)
current_start = args.start_timestamp if args.start_timestamp is not None else last_timestamp + 1 if last_timestamp else int(time.mktime(datetime.now().timetuple()))   # Default to 30 days ago if no file and no argument
current_end = args.end_timestamp if args.end_timestamp is not None else int(time.mktime(datetime.now().timetuple()))

if current_start == current_end: 
    raise Exception("Input strating timestamp")
# Rest of the script remains the same as previously provided...
# Initial URL and parameters
url = 'https://api.syve.ai/v1/price/historical/ohlc'
base_params = {
    'key': file_params['API_KEY'],
    'token_address': '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
    'pool_address': '0x4028DAAC072e492d34a3Afdbef0ba7e35D8b55C4',
    'price_type': 'price_token_usd_robust_tick_1',
    'interval': '1m',
    'max_size': '2500',
}

# Initialize an empty list to store new data
new_data = []

# Fetch data in chunks
while current_start < current_end:
    
    next_end = min(current_start + (MAX_RECORDS_PER_REQUEST * SECONDS_PER_MINUTE), current_end)
    print(current_start, next_end)
    params = base_params.copy()
    params.update({'from_timestamp': current_start, 'until_timestamp': next_end})

    # Fetch and accumulate data
    response = get_data(url, params)
    new_data = response['data'] + new_data  

    # Update the start timestamp for the next request
    current_start = next_end

    # Optional: sleep to avoid hitting the API rate limit
    time.sleep(1)

# Load existing data and append new data, then write back to the file
if os.path.exists(filename):
    with open(filename, 'r') as file:
        existing_data = json.load(file)
else:
    existing_data = []

existing_data.extend(new_data)

with open(filename, 'w') as file:
    json.dump(existing_data, file, indent=4)