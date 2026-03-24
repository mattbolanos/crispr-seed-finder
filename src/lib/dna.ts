export function isDnaValid(value: string) {
  return DNA_REGEX.test(value) && value.length === REQUIRED_LENGTH;
}

export const DNA_REGEX = /^[ATCGatcg]*$/;
export const REQUIRED_LENGTH = 20;
