"use client";

import { useMutation } from "@tanstack/react-query";
import { Download, ExternalLink, Search } from "lucide-react";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { DnaInput } from "@/components/dna-input";
import { SeedLengthSlider } from "@/components/seed-length-slider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  isDnaValid,
  type SeedMatch,
  type SeedMatchesResponse,
} from "@/lib/seed-search";

interface SeedMatchesRequest {
  sequence: string;
  minSeed: number;
}

function formatGenomicLocation(match: SeedMatch, k: number) {
  const start = match.pos + 1;
  const end = match.pos + k;

  return `${match.chrom}:${start}-${end}`;
}

function buildUcscLink(match: SeedMatch, k: number) {
  const start = Math.max(1, match.pos + 1 - 100);
  const end = match.pos + k + 100;

  return `https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position=${encodeURIComponent(
    `${match.chrom}:${start}-${end}`
  )}`;
}

function escapeCsvCell(value: string | number) {
  const normalized = String(value);

  if (!/[",\n]/.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replaceAll('"', '""')}"`;
}

function buildCsv(data: SeedMatchesResponse) {
  const rows = [
    ["gene", "genomic location", "strand", "distance to TSS", "UCSC link"],
    ...data.matches.map((match) => [
      match.gene,
      formatGenomicLocation(match, data.minSeed),
      match.strand,
      match.dist_to_tss,
      buildUcscLink(match, data.minSeed),
    ]),
  ];

  return rows
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");
}

async function searchSeedMatches({
  sequence,
  minSeed,
}: SeedMatchesRequest): Promise<SeedMatchesResponse> {
  const response = await fetch("/api/seed-matches", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sequence, minSeed }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    throw new Error(payload?.error ?? "Seed lookup failed.");
  }

  return (await response.json()) as SeedMatchesResponse;
}

export function SeedFinderForm() {
  const [sequence, setSequence] = useQueryState(
    "sequence",
    parseAsString.withDefault("")
  );
  const [seedLength, setSeedLength] = useQueryState(
    "seedLength",
    parseAsInteger.withDefault(8)
  );

  const searchMutation = useMutation({
    mutationFn: searchSeedMatches,
  });

  const isReady = isDnaValid(sequence);
  const results = searchMutation.data;
  const csvHref = results
    ? `data:text/csv;charset=utf-8,${encodeURIComponent(buildCsv(results))}`
    : "";

  return (
    <div className="flex flex-col items-center justify-center">
      <Card className="w-full max-w-5xl">
        <CardHeader className="text-center">
          <CardDescription className="font-mono text-xs uppercase tracking-widest">
            CRISPR Analysis
          </CardDescription>
          <CardTitle className="text-2xl">Seed Finder Tool</CardTitle>
          <CardDescription>
            PAM-proximal seed matches in TSS regions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <form
            className="space-y-10"
            onSubmit={(event) => {
              event.preventDefault();

              if (!isReady) {
                return;
              }

              searchMutation.mutate({
                sequence,
                minSeed: seedLength,
              });
            }}
          >
            <SeedLengthSlider value={seedLength} onChange={setSeedLength} />
            <DnaInput value={sequence} onChange={setSequence} />
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={!isReady || searchMutation.isPending}
            >
              <Search data-icon="inline-start" />
              {searchMutation.isPending ? "Searching..." : "Find Seeds"}
            </Button>
          </form>
          {searchMutation.isError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {searchMutation.error.message}
            </div>
          )}
          {results && (
            <section className="space-y-4 border-t border-border/60 pt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {results.matches.length} seed match
                    {results.matches.length === 1 ? "" : "es"}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    Query k-mer: {results.kmer} from {results.sequence}
                  </p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  disabled={results.matches.length === 0}
                >
                  <a
                    href={csvHref}
                    download={`seed-matches-k${results.minSeed}-${results.kmer}.csv`}
                  >
                    <Download data-icon="inline-start" />
                    Download CSV
                  </a>
                </Button>
              </div>
              {results.matches.length === 0 ? (
                <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                  No matches were found for this {results.minSeed}-bp seed.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border/60">
                  <div className="max-h-[30rem] overflow-auto">
                    <table className="min-w-full border-collapse text-left text-sm">
                      <thead className="sticky top-0 bg-card/95 backdrop-blur">
                        <tr className="border-b border-border/60">
                          <th className="px-4 py-3 font-medium">Gene</th>
                          <th className="px-4 py-3 font-medium">
                            Genomic location
                          </th>
                          <th className="px-4 py-3 font-medium">Strand</th>
                          <th className="px-4 py-3 font-medium">
                            Distance to TSS
                          </th>
                          <th className="px-4 py-3 font-medium">UCSC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.matches.map((match, index) => (
                          <tr
                            key={`${match.gene}-${match.chrom}-${match.pos}-${index}`}
                            className="border-b border-border/40 last:border-b-0"
                          >
                            <td className="px-4 py-3 font-medium">
                              {match.gene}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">
                              {formatGenomicLocation(match, results.minSeed)}
                            </td>
                            <td className="px-4 py-3">{match.strand}</td>
                            <td className="px-4 py-3 tabular-nums">
                              {match.dist_to_tss}
                            </td>
                            <td className="px-4 py-3">
                              <a
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                                href={buildUcscLink(match, results.minSeed)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open
                                <ExternalLink className="size-3" />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}
        </CardContent>
        <CardFooter className="justify-center border-t border-border/40 pt-4 text-xs text-muted-foreground">
          Searching the exact {seedLength}-bp prefix of the 20-bp guide against
          the precomputed R2 shard index.
        </CardFooter>
      </Card>
    </div>
  );
}
