export type TokenValueTraded = {
    token_name : string,
    token_address : string,
    chain : string,
    value : number
}

export type TokenHistory = {
    token_value_traded : TokenValueTraded[],
    token_list : string[],
    address : string,
    date : number
}
