import { EtherscanProvider, Networkish, BlockTag } from 'ethers'; //^v6
import { fetchHttpJson } from '../../utils/fetchUtils.js';

export default class MyEtherscanProvider {
    #API_KEYS : string;
    #RETRY_COUNT : number = 3;
    #endpoint: string;
    constructor(apiKey?: string) {
        this.#API_KEYS = apiKey;
        this.#endpoint = 'https://api.etherscan.io/';
        // const endpoints = fetchJsonFile('src/modules/api-endpoints/endpoints.json');
        // this.#endpoint = endpoints[nameNetwork];
        // this.#API_KEYS  = process.env['API_' + nameNetwork];
    }
    


    async getNormalTransactions( address: string, startBlock: number, endBlock: number = 99999999, offset: number = 2000) {
        const count = 0;
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
            let response : any; //TODO : proper Error typing
            //TODO: double check proper error handling
        try {
            response = await fetchHttpJson(this.#endpoint + parameters);
        }
        catch(error) {
            if (error.statusCode === 429 || error.message.includes("rate limit")) { 
                console.log("Rate limit reached, retrying in 15 minutes...");
                await new Promise(resolve => setTimeout(resolve, 900000));
                response = await fetchHttpJson(this.#endpoint + parameters);
            }
            else {
                throw Error(error);
            }
        }
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
    }ç
}
