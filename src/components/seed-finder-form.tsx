"use client";

import { useQuery } from "@tanstack/react-query";
import { DownloadIcon, ExternalLinkIcon, SearchIcon } from "lucide-react";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { DnaInput } from "@/components/dna-input";
import { SeedLengthSlider } from "@/components/seed-length-slider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  isDnaValid,
  isSeedLengthSupported,
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
    `${match.chrom}:${start}-${end}`,
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
    parseAsString.withDefault(""),
  );
  const [seedLength, setSeedLength] = useQueryState(
    "seedLength",
    parseAsInteger.withDefault(8),
  );
  const [submittedSearch, setSubmittedSearch] =
    useState<SeedMatchesRequest | null>(null);

  const resultsQuery = useQuery({
    queryKey: [
      "seed-matches",
      submittedSearch?.sequence ?? null,
      submittedSearch?.minSeed ?? null,
    ],
    queryFn: () => {
      if (!submittedSearch) {
        throw new Error("No search has been submitted.");
      }

      return searchSeedMatches(submittedSearch);
    },
    enabled: submittedSearch !== null,
    staleTime: 5 * 60 * 1000,
  });

  const isReady = isDnaValid(sequence) && isSeedLengthSupported(seedLength);
  const results = resultsQuery.data;
  const csvHref = results
    ? `data:text/csv;charset=utf-8,${encodeURIComponent(buildCsv(results))}`
    : "";

  return (
    <div className="flex flex-col items-center justify-center">
      <Card className="w-full max-w-5xl">
        <CardHeader className="text-center">
          <CardDescription className="font-mono text-xs tracking-widest uppercase">
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
              event.stopPropagation();
              if (!isReady) {
                return;
              }

              setSubmittedSearch({
                sequence,
                minSeed: seedLength,
              });
            }}
          >
            <SeedLengthSlider
              value={seedLength}
              onChange={(value) => {
                void setSeedLength(value);
              }}
            />
            <DnaInput
              value={sequence}
              onChange={(value) => {
                void setSequence(value);
              }}
            />
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={!isReady || resultsQuery.isFetching}
            >
              {resultsQuery.isFetching ? <Spinner /> : <SearchIcon />}
              {resultsQuery.isFetching ? "Searching..." : "Find Seeds"}
            </Button>
          </form>
          {resultsQuery.isError && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border px-4 py-3 text-sm">
              {resultsQuery.error.message}
            </div>
          )}
          {results && (
            <section className="flex flex-col gap-4">
              <Separator />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {results.matches.length} seed match
                    {results.matches.length === 1 ? "" : "es"}
                  </p>
                  <p className="text-muted-foreground font-mono text-xs">
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
                    <DownloadIcon data-icon="inline-start" />
                    Download CSV
                  </a>
                </Button>
              </div>
              {results.matches.length === 0 ? (
                <Empty className="border-border/60 bg-muted/20 rounded-xl border py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SearchIcon />
                    </EmptyMedia>
                    <EmptyTitle>No seed matches</EmptyTitle>
                    <EmptyDescription>
                      No matches were found for the {results.minSeed}-bp genomic
                      seed {results.kmer}.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="bg-accent supports-backdrop-filter:bg-accent/95 sticky top-0 z-20 rounded-tl-xl px-4 py-3 backdrop-blur">
                        Gene
                      </TableHead>
                      <TableHead className="bg-accent supports-backdrop-filter:bg-accent/95 sticky top-0 z-20 px-4 py-3 backdrop-blur">
                        Genomic location
                      </TableHead>
                      <TableHead className="bg-accent supports-backdrop-filter:bg-accent/95 sticky top-0 z-20 px-4 py-3 backdrop-blur">
                        Strand
                      </TableHead>
                      <TableHead className="bg-accent supports-backdrop-filter:bg-accent/95 sticky top-0 z-20 px-4 py-3 backdrop-blur">
                        Distance to TSS
                      </TableHead>
                      <TableHead className="bg-accent supports-backdrop-filter:bg-accent/95 sticky top-0 z-20 rounded-tr-xl px-4 py-3 backdrop-blur">
                        UCSC
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.matches.map((match, index) => (
                      <TableRow
                        key={`${match.gene}-${match.chrom}-${match.pos}-${index}`}
                      >
                        <TableCell className="px-4 py-3 font-medium">
                          {match.gene}
                        </TableCell>
                        <TableCell className="px-4 py-3 font-mono text-xs">
                          {formatGenomicLocation(match, results.minSeed)}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          {match.strand}
                        </TableCell>
                        <TableCell className="px-4 py-3 tabular-nums">
                          {match.dist_to_tss}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <a
                            className="text-primary inline-flex items-center gap-1 hover:underline"
                            href={buildUcscLink(match, results.minSeed)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open
                            <ExternalLinkIcon className="size-3" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
