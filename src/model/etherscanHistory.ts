export type EtherscanHistory = {
  status: string;
  message: string;
  result: EtherscanTransaction[];
};

export type EtherscanTransaction = {
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
