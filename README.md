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
Multiples RPC and when an error send to an other RPC
Multi processing for it to be faster
Lock on file
Register basic contract with USD or WETH in the name and instead of calling the method for decimals and symbol just call db

## Update balance logic

The transferTxSummary is an array of TransferTx meaning it is only the flow of money of a transaction (how many token is exchanged)
for each transfer we check:

1. if the token is a USD based or ETH based token
   If No but stills flow into our out of the wallet:
   if the token exists in history we had a +1 to the tx
   else we just add the basic object to the history. This has to be managed to add the pair traded even though it is not eth/usd
   There is a logic where: if the token send to the account like (token IN = token Adress) on the same tx, if there is a transfer of ETH we assume that this is the amount of eth transfered.
