"use client";

import { useState } from "react";
import {
  SearchHistory,
  type SearchHistoryEntry,
} from "@/components/search-history";
import { SeedFinderForm } from "@/components/seed-finder-form";

export function SeedFinderPage() {
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [restoredEntry, setRestoredEntry] = useState<SearchHistoryEntry | null>(
    null,
  );

  return (
    <>
      <SearchHistory
        activeRunId={activeRunId}
        onRestore={(entry) => {
          setActiveRunId(entry.id);
          setRestoredEntry(entry);
        }}
      />
      <SeedFinderForm
        restoredEntry={restoredEntry}
        onSearchCompleted={(entry) => {
          setActiveRunId(entry.id);
          setRestoredEntry(null);
        }}
      />
    </>
  );
}
