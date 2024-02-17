# analyse-account

Analyse on chain wallet account. For EVM chains

For an other analyse :
Basic from to in eth/ USD
retrieves ETH / BNB / ... prices in minute to see what was the price it was bought
or just make evolution in % in eth ...
Number of trades TOO
check current token price using liquidity pool I guess
contract.name()
add filters :
-Check number transaction /hour.
-Check if smart contract how ? smart
-Check number token held / holds

TODO:

winston logging
For the checking of ETH price: take the timestamp of the transation and then look to what is the closest to the number as a multiple of 60.
Or just looping through the file and then the first higher we check take the one just before and the average between open/close

## Update balance logic

The transferTxSummary is an array of TransferTx meaning it is only the flow of money of a transaction (how many token is exchanged)
for each transfer we check:

1. if the token is a USD based or ETH based token
   If No but stills flow into our out of the wallet:
   if the token exists in history we had a +1 to the tx
   else we just add the basic object to the history. This has to be managed to add the pair traded even though it is not eth/usd
   There is a logic where: if the token send to the account like (token IN = token Adress) on the same tx, if there is a transfer of ETH we assume that this is the amount of eth transfered.
