"use client";

import { DownloadIcon, SearchIcon } from "lucide-react";
import {
  buildSeedMatchesCsv,
  seedMatchColumns,
} from "@/components/seed-finder/columns";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SeedMatch, SeedMatchesResponse } from "@/lib/seed-search";

function SeedMatchesTable({
  matches,
  minSeed,
}: {
  matches: SeedMatch[];
  minSeed: number;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {seedMatchColumns.map((column) => (
            <TableHead key={column.header} className={column.headerClassName}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {matches.map((match, index) => (
          <TableRow
            key={`seed-match-${match.gene}-${match.chrom}-${match.pos}-${index}`}
          >
            {seedMatchColumns.map((column) => (
              <TableCell key={column.header} className={column.cellClassName}>
                {column.renderCell(match, minSeed)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function SeedFinderResults({
  results,
}: {
  results: SeedMatchesResponse | null;
}) {
  if (!results) {
    return null;
  }

  const queryKmers = results.kmers.join(", ");
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(buildSeedMatchesCsv(results))}`;

  return (
    <section className="flex flex-col gap-4">
      <Separator />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {results.matches.length} seed match
            {results.matches.length === 1 ? "" : "es"}
          </p>
          <p className="text-muted-foreground font-mono text-xs">
            Query k-mer{results.kmers.length === 1 ? "" : "s"}: {queryKmers}{" "}
            from {results.sequence}
          </p>
        </div>
        <Button
          asChild
          size="sm"
          variant="secondary"
          disabled={results.matches.length === 0}
        >
          <a
            href={csvHref}
            download={`seed-matches-k${results.minSeed}-${results.kmers.join("-")}.csv`}
          >
            <DownloadIcon />
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
              No matches were found for the {results.minSeed}-bp genomic seed
              {results.kmers.length === 1 ? "" : "s"} {queryKmers}.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <SeedMatchesTable matches={results.matches} minSeed={results.minSeed} />
      )}
    </section>
  );
}
