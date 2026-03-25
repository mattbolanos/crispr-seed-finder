"use client";

import { useQuery } from "@tanstack/react-query";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useState } from "react";
import {
  SearchHistory,
  type SearchHistoryEntry,
} from "@/components/search-history";
import { SeedFinderForm } from "@/components/seed-finder-form";
import type { GuideHandler } from "@/lib/guide-library-manifest";

async function fetchGuideHandlers() {
  const response = await fetch("/api/guides");

  if (!response.ok) {
    throw new Error("Guide handlers failed to load.");
  }

  return (await response.json()) as GuideHandler[];
}

export function SeedFinderPage() {
  const [{ seedLength, sequence }, setSearchParams] = useQueryStates({
    sequence: parseAsString.withDefault(""),
    seedLength: parseAsInteger.withDefault(9),
  });
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [restoredEntry, setRestoredEntry] = useState<SearchHistoryEntry | null>(
    null,
  );
  const [restoreToken, setRestoreToken] = useState(0);
  const guidesQuery = useQuery({
    queryKey: ["guide-handlers"],
    queryFn: fetchGuideHandlers,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 60 * 60 * 1000,
  });

  return (
    <>
      <SearchHistory
        activeRunId={activeRunId}
        onRestore={(entry) => {
          setActiveRunId(entry.id);
          setRestoredEntry(entry);
          setRestoreToken((value) => value + 1);
          void setSearchParams({
            sequence: entry.request.sequence,
            seedLength: entry.request.minSeed,
          });
        }}
      />
      <SeedFinderForm
        key={restoreToken}
        guideHandlers={guidesQuery.data ?? []}
        query={sequence}
        restoredResults={restoredEntry?.response ?? null}
        seedLength={seedLength}
        onQueryChange={(value) => {
          void setSearchParams({ sequence: value });
        }}
        onSeedLengthChange={(value) => {
          void setSearchParams({ seedLength: value });
        }}
        onSearchCompleted={(entry) => {
          setActiveRunId(entry.id);
          setRestoredEntry(null);
        }}
      />
    </>
  );
}
