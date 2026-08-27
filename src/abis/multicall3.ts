/**
 * Canonical Multicall3 deployment, identical on 250+ chains:
 * https://github.com/mds1/multicall
 */
export const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

/** Maximum number of token addresses per aggregate3 batch (each contributing one symbol and one decimals subcall). */
export const MULTICALL_BATCH_SIZE = 50;

/** eth_call timeout used for multicall metadata batches; larger than the default because a batch carries up to 2x size subcalls. */
export const MULTICALL_CALL_TIMEOUT_MS = 5000;

export const multicall3 = [
  "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[])",
];
