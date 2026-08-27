import type { ValueTransformer } from "typeorm";

const DECIMAL_DIGITS_PATTERN = /^\d+(\.\d+)?$/;

/**
 * Fixed scale shared by every decimal money column and all scaled-bigint
 * arithmetic over those values.
 */
export const SCALE = 18;

/**
 * Fraction digits kept when converting an oracle price (Number) into the
 * scaled bigint domain. Far above DECIMAL(38,18)'s resolution needs.
 */
export const ORACLE_PRICE_FRACTION_DIGITS = 10;

function pow10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

/**
 * Parses a non-negative fixed-point decimal string into `scale` fraction
 * digits of precision, as a bigint. Extra fraction digits are truncated
 * (never rounded up). Negative inputs are rejected by design: parsed sources
 * (on-chain raw amounts, oracle prices) are non-negative; signed balances
 * only arise through subtraction in the scaled domain.
 */
export function parseDecimalToScaledBigint(decimalString: string, scale: number): bigint {
  if (!Number.isInteger(scale) || scale < 0) {
    throw new RangeError(`scale must be a non-negative integer, got ${scale}`);
  }
  if (!DECIMAL_DIGITS_PATTERN.test(decimalString)) {
    throw new RangeError(
      `decimalString must be a non-negative decimal string, got ${JSON.stringify(decimalString)}`,
    );
  }
  const [wholeDigits, fractionDigits = ""] = decimalString.split(".");
  const keptFraction = fractionDigits.slice(0, scale);
  const paddedFraction = keptFraction.padEnd(scale, "0");
  return BigInt(`${wholeDigits}${paddedFraction}`);
}

/**
 * Formats a scaled bigint back into a fixed-point decimal string. Handles the
 * sign introduced by net flows (OUT exceeding IN); truncates fraction digits
 * beyond `fractionDigits` without rounding up.
 */
export function formatScaledBigintToDecimal(
  value: bigint,
  scale: number,
  fractionDigits?: number,
): string {
  if (!Number.isInteger(scale) || scale < 0) {
    throw new RangeError(`scale must be a non-negative integer, got ${scale}`);
  }
  const digits = fractionDigits ?? scale;
  if (!Number.isInteger(digits) || digits < 0) {
    throw new RangeError(`fractionDigits must be a non-negative integer, got ${digits}`);
  }

  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const wholeUnits = magnitude / pow10(scale);
  const fractionalRaw = magnitude % pow10(scale);

  let formattedFraction = "";
  if (digits > 0) {
    const keptFraction =
      digits <= scale
        ? fractionalRaw / pow10(scale - digits)
        : fractionalRaw * pow10(digits - scale);
    formattedFraction = `.${keptFraction.toString().padStart(digits, "0")}`;
  }

  return `${negative ? "-" : ""}${wholeUnits.toString()}${formattedFraction}`;
}

/**
 * Converts a raw on-chain amount (integer in smallest units) to the shared
 * money scale using pure bigint arithmetic. Excess token decimals beyond the
 * target scale are truncated; smaller scales are aligned by multiplication.
 */
export function scaledFromUnits(rawDecimalString: string, decimals: number, scale: number): bigint {
  if (!/^\d+$/.test(rawDecimalString)) {
    throw new RangeError(
      `rawDecimalString must be a non-negative integer string, got ${JSON.stringify(rawDecimalString)}`,
    );
  }
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new RangeError(`decimals must be a non-negative integer, got ${decimals}`);
  }
  const raw = BigInt(rawDecimalString);
  if (decimals <= scale) {
    return raw * pow10(scale - decimals);
  }
  return raw / pow10(decimals - scale);
}

/**
 * Zero in the scaled domain, for seeding accumulators and literal assignments.
 */
export function scaleZero(): bigint {
  return BigInt(0);
}

/**
 * Converts a legacy Number-produced value (oracle price x amount) into the
 * scaled bigint domain via its exact decimal representation.
 */
export function numberToScaledBigint(value: number, fractionDigits: number, scale: number): bigint {
  return parseDecimalToScaledBigint(value.toFixed(fractionDigits), scale);
}

/**
 * Converts an unpadded or zero-padded fixed-point database text (driver
 * behavior varies between `12.34` and `12.340000`) into its scaled bigint,
 * independent of how many fraction digits were serialized.
 */
export function decimalTextToScaledBigint(value: string | number, scale: number): bigint {
  const text = String(value);
  const sign = text.startsWith("-") ? "-" : "";
  const unsigned = sign ? text.slice(1) : text;
  if (!DECIMAL_DIGITS_PATTERN.test(unsigned)) {
    throw new RangeError(`value must be a decimal string, got ${JSON.stringify(text)}`);
  }
  return sign
    ? -parseDecimalToScaledBigint(unsigned, scale)
    : parseDecimalToScaledBigint(unsigned, scale);
}

/**
 * Bridges TypeORM DECIMAL columns with runtime bigints so no IEEE-754 value
 * ever materializes for persisted money fields.
 */
export class ColumnNumericTransformer implements ValueTransformer {
  constructor(private readonly scale: number = SCALE) {}

  to(value?: bigint | null): string | null | undefined {
    if (value === null || value === undefined) return value;
    return formatScaledBigintToDecimal(value, this.scale);
  }

  from(value?: string | null): bigint | null | undefined {
    if (value === null || value === undefined) return value;
    const normalized = String(value).trim();
    if (!normalized) {
      throw new TypeError("cannot transform empty database value to scaled bigint");
    }
    return decimalTextToScaledBigint(normalized, this.scale);
  }
}
