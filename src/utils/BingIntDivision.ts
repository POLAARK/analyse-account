export function BigIntDivisionForAmount(amount: bigint, decimals: bigint) {
  if (amount / decimals <= 1000000n) {
    return parseFloat((Number(amount / 10n ** 6n) / Number(decimals / 10n ** 6n)).toFixed(3));
  } else return amount / decimals;
}
