import { gunzipSync } from "node:zlib";
import { GetObjectCommand, NoSuchKey, S3Client } from "@aws-sdk/client-s3";
import {
  buildSeedKmers,
  MAX_SEED_LENGTH,
  type SeedMatch,
  type SeedMatchesResponse,
  SHARD_PREFIX_LENGTH,
} from "@/lib/seed-search";

type KmerShard = Record<string, SeedMatch[]>;
type SeedKmerOrientation = "direct" | "reverse-complement";
type SeedKmerQuery = {
  kmer: string;
  orientations: SeedKmerOrientation[];
};

let r2Client: S3Client | undefined;
const shardCache = new Map<string, Promise<KmerShard | null>>();
const textObjectCache = new Map<string, Promise<string | null>>();

function getR2Client() {
  if (r2Client) {
    return r2Client;
  }

  const endpoint = process.env.R2_ENDPOINT_URL;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION ?? "auto";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing R2 configuration. Expected R2_ENDPOINT_URL, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.",
    );
  }

  r2Client = new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return r2Client;
}

function getBucketName() {
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!bucketName) {
    throw new Error("Missing R2_BUCKET_NAME.");
  }

  return bucketName;
}

function getShardKey(seedLength: number, prefix5: string) {
  return `k${seedLength}/${prefix5}.json.gz`;
}

async function fetchTextObject(key: string): Promise<string | null> {
  const cached = textObjectCache.get(key);

  if (cached) {
    return cached;
  }

  const promise = (async () => {
    try {
      const response = await getR2Client().send(
        new GetObjectCommand({
          Bucket: getBucketName(),
          Key: key,
        }),
      );

      if (!response.Body) {
        return null;
      }

      const bytes = Buffer.from(await response.Body.transformToByteArray());
      return bytes.toString("utf-8");
    } catch (error) {
      if (
        error instanceof NoSuchKey ||
        (error instanceof Error &&
          "name" in error &&
          error.name === "NoSuchKey")
      ) {
        return null;
      }

      textObjectCache.delete(key);
      throw error;
    }
  })();

  textObjectCache.set(key, promise);
  return promise;
}

async function fetchKmerShard(
  seedLength: number,
  prefix5: string,
): Promise<KmerShard | null> {
  const shardKey = getShardKey(seedLength, prefix5);
  const cached = shardCache.get(shardKey);

  if (cached) {
    return cached;
  }

  const promise = (async () => {
    try {
      const response = await getR2Client().send(
        new GetObjectCommand({
          Bucket: getBucketName(),
          Key: shardKey,
        }),
      );

      if (!response.Body) {
        return null;
      }

      const bytes = Buffer.from(await response.Body.transformToByteArray());
      return JSON.parse(gunzipSync(bytes).toString("utf-8")) as KmerShard;
    } catch (error) {
      if (
        error instanceof NoSuchKey ||
        (error instanceof Error &&
          "name" in error &&
          error.name === "NoSuchKey")
      ) {
        return null;
      }

      shardCache.delete(shardKey);
      throw error;
    }
  })();

  shardCache.set(shardKey, promise);
  return promise;
}

function getMatchKey(match: SeedMatch) {
  return [
    match.gene,
    match.chrom,
    match.pos,
    match.strand,
    match.tss,
    match.dist_to_tss,
  ].join(":");
}

function buildSeedKmerQueries(sequence: string, minSeed: number) {
  const kmers = buildSeedKmers(sequence, minSeed);
  const directKmer = sequence.slice(-minSeed);

  return kmers.map<SeedKmerQuery>((kmer) => ({
    kmer,
    orientations: [
      ...(kmer === directKmer ? (["direct"] as const) : []),
      ...(kmer !== directKmer || kmers.length === 1
        ? (["reverse-complement"] as const)
        : []),
    ],
  }));
}

