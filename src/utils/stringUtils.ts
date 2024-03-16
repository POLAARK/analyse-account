export function containsUsdOrEth(stringIn: string) {
  let lowerCaseStr = stringIn.toLowerCase();
  if (lowerCaseStr.includes("usd") || lowerCaseStr.includes("dai")) {
    return "USD";
  }
  if (lowerCaseStr.includes("eth")) {
    return "ETH";
  } else {
    return false;
  }
}

export function OneContainsStrings(stringOne: string, strings: string[]) {
  for (let s of strings) {
    if (stringOne.toLowerCase().includes(s.toLowerCase())) {
      return true;
    }
  }
  return false;
}
