export type EtherscanHistory = {
  status: string;
  message: string;
  result: BlockchainTransaction[];
};

export type BlockchainTransaction = {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  input: string;
  type?: string;
  gas: string;
  gasUsed?: string;
  traceId?: string;
  isError?: string;
  errCode?: string;
};