function getSeedAlignmentKey(
  match: SeedMatch,
  seedLength: number,
  orientation: SeedKmerOrientation,
) {
  const matchesForwardGenomicEnd =
    (orientation === "direct" && match.strand === "+") ||
    (orientation === "reverse-complement" && match.strand === "-");
  const stablePosition = matchesForwardGenomicEnd
    ? match.pos + seedLength
    : match.pos;

  return [
    orientation,
    match.gene,
    match.chrom,
    stablePosition,
    match.strand,
    match.tss,
  ].join(":");
}

export async function findSeedMatches(
  sequence: string,
  minSeed: number,
): Promise<SeedMatchesResponse> {
  const kmers = buildSeedKmers(sequence, minSeed);
  const kmerQueries = buildSeedKmerQueries(sequence, minSeed);
  const prefixes5 = kmers.map((kmer) => kmer.slice(0, SHARD_PREFIX_LENGTH));
  const shardEntries = await Promise.all(
    kmerQueries.map(async (query) => ({
      ...query,
      shard: await fetchKmerShard(
        minSeed,
        query.kmer.slice(0, SHARD_PREFIX_LENGTH),
      ),
    })),
  );
  const seenMatches = new Set<string>();
  const matchAlignmentKeys = new Map<string, Set<string>>();
  const matches: SeedMatch[] = [];

  for (const { kmer, orientations, shard } of shardEntries) {
    for (const match of shard?.[kmer] ?? []) {
      const matchKey = getMatchKey(match);
      const alignmentKeys =
        matchAlignmentKeys.get(matchKey) ?? new Set<string>();

      for (const orientation of orientations) {
        alignmentKeys.add(getSeedAlignmentKey(match, minSeed, orientation));
      }

      matchAlignmentKeys.set(matchKey, alignmentKeys);

      if (seenMatches.has(matchKey)) {
        continue;
      }

      seenMatches.add(matchKey);
      matches.push(match);
    }
  }

  let seedMatches = matches;

  if (matches.length > 0 && minSeed < MAX_SEED_LENGTH) {
    const matchLengths = new Map<string, number>(
      matches.map((match) => [getMatchKey(match), minSeed]),
    );
    const activeMatchKeys = new Set(matchLengths.keys());

    for (
      let seedLength = minSeed + 1;
      seedLength <= MAX_SEED_LENGTH && activeMatchKeys.size > 0;
      seedLength += 1
    ) {
      const longerKmerQueries = buildSeedKmerQueries(sequence, seedLength);
      const longerShardEntries = await Promise.all(
        longerKmerQueries.map(async (query) => ({
          ...query,
          shard: await fetchKmerShard(
            seedLength,
            query.kmer.slice(0, SHARD_PREFIX_LENGTH),
          ),
        })),
      );
      const longerAlignmentKeys = new Set<string>();

      for (const { kmer, orientations, shard } of longerShardEntries) {
        for (const match of shard?.[kmer] ?? []) {
          for (const orientation of orientations) {
            longerAlignmentKeys.add(
              getSeedAlignmentKey(match, seedLength, orientation),
            );
          }
        }
      }

      for (const matchKey of Array.from(activeMatchKeys)) {
        const alignmentKeys = matchAlignmentKeys.get(matchKey) ?? new Set();
        const hasLongerMatch = Array.from(alignmentKeys).some((alignmentKey) =>
          longerAlignmentKeys.has(alignmentKey),
        );

        if (hasLongerMatch) {
          matchLengths.set(matchKey, seedLength);
        } else {
          activeMatchKeys.delete(matchKey);
        }
      }
    }

    seedMatches = matches.map((match) => ({
      ...match,
      seed_match_length: matchLengths.get(getMatchKey(match)) ?? minSeed,
    }));
  } else {
    seedMatches = matches.map((match) => ({
      ...match,
      seed_match_length: minSeed,
    }));
  }

  return {
    sequence,
    minSeed,
    kmers,
    prefixes5,
    matches: seedMatches,
  };
}

export async function fetchR2TextFile(key: string) {
  return fetchTextObject(key);
}
