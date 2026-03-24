import { gunzipSync } from "node:zlib";
import { GetObjectCommand, NoSuchKey, S3Client } from "@aws-sdk/client-s3";
import {
  buildSeedKmer,
  type SeedMatch,
  type SeedMatchesResponse,
  SHARD_PREFIX_LENGTH,
} from "@/lib/seed-search";

type KmerShard = Record<string, SeedMatch[]>;

let r2Client: S3Client | undefined;
const shardCache = new Map<string, Promise<KmerShard | null>>();

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
  const kmer = buildSeedKmer(sequence, minSeed);
  const prefix5 = kmer.slice(0, SHARD_PREFIX_LENGTH);
  const shard = await fetchKmerShard(minSeed, prefix5);

  return {
    sequence,
    minSeed,
    kmer,
    prefix5,
    matches: shard?.[kmer] ?? [],
  };
}
