"use client";

import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useMemo, useRef, useState } from "react";
import {
  type SearchHistoryEntry,
  type SeedMatchesRequest,
  upsertSearchHistoryEntry,
} from "@/components/search-history";
import { SeedFinderIntro } from "@/components/seed-finder/intro";
import { SeedFinderResults } from "@/components/seed-finder/results";
import { SeedFinderSearchControls } from "@/components/seed-finder/search-controls";
import { Card, CardContent } from "@/components/ui/card";
import type { GuideHandler } from "@/lib/guide-library-manifest";
import { canonicalizeGuideQuery } from "@/lib/guide-query";
import {
  isSeedLengthSupported,
  isSequenceSearchable,
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
  guideHandlers: GuideHandler[];
  query: string;
  restoredResults: SeedMatchesResponse | null;
  seedLength: number;
  onQueryChange: (value: string) => void;
  onSeedLengthChange: (value: number) => void;
  onSearchCompleted: (entry: SearchHistoryEntry) => void;
}

export function SeedFinderForm({
  guideHandlers,
  query,
  restoredResults,
  seedLength,
  onQueryChange,
  onSeedLengthChange,
  onSearchCompleted,
}: SeedFinderFormProps) {
  const [displayedResults, setDisplayedResults] =
    useState<SeedMatchesResponse | null>(restoredResults);
  const latestSubmittedRunIdRef = useRef<string | null>(null);
  const guideLookup = useMemo(
    () =>
      new Map(
        guideHandlers.map((guideHandler) => [
          canonicalizeGuideQuery(guideHandler.alias),
          guideHandler.sequence,
        ]),
      ),
    [guideHandlers],
  );
  const resolvedGuideSequence =
    guideLookup.get(canonicalizeGuideQuery(query)) ?? null;
  const isValidSequenceQuery = isSequenceSearchable(query);
  const isValidGuideQuery = resolvedGuideSequence !== null;

  const searchMutation = useMutation({
    mutationFn: ({ sequence, minSeed }: SubmittedSearch) => {
      return searchSeedMatches({ sequence, minSeed });
    },
    onSuccess: (response, submittedSearch) => {
      if (latestSubmittedRunIdRef.current !== submittedSearch.runId) {
        return;
      }

      const entry: SearchHistoryEntry = {
        id: submittedSearch.runId,
        createdAt: new Date().toISOString(),
        request: {
          sequence: submittedSearch.sequence,
          minSeed: submittedSearch.minSeed,
        },
        response,
      };

      upsertSearchHistoryEntry(entry);
      setDisplayedResults(response);
      onSearchCompleted(entry);
    },
  });

  const isReady =
    (isValidSequenceQuery || isValidGuideQuery) &&
    isSeedLengthSupported(seedLength);
  const results = displayedResults;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (!isReady) {
      return;
    }

    const submittedSearch = {
      sequence: query,
      minSeed: seedLength,
      runId: createSearchRunId(),
    };

    latestSubmittedRunIdRef.current = submittedSearch.runId;
    searchMutation.reset();
    setDisplayedResults(null);
    searchMutation.mutate(submittedSearch);
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <Card className="w-full max-w-5xl">
        <SeedFinderIntro />
        <CardContent className="space-y-6">
          <SeedFinderSearchControls
            isReady={isReady}
            isSearching={searchMutation.isPending}
            resolvedGuideSequence={resolvedGuideSequence}
            seedLength={seedLength}
            query={query}
            onSeedLengthChange={onSeedLengthChange}
            onQueryChange={onQueryChange}
            onSubmit={handleSubmit}
          />
          {searchMutation.isError && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border px-4 py-3 text-sm">
              {searchMutation.error.message}
            </div>
          )}
          <SeedFinderResults results={results} />
        </CardContent>
      </Card>
    </div>
  );
}
