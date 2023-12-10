import { TokenHistory  } from "src/model/historical-token-trading"
import { fetchHttpJsonHandlingTooManyRequest, isOccurenceInString } from "../../utils/utils.js"; 
import puppeteer, { Browser, Page } from "puppeteer";
import { randomInt } from "crypto";

export const ApiDebank = class ApiDebank {
    address : string;
    chains : string[] = ['eth', 'arb', 'avax', 'op', 'matic', 'bsc'];
    browser : Browser;
    page : Page;
    // notinterstingtoken : string[] = ['USD', 'ETH', 'BNB', 'AVAX'];
    token_traded : TokenHistory = {token_value_traded : [] , token_list : [], address : '', date : 0};
    not_intersting_token : string[] = ['USD', 'ETH', 'BNB', 'AVAX', 'EUR', 'MIM', 'DAI'];
    constructor(address : string) {
        this.address = address;
        this.token_traded.address = address;
    }

    getHistoryAccount(date : number = 0) : string {
        return `https://api.debank.com/history/list?user_addr=${this.address}&chain=&start_time=${date}&page_count=20`;
    }

    getHistoryToken(chain : string, id : string, date : number = 0) {
        return `https://api.debank.com/history/list?user_addr=${this.address}&chain=${chain}&start_time=${date}&page_count=20&token_id=${id}`;
    }


    async seeActions(date: number = 1672527600){
        this.browser = await puppeteer.launch({headless: false});
        this.page = await this.browser.newPage();
        this.page.setDefaultNavigationTimeout(0);
        let pageCounter : number = 0;
        let firstElementOfNewPage = true; 
        let url : string = this.getHistoryAccount();
        let historydata  = await this.fetchhttpJsonPuppeteer(`https://debank.com/profile/${this.address}/history`, url);
        await new Promise(r => setTimeout(r, randomInt(3000, 7000)));
        let token_dict = historydata.data.token_dict;
        let timestamp = historydata.data.history_list[historydata.data.history_list.length-1].time_at;
        let token_val_traded : number;
        while (timestamp > date && timestamp > this.token_traded.date) {
            for (let addr in token_dict){
                token_val_traded = 0;
                let token = token_dict[addr];
                if (isOccurenceInString(token.chain, this.chains)
                    && !isOccurenceInString(token.id, this.token_traded.token_list)
                    && !isOccurenceInString(token.symbol, this.not_intersting_token)
                    && (token.id.slice(0,2) == '0x')
                    && !isOccurenceInString(token.symbol, ['LP', '-']))
                    {
                    this.token_traded.token_list.push(token.id);
                    console.log(token.id, token.symbol);
                    if (!firstElementOfNewPage) {
                        console.log(pageCounter);
                        for (let i : number = 0; i < pageCounter; i ++) {
                            await this.fetchhttpJsonPuppeteerLoadNewPageWithoutJSON();
                        }
                    }
                    firstElementOfNewPage = false;
                    console.log('for passed')
                    token_val_traded = await this.calculTokenBalance(token.chain, token.id, token.symbol);
                    this.token_traded.token_value_traded.push({
                        token_name : token.symbol,
                        token_address : token.id,
                        chain : token.chain,
                        value : token_val_traded
                    });
                    this.token_traded.token_list.push(token.id);
                    console.log(token.symbol, token_val_traded);
                }
            }
            timestamp = historydata.data.history_list[historydata.data.history_list.length-1].time_at;
            for (let i : number = 0; i < pageCounter; i ++) {
                await this.fetchhttpJsonPuppeteerLoadNewPageWithoutJSON();
            }
            historydata  = await this.fetchhttpJsonPuppeteerLoadNewPage(this.getHistoryAccount(timestamp));
            console.log("passed");
            firstElementOfNewPage = true; 
            pageCounter += 1;
            await new Promise(r => setTimeout(r, randomInt(3000, 7000)));
            token_dict = historydata.data.token_dict;
        }
        this.token_traded.date = Date.now();
        // Close the browser
        await this.browser.close();
        return this.token_traded;
        
    }

    async calculTokenBalance(chain : string, id : string, symbol :string) {
        
        let token_history = await this.fetchhttpJsonPuppeteerTokenAnalysor( this.getHistoryToken(chain, id), id, chain, symbol);
        
        let timestamp : number;
        try {
            timestamp = token_history.data.history_list[token_history.data.history_list.length - 1].time_at;
        }
        catch(err) {
            timestamp = 0;
        }
        let value : number = 0;
        while(token_history.data.history_list.length != 0 ) {
            
            for (let token_trade of token_history.data.history_list){
                if (token_trade.cate_id == "approve") {
                    continue;
                }
                if (token_trade.receives.length == 0 && token_trade.sends.length == 0){
                    continue;
                }
                for ( let received of token_trade.receives){
                    if ( received.token_id == id ){
                        value -= received.amount * received.price;
                    } 
                }
                for ( let sents of token_trade.sends){
                    if ( sents.token_id == id ){
                        value += sents.amount * sents.price;
                    } 
                }
                console.log(value, id, timestamp);
            }
            
            try {
                timestamp = token_history.data.history_list[token_history.data.history_list.length-1].time_at;
                console.log(this.getHistoryToken(chain, id, timestamp));
                token_history = await this.fetchhttpJsonPuppeteerLoadNewPage(this.getHistoryToken(chain, id, timestamp));
                await new Promise(r => setTimeout(r, randomInt(3000, 7000)));
                if (!token_history){
                    await this.fetchhttpJsonPuppeteerReturnToHistory();
                    break;
                }
            }
            catch (err){
                console.log(err);
                break;
            }
            
        }
        return value;
    }

    async fetchhttpJsonPuppeteer(url: string, jsonRequestUrl : string) : Promise<any> {

        return new Promise(async (resolve, reject) => {
            // Enable request interception
        await this.page.setRequestInterception(true);
        
        this.page.on('request', (request) => {
            request.continue();
        });
        // Listen for 'response' events
        this.page.on('response', async (response) => {
            const requestUrl = response.url();
            // const contentType = response.headers()['content-type'];
        
            // Check if the URL matches the desired pattern and the content type is JSON 'https://api.debank.com/history/list?user_addr='
            if (
                requestUrl.startsWith(jsonRequestUrl)
            ) {
            try {
                const content = await response.json();
                console.log("BASE HISTORY CONTENT");
                resolve(content);
            }
            catch (err) {
                console.log(' Pref light request Erreur ');
            }
            }
        });
    
        // Navigate to the target URL
        await this.page.goto(url);
        // Close the browser
        // await browser.close();
    
        });
        
    }
    
    async fetchhttpJsonPuppeteerTokenAnalysor(jsonRequestUrl : string, id :string, chain : string, symbol :string) : Promise<any> {
        const divSelector = `div[data-id="${id}"][data-name="${symbol}"][data-token-chain="${chain}"]`;
        return new Promise(async (resolve, reject) => {
        
        // this.page.on('request', (request) => {
        //     request.continue();
        // });
        // Listen for 'response' events
        this.page.on('response', async (response) => {
            const requestUrl = response.url();
            // const contentType = response.headers()['content-type'];
        
            // Check if the URL matches the desired pattern and the content type is JSON 
            if (requestUrl.startsWith(jsonRequestUrl)) {
                try {
                    const content = await response.json();
                    console.log('JSON TOKEN TRANSACTION HISTORY');
                    resolve(content);
                }
                catch (err) {
                    console.log(' Pref light request Erreur ');
                }
            }
        });
        // Navigate to the target URL
        await this.page.waitForSelector(divSelector);
        await this.page.click(divSelector);
        });
    }
    
    async fetchhttpJsonPuppeteerLoadNewPage(jsonRequestUrl : string) : Promise<any> {
        const buttonSelector = 'button.Button_button__1yaWD.Button_is_default__2ObHV.History_loadMore__1DkZs';
        console.log(jsonRequestUrl);
        return new Promise<void>(async (resolve, reject) => {
        // Listen for 'response' events
        this.page.on('response', async (response) => {
            const requestUrl = response.url();
            // const contentType = response.headers()['content-type'];
        
            // Check if the URL matches the desired pattern and the content type is JSON 'https://api.debank.com/history/list?user_addr='
            if (
                requestUrl.startsWith(jsonRequestUrl)
            ) {
            try {
                const content = await response.json();
                console.log("NEW PAGE JSON HISTORY")
                resolve(content);
            }
            catch (err) {
                console.log(' Pref light request Erreur ');
            }
            }
        });
    
        
        try {
            await this.page.waitForSelector(buttonSelector, { timeout: 5000 });
            await this.page.click(buttonSelector);
        } catch (error) {
            console.log('Button not found');
            resolve();
        }
    });
    
    }

    async fetchhttpJsonPuppeteerLoadNewPageWithoutJSON() : Promise<any> {
        const buttonSelector = 'button.Button_button__1yaWD.Button_is_default__2ObHV.History_loadMore__1DkZs';

        return new Promise<void>((resolve, reject) => {
            this.page
              .waitForSelector(buttonSelector, { timeout: 5000 })
              .then(async () => {
                await this.page.click(buttonSelector);
                console.log('Button clicked');
                setTimeout(() => {
                  resolve();
                }, 5000);
              })
              .catch((error) => {
                console.log('Button not found');
                resolve();
              });
        });
    }

    async fetchhttpJsonPuppeteerReturnToHistory() : Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
        const svgSelector = 'svg.searchInput-clearIcon';
        try {
            await this.page.waitForSelector(svgSelector, { timeout: 3000 });
            await this.page.click(svgSelector);
            resolve();
        } catch (error) {
            console.log('Button not found');
            resolve();
        }
    });
    }
}