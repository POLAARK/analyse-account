import csv
import json
import os

# File paths
csv_filename = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.csv'
json_filename = 'ohlc_data_ETH2.json'
new_file_name = 'total_ohlc_ETH2.json'
# Read CSV data
csv_data = []
with open(csv_filename, mode='r') as csv_file:
    csv_reader = csv.DictReader(csv_file)
    for row in csv_reader:
        # Convert CSV data to the same format as JSON data
        formatted_row = {
            'timestamp_open': int(row['timestamp']),
            'date_open': row['date'],
            'price_open': float(row['price_open']),
            'price_high': float(row['price_high']),
            'price_low': float(row['price_low']),
            'price_close': float(row['price_close']),
        }
        csv_data.append(formatted_row)

# Read JSON data
json_data = []
if os.path.exists(json_filename):
    with open(json_filename, 'r') as json_file:
        json_data = json.load(json_file)
new_json_data= []
for data in json_data:
    new_json_data.append({            
            'timestamp_open': int(data['timestamp_open']),
            'date_open': data['date_open'],
            'price_open': float(data['price_open']),
            'price_high': float(data['price_high']),
            'price_low': float(data['price_low']),
            'price_close': float(data['price_close']),
            })

# Merge CSV and JSON data, assuming CSV data is older and should come first
merged_data = new_json_data + csv_data

# Write merged data to JSON file
with open(new_file_name, 'w') as json_file:
    json.dump(merged_data, json_file, indent=4)
