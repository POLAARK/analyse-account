import { TokenHistory  } from "src/model/historical-token-trading"
import { fetchHttpJsonHandlingTooManyRequest, isOccurenceInString } from "../../utils/utils.js"; 

export const ApiDebank = class ApiDebank {
    address : string;
    chains : string[] = ['eth', 'arb', 'avax', 'op', 'matic', 'bsc'];
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
        return `https://api.debank.com/history/list?user_addr=${this.address}&chain=${chain}&start_time=${date}&page_count=20&token_id=${id}`
    }


    async seeActions(date: number = 1672527600){
        let url : string = this.getHistoryAccount();
        let historydata  = await fetchHttpJsonHandlingTooManyRequest(url);
        let token_dict = historydata.data.token_dict;
        let timestamp = historydata.data.history_list[historydata.data.history_list.length-1].time_at;
        let token_val_traded : number
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
                    console.log(token.id, token.symbol)
                    token_val_traded = await this.calculTokenBalance(token.chain, token.id);
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
            await new Promise(resolve => setTimeout(resolve, 4000));
            timestamp = historydata.data.history_list[historydata.data.history_list.length-1].time_at;
            historydata  = await fetchHttpJsonHandlingTooManyRequest(this.getHistoryAccount(timestamp));
            console.log(timestamp, date, this.token_traded.date)
            token_dict = historydata.data.token_dict;
        }
        this.token_traded.date = Date.now();
        return this.token_traded;
        
    }

    async calculTokenBalance(chain : string, id : string) {
        let token_history = await fetchHttpJsonHandlingTooManyRequest(this.getHistoryToken(chain, id));
        
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
                // console.log(value, id, timestamp);
            }
            
            try {
                timestamp = token_history.data.history_list[token_history.data.history_list.length-1].time_at;
                console.log(timestamp)
            }
            catch (err){
                console.log(err)
                break;
            }
            token_history = await fetchHttpJsonHandlingTooManyRequest(this.getHistoryToken(chain, id, timestamp));
            await new Promise(resolve => setTimeout(resolve, 4000));
        }
        return value;
    }
    
}