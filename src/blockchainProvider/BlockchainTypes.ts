export type EtherscanHistory = {
  status: string;
  message: string;
  result: BlockchainTransaction[];
};

export type BlockchainTransaction = {
  blockNumber: number;
  timeStamp: number;
  hash: string;
  from: string;
  to: string;
  value: number;
  contractAddress: string;
  input: string;
  type: string;
  gas: number;
  gasUsed: number;
  traceId: number;
  isError: string;
  errCode: string;
};
