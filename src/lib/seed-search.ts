import { DNA_REGEX, REQUIRED_LENGTH } from "@/lib/dna";

export const MIN_SEED_LENGTH = 6;
export const MAX_SEED_LENGTH = 12;
export const SHARD_PREFIX_LENGTH = 5;

export interface SeedMatch {
  gene: string;
  chrom: string;
  pos: number;
  strand: "+" | "-" | string;
  tss: number;
  dist_to_tss: number;
}

export interface SeedMatchesResponse {
  sequence: string;
  minSeed: number;
  kmer: string;
  prefix5: string;
  matches: SeedMatch[];
}

export function normalizeSequence(value: string) {
  return value.trim().toUpperCase();
}

export function isSequenceSearchable(value: string) {
  return value.length === REQUIRED_LENGTH && DNA_REGEX.test(value);
}

export function isSeedLengthSupported(value: number) {
  return (
    Number.isInteger(value) &&
    value >= MIN_SEED_LENGTH &&
    value <= MAX_SEED_LENGTH
  );
}

export function buildSeedKmer(sequence: string, minSeed: number) {
  return sequence.slice(0, minSeed);
}

export function isDnaValid(value: string) {
  return DNA_REGEX.test(value) && value.length === REQUIRED_LENGTH;
}
