import json
import os

json1_name = "total_ohlc_ETH.json"
json2_name = "ohlc_data_ETH2.json"

if os.path.exists(json1_name):
    with open(json1_name, 'r') as json_file:
        json1 = json.load(json_file)

if os.path.exists(json2_name):
    with open(json2_name, 'r') as json_file:
        json2 = json.load(json_file)



# Merge the two lists
merged_data =  json2 + json1

# Convert the merged data back to JSON format
# Keeping the format of the first JSON
merged_json = json.dumps(merged_data, indent=4)

file_path = 'total_ohcl_ETH.json'

with open(file_path, 'w') as file:
    json.dump(merged_data, file, indent=4)