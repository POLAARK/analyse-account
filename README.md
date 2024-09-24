# analyse-account

Analyse on chain wallet account. For EVM chains


### Main idea.

This project is mainly a big algorithm allowing to read transactions on EVM blockchain. The main goal was to find the USD value in each transaction to estimate a trader performance. 
To do that I had to determinate, which token has been traded and if it was sold or bought. 
This was built using the Transfer function of ERC20 tokens.
This means that any transfer of value not using the transfer function will not be parsed by the software. 

For an other analyse :
retrieves ETH / BNB / ... prices in minute to see what was the price it was bought
or just make evolution in % in eth ...

An other way of doing this would be: 
For each token create the price history using the liquidity pool


In the future it would be a good thing to add filters :
-Check number transaction /hour.
-Check if smart contract how ? smart
-Check number token held / holds

### Update wallet balance algorithm

The main logic starts here: 

WalletService.createWalletTradingHistory

We have two mechanism for the software, a concurrent mod and a parallel mod.
The idea in the two mod will be the same. 
Here we will describe only one run of the main loop.

// Correct this.
The transferTxSummary is an array of TransferTxs meaning it represents only the flow of money of a transaction (how many tokens are exchanged)

For each transfer we check:

1. if the token is a USD based or ETH based token
   If No but stills flow "in" or "out" of the wallet:
      If the token exists in history we add a +1 to the transaction
   Else we just add the basic transfer object to the history. This has to be managed to add the pair traded even though it's neither eth nor usd.
   There is a logic where: if the token send to the account like (token IN = token Adress) on the same tx, if there is a transfer of ETH we assume that this is the amount of eth transfered.


##### Note
Do we really need to save tx ? 
 If we have already summary for a specific wallet + Inittimestamp + lastblockupdapte we don't need to save the transactions. Because we just have to have the new Txs for the blocks / timestamp we don't have to reloop through theem. May be for testing purpose ?