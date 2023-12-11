import { EtherscanProvider, Networkish, BlockTag } from 'ethers'; //^v6
import { fetchHttpJson } from '../../utils/fetchUtils.js';

export default class MyEtherscanProvider {
    #API_KEYS : string;

    #endpoint: string;
    constructor(apiKey?: string) {
        this.#API_KEYS = apiKey;
        this.#endpoint = 'https://api.etherscan.io/';
        // const endpoints = fetchJsonFile('src/modules/api-endpoints/endpoints.json');
        // this.#endpoint = endpoints[nameNetwork];
        // this.#API_KEYS  = process.env['API_' + nameNetwork];
    }
    


    async getNormalTransactions( address: string, startBlock: number, endBlock: number = 99999999, offset: number = 100) {
        const parameters = `api`        +
            `?module=account`           +
            `&action=txlist`            +
            `&address=${address}`       +
            `&startblock=${startBlock}` +
            `&endblock=${endBlock}`     +
            `&page=1`                   +
            `&offset=${offset}`         +
            `&sort=asc`                 +
            `&apikey=${this.#API_KEYS}`;
            
        const response = await fetchHttpJson(this.#endpoint + parameters);
        if (response.message == 'No transactions found') {
            console.log('No transaction found for this chain : ' + this.#endpoint);
        }
        else {
            if(response.status !== "1" || response.message !== "OK") {
                console.log(response);
                throw new Error(`error getNormalTransactions (network : ${this.#endpoint} / address : ${address}) -> ${response.message}`);
            }    
        }
        
        return response.result;
    }
}
