import "server-only";
import { gunzipSync } from "node:zlib";

const DEFAULT_SHARD_PREFIX_LENGTH = 5;
const DNA_PREFIX_REGEX = /^[ACGT]+$/;
const DEFAULT_R2_BASE_URL_ENV = "R2_KMER_INDEX_BASE_URL";

export interface KmerMatch {
  gene: string;
  chrom: string;
  pos: number;
  strand: string;
  tss: number;
  dist_to_tss: number;
}

export type KmerShard = Record<string, KmerMatch[]>;

interface FetchKmerShardOptions {
  baseUrl?: string;
  signal?: AbortSignal;
  cache?: RequestCache;
}

export function buildKmerShardPath(
  seedLength: number,
  prefix: string,
  shardPrefixLength = DEFAULT_SHARD_PREFIX_LENGTH,
) {
  const normalizedPrefix = normalizeShardPrefix(
    seedLength,
    prefix,
    shardPrefixLength,
  );

  return `k${seedLength}/${normalizedPrefix}.json.gz`;
}

export async function fetchKmerShard(
  seedLength: number,
  prefix: string,
  options: FetchKmerShardOptions = {},
): Promise<KmerShard | null> {
  const baseUrl = options.baseUrl ?? process.env[DEFAULT_R2_BASE_URL_ENV];

  if (!baseUrl) {
    throw new Error(
      `Missing ${DEFAULT_R2_BASE_URL_ENV}. Set it to the public R2 base URL for the shard root.`,
    );
  }

  const path = buildKmerShardPath(seedLength, prefix);
  const url = new URL(path, withTrailingSlash(baseUrl));
  const response = await fetch(url, {
    signal: options.signal,
    cache: options.cache ?? "force-cache",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch kmer shard ${path}: ${response.status} ${response.statusText}`,
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  return parseShardPayload(bytes);
}

function normalizeShardPrefix(
  seedLength: number,
  prefix: string,
  shardPrefixLength: number,
) {
  if (!Number.isInteger(seedLength) || seedLength < 1) {
    throw new Error(
      `seedLength must be a positive integer. Received ${seedLength}.`,
    );
  }

  if (!Number.isInteger(shardPrefixLength) || shardPrefixLength < 1) {
    throw new Error(
      `shardPrefixLength must be a positive integer. Received ${shardPrefixLength}.`,
    );
  }

  const normalized = prefix.trim().toUpperCase();
  const expectedLength = Math.min(seedLength, shardPrefixLength);

  if (normalized.length < expectedLength) {
    throw new Error(
      `prefix must contain at least ${expectedLength} bases for seedLength=${seedLength}.`,
    );
  }

  const shardPrefix = normalized.slice(0, expectedLength);
  if (!DNA_PREFIX_REGEX.test(shardPrefix)) {
    throw new Error(
      `prefix must only contain A, C, G, or T. Received ${JSON.stringify(prefix)}.`,
    );
  }

  return shardPrefix;
}

function parseShardPayload(payload: Buffer): KmerShard {
  const rawText = payload.toString("utf-8");

  try {
    return JSON.parse(rawText) as KmerShard;
  } catch {
    return JSON.parse(gunzipSync(payload).toString("utf-8")) as KmerShard;
  }
}

function withTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
