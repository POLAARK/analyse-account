const RAW_DECIMAL_PATTERN = /^\d+$/;

/**
 * Converts a raw on-chain amount (integer in smallest token units, as a decimal
 * string) into a fixed-point decimal string using pure bigint arithmetic.
 *
 * The computation never passes through IEEE-754 values, so it stays exact for
 * arbitrarily large raw amounts (e.g. 30+ digit wei-scale integers).
 *
 * Rounding: fraction digits beyond `fractionDigits` are truncated (rounded
 * down), since on-chain amounts are non-negative and reported amounts must
 * never overstate a value.
 */
export function formatUnitsToFixed(
  rawDecimalString: string,
  decimals: number,
  fractionDigits: number,
): string {
  if (!RAW_DECIMAL_PATTERN.test(rawDecimalString)) {
    throw new RangeError(
      `rawDecimalString must be a non-negative integer string, got ${JSON.stringify(rawDecimalString)}`,
    );
  }
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new RangeError(`decimals must be a non-negative integer, got ${decimals}`);
  }
  if (!Number.isInteger(fractionDigits) || fractionDigits < 0) {
    throw new RangeError(`fractionDigits must be a non-negative integer, got ${fractionDigits}`);
  }

  const raw = BigInt(rawDecimalString);
  const wholeUnits = raw / 10n ** BigInt(decimals);
  const fractionalRaw = raw % 10n ** BigInt(decimals);

  if (fractionDigits === 0) {
    return wholeUnits.toString();
  }

  let keptFraction: bigint;
  if (fractionDigits <= decimals) {
    keptFraction = fractionalRaw / 10n ** BigInt(decimals - fractionDigits);
  } else {
    keptFraction = fractionalRaw * 10n ** BigInt(fractionDigits - decimals);
  }

  return `${wholeUnits.toString()}.${keptFraction.toString().padStart(fractionDigits, "0")}`;
}

/**
 * Adds two raw amounts of possibly different token scales by aligning both to
 * the larger scale with bigint multiplication only.
 */
export function addRawAmounts(
  leftRaw: string,
  leftDecimals: number,
  rightRaw: string,
  rightDecimals: number,
): { sumRaw: bigint; decimals: number } {
  const left = BigInt(leftRaw);
  const right = BigInt(rightRaw);
  if (leftDecimals >= rightDecimals) {
    return {
      sumRaw: left * 10n ** BigInt(leftDecimals - rightDecimals) + right,
      decimals: leftDecimals,
    };
  }
  return {
    sumRaw: left + right * 10n ** BigInt(rightDecimals - leftDecimals),
    decimals: rightDecimals,
  };
}
