import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function isDnaValid(value: string) {
  return DNA_REGEX.test(value) && value.length === REQUIRED_LENGTH;
}

export const DNA_REGEX = /^[ATCGatcg]*$/;
export const REQUIRED_LENGTH = 20;
