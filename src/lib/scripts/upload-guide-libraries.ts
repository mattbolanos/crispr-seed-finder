import { readFile } from "node:fs/promises";
import process from "node:process";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { loadEnvConfig } from "@next/env";
import { GUIDE_LIBRARY_FILES } from "../guide-library-manifest";

loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const showHelp = args.includes("--help") || args.includes("-h");

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

if (showHelp) {
  console.log(`Upload Dolcetto guide library text files to Cloudflare R2.

Usage:
  tsx src/lib/scripts/upload-guide-libraries.ts --set-a /path/to/set-a.txt --set-b /path/to/set-b.txt [--dry-run]

Environment:
  Loads .env.local automatically via @next/env.
  R2_ENDPOINT_URL
  R2_BUCKET_NAME
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
  AWS_REGION               Optional. Defaults to "auto".
`);
  process.exit(0);
}

function getArgValue(flag: string) {
  const index = args.indexOf(flag);

  if (index === -1) {
    return null;
  }

  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

async function main() {
  const bucketName = getRequiredEnv("R2_BUCKET_NAME");
  const endpoint = getRequiredEnv("R2_ENDPOINT_URL");
  const accessKeyId = getRequiredEnv("AWS_ACCESS_KEY_ID");
  const secretAccessKey = getRequiredEnv("AWS_SECRET_ACCESS_KEY");
  const region = process.env.AWS_REGION ?? "auto";
  const setAPath = getArgValue("--set-a");
  const setBPath = getArgValue("--set-b");

  if (!setAPath || !setBPath) {
    throw new Error("Provide both --set-a and --set-b local file paths.");
  }

  const files = [
    {
      localPath: setAPath,
      objectKey: GUIDE_LIBRARY_FILES[0].objectKey,
    },
    {
      localPath: setBPath,
      objectKey: GUIDE_LIBRARY_FILES[1].objectKey,
    },
  ];

  const client = new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  for (const file of files) {
    const contents = await readFile(file.localPath);

    if (isDryRun) {
      console.log(
        `DRY RUN ${file.localPath} -> r2://${bucketName}/${file.objectKey} (${contents.byteLength} bytes)`,
      );
      continue;
    }

    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: file.objectKey,
        Body: contents,
        ContentType: "text/plain; charset=utf-8",
      }),
    );

    console.log(
      `Uploaded ${file.localPath} -> r2://${bucketName}/${file.objectKey}`,
    );
  }
}

void main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Guide library upload failed unexpectedly.",
  );
  process.exit(1);
});
