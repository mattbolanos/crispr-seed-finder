"use client";

import { useQuery } from "@tanstack/react-query";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  type SearchHistoryEntry,
  type SeedMatchesRequest,
  upsertSearchHistoryEntry,
} from "@/components/search-history";
import { SeedFinderIntro } from "@/components/seed-finder/intro";
import { SeedFinderResults } from "@/components/seed-finder/results";
import { SeedFinderSearchControls } from "@/components/seed-finder/search-controls";
import { Card, CardContent } from "@/components/ui/card";
import {
  isDnaValid,
  isSeedLengthSupported,
  type SeedMatchesResponse,
} from "@/lib/seed-search";

interface SubmittedSearch extends SeedMatchesRequest {
  runId: string;
}

function createSearchRunId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

interface SeedFinderFormProps {
  restoredEntry: SearchHistoryEntry | null;
  onSearchCompleted: (entry: SearchHistoryEntry) => void;
}

export function SeedFinderForm({
  restoredEntry,
  onSearchCompleted,
}: SeedFinderFormProps) {
  const [sequence, setSequence] = useQueryState(
    "sequence",
    parseAsString.withDefault(""),
  );
  const [seedLength, setSeedLength] = useQueryState(
    "seedLength",
    parseAsInteger.withDefault(9),
  );
  const [submittedSearch, setSubmittedSearch] =
    useState<SubmittedSearch | null>(null);
  const [displayedResults, setDisplayedResults] =
    useState<SeedMatchesResponse | null>(restoredEntry?.response ?? null);
  const completedRunIdsRef = useRef<Set<string>>(new Set());

  const resultsQuery = useQuery({
    queryKey: [
      "seed-matches",
      submittedSearch?.sequence ?? null,
      submittedSearch?.minSeed ?? null,
      submittedSearch?.runId ?? null,
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

  useEffect(() => {
    if (!submittedSearch || !resultsQuery.data) {
      return;
    }

    if (completedRunIdsRef.current.has(submittedSearch.runId)) {
      return;
    }

    const entry: SearchHistoryEntry = {
      id: submittedSearch.runId,
      createdAt: new Date().toISOString(),
      request: {
        sequence: submittedSearch.sequence,
        minSeed: submittedSearch.minSeed,
      },
      response: resultsQuery.data,
    };

    completedRunIdsRef.current.add(submittedSearch.runId);
    upsertSearchHistoryEntry(entry);
    setDisplayedResults(resultsQuery.data);
    onSearchCompleted(entry);
  }, [onSearchCompleted, resultsQuery.data, submittedSearch]);

  useEffect(() => {
    if (!restoredEntry) {
      return;
    }

    void setSequence(restoredEntry.request.sequence);
    void setSeedLength(restoredEntry.request.minSeed);
    setSubmittedSearch(null);
    setDisplayedResults(restoredEntry.response);
  }, [restoredEntry, setSeedLength, setSequence]);

  const isReady = isDnaValid(sequence) && isSeedLengthSupported(seedLength);
  const results = submittedSearch
    ? (resultsQuery.data ?? displayedResults)
    : displayedResults;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (!isReady) {
      return;
    }

    setDisplayedResults(null);
    setSubmittedSearch({
      sequence,
      minSeed: seedLength,
      runId: createSearchRunId(),
    });
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <Card className="w-full max-w-5xl">
        <SeedFinderIntro />
        <CardContent className="space-y-6">
          <SeedFinderSearchControls
            isReady={isReady}
            isSearching={resultsQuery.isFetching}
            seedLength={seedLength}
            sequence={sequence}
            onSeedLengthChange={(value) => {
              void setSeedLength(value);
            }}
            onSequenceChange={(value) => {
              void setSequence(value);
            }}
            onSubmit={handleSubmit}
          />
          {resultsQuery.isError && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border px-4 py-3 text-sm">
              {resultsQuery.error.message}
            </div>
          )}
          <SeedFinderResults results={results} />
        </CardContent>
      </Card>
    </div>
  );
}
