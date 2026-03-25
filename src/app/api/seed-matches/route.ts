import { NextResponse } from "next/server";
import { DNA_REGEX } from "@/lib/dna";
import {
  getGuideLookupExample,
  resolveGuideSequence,
} from "@/lib/guide-library";
import { findSeedMatches } from "@/lib/r2";
import { isSeedLengthSupported, normalizeSequence } from "@/lib/seed-search";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const rawSequence = normalizeSequence(
    typeof payload === "object" &&
      payload !== null &&
      "sequence" in payload &&
      typeof payload.sequence === "string"
      ? payload.sequence
      : "",
  );
  const minSeed =
    typeof payload === "object" &&
    payload !== null &&
    "minSeed" in payload &&
    typeof payload.minSeed === "number"
      ? payload.minSeed
      : Number.NaN;

  if (!isSeedLengthSupported(minSeed)) {
    return NextResponse.json(
      { error: "minSeed must be an integer between 6 and 12." },
      { status: 400 },
    );
  }

  let sequence: string | null;

  try {
    sequence = await resolveGuideSequence(rawSequence);
  } catch (error) {
    console.error("Failed to resolve guide sequence from R2", error);

    return NextResponse.json(
      { error: "Guide lookup failed while reading the guide library from R2." },
      { status: 500 },
    );
  }

  if (!sequence) {
    return NextResponse.json(
      {
        error: DNA_REGEX.test(rawSequence)
          ? "Sequence must be exactly 20 bp and contain only A/C/G/T."
          : `Query must be a 20 bp sequence or a supported guide alias such as ${getGuideLookupExample()}.`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await findSeedMatches(sequence, minSeed);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to look up seed matches", error);

    return NextResponse.json(
      { error: "Seed lookup failed while reading the shard from R2." },
      { status: 500 },
    );
  }
}
