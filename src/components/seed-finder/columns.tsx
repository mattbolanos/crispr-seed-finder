"use client";

import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { SeedMatch, SeedMatchesResponse } from "@/lib/seed-search";

export interface SeedMatchColumn {
  header: string;
  renderCell: (match: SeedMatch, minSeed: number) => ReactNode;
  getCsvValue?: (match: SeedMatch, minSeed: number) => string | number;
  headerClassName?: string;
  cellClassName?: string;
}

export function formatGenomicLocation(match: SeedMatch, k: number) {
  const start = match.pos + 1;
  const end = match.pos + k;

  return `${match.chrom}:${start}-${end}`;
}

export function buildUcscLink(match: SeedMatch, k: number) {
  const start = Math.max(1, match.pos + 1 - 100);
  const end = match.pos + k + 100;

  return `https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position=${encodeURIComponent(
    `${match.chrom}:${start}-${end}`,
  )}`;
}

export const seedMatchColumns: SeedMatchColumn[] = [
  {
    header: "Gene",
    headerClassName:
      "bg-accent supports-backdrop-filter:bg-accent/95 sticky top-0 z-20 rounded-tl-xl px-4 py-3 backdrop-blur",
    cellClassName: "px-4 py-3 font-medium",
    renderCell: (match) => match.gene,
    getCsvValue: (match) => match.gene,
  },
  {
    header: "Seed Match Locus",
    headerClassName:
      "bg-accent supports-backdrop-filter:bg-accent/95 sticky top-0 z-20 px-4 py-3 backdrop-blur",
    cellClassName: "px-4 py-3 font-mono text-xs tabular-nums",
    renderCell: (match, minSeed) => formatGenomicLocation(match, minSeed),
    getCsvValue: (match, minSeed) => formatGenomicLocation(match, minSeed),
  },
  {
    header: "TSS Locus",
    headerClassName:
      "bg-accent supports-backdrop-filter:bg-accent/95 sticky top-0 z-20 px-4 py-3 backdrop-blur",
    cellClassName: "px-4 py-3 text-xs tabular-nums",
    renderCell: (match) => match.tss,
    getCsvValue: (match) => match.tss,
  },
  {
    header: "Distance to TSS",
    headerClassName:
      "bg-accent supports-backdrop-filter:bg-accent/95 sticky top-0 z-20 px-4 py-3 backdrop-blur",
    cellClassName: "px-4 py-3 tabular-nums",
    renderCell: (match) => Math.abs(match.dist_to_tss),
    getCsvValue: (match) => Math.abs(match.dist_to_tss),
  },
  {
    header: "UCSC",
    headerClassName:
      "bg-accent supports-backdrop-filter:bg-accent/95 sticky top-0 z-20 rounded-tr-xl px-4 py-3 backdrop-blur",
    cellClassName: "px-4 py-3",
    renderCell: (match, minSeed) => (
      <a
        className="text-primary inline-flex items-center gap-1 hover:underline"
        href={buildUcscLink(match, minSeed)}
        target="_blank"
        rel="noreferrer"
      >
        Open
        <ExternalLinkIcon className="size-3" />
      </a>
    ),
    getCsvValue: (match, minSeed) => buildUcscLink(match, minSeed),
  },
];

function escapeCsvCell(value: string | number) {
  const normalized = String(value);

  if (!/[",\n]/.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replaceAll('"', '""')}"`;
}

export function buildSeedMatchesCsv(data: SeedMatchesResponse) {
  const rows = [
    seedMatchColumns.map((column) => column.header),
    ...data.matches.map((match) =>
      seedMatchColumns.map(
        (column) => column.getCsvValue?.(match, data.minSeed) ?? "",
      ),
    ),
  ];

  return rows
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");
}
