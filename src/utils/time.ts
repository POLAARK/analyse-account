export function unixMillisecondsToSeconds(milliseconds: number): number {
  if (!Number.isFinite(milliseconds)) {
    throw new TypeError("Unix milliseconds must be finite");
  }
  return Math.trunc(milliseconds / 1000);
}
