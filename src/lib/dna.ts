export function isDnaValid(value: string) {
  return DNA_REGEX.test(value) && value.length === REQUIRED_LENGTH;
}

const DNA_COMPLEMENT: Record<string, string> = {
  A: "T",
  T: "A",
  C: "G",
  G: "C",
};

export function reverseComplement(value: string) {
  return value
    .toUpperCase()
    .split("")
    .reverse()
    .map((base) => DNA_COMPLEMENT[base] ?? base)
    .join("");
}

export const DNA_REGEX = /^[ATCGatcg]*$/;
export const REQUIRED_LENGTH = 20;
