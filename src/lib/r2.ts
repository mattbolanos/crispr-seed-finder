import { gunzipSync } from "node:zlib";
import { GetObjectCommand, NoSuchKey, S3Client } from "@aws-sdk/client-s3";
import {
  buildSeedKmers,
  type SeedMatch,
  type SeedMatchesResponse,
  SHARD_PREFIX_LENGTH,
} from "@/lib/seed-search";

type KmerShard = Record<string, SeedMatch[]>;

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

export async function findSeedMatches(
  sequence: string,
  minSeed: number,
): Promise<SeedMatchesResponse> {
  const kmers = buildSeedKmers(sequence, minSeed);
  const prefixes5 = kmers.map((kmer) => kmer.slice(0, SHARD_PREFIX_LENGTH));
  const shardEntries = await Promise.all(
    kmers.map(async (kmer, index) => ({
      kmer,
      shard: await fetchKmerShard(minSeed, prefixes5[index]),
    })),
  );
  const seenMatches = new Set<string>();
  const matches: SeedMatch[] = [];

  for (const { kmer, shard } of shardEntries) {
    for (const match of shard?.[kmer] ?? []) {
      const matchKey = [
        match.gene,
        match.chrom,
        match.pos,
        match.strand,
        match.tss,
        match.dist_to_tss,
      ].join(":");

      if (seenMatches.has(matchKey)) {
        continue;
      }

      seenMatches.add(matchKey);
      matches.push(match);
    }
  }

  return {
    sequence,
    minSeed,
    kmers,
    prefixes5,
    matches,
  };
}

export async function fetchR2TextFile(key: string) {
  return fetchTextObject(key);
}
