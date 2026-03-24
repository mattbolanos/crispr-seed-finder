"use client";

import {
  DownloadIcon,
  EyeIcon,
  HistoryIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { useSyncExternalStore } from "react";
import { buildSeedMatchesCsv } from "@/components/seed-finder/columns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { SeedMatchesResponse } from "@/lib/seed-search";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface SeedMatchesRequest {
  sequence: string;
  minSeed: number;
}

export interface SearchHistoryEntry {
  id: string;
  createdAt: string;
  request: SeedMatchesRequest;
  response: SeedMatchesResponse;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEARCH_HISTORY_STORAGE_KEY = "seed-finder-search-history:v1";
const SEARCH_HISTORY_LIMIT = 10;
const EMPTY_SEARCH_HISTORY: SearchHistoryEntry[] = [];

let cachedSearchHistoryRaw: string | null | undefined;
let cachedSearchHistoryEntries: SearchHistoryEntry[] = EMPTY_SEARCH_HISTORY;

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function buildHistoryEntryRenderKey(entry: SearchHistoryEntry, index: number) {
  return [
    entry.id,
    entry.createdAt,
    entry.request.sequence,
    entry.request.minSeed,
    index,
  ].join(":");
}

export function buildCsv(data: SeedMatchesResponse) {
  return buildSeedMatchesCsv(data);
}

function parseStoredHistory(value: string | null) {
  if (!value) {
    return [] as SearchHistoryEntry[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [] as SearchHistoryEntry[];
    }

    return parsed.filter((entry): entry is SearchHistoryEntry => {
      if (!entry || typeof entry !== "object") {
        return false;
      }

      const candidate = entry as Partial<SearchHistoryEntry>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.createdAt === "string" &&
        typeof candidate.request?.sequence === "string" &&
        typeof candidate.request?.minSeed === "number" &&
        typeof candidate.response?.sequence === "string" &&
        typeof candidate.response?.minSeed === "number" &&
        Array.isArray(candidate.response?.kmers) &&
        Array.isArray(candidate.response?.matches)
      );
    });
  } catch {
    return [] as SearchHistoryEntry[];
  }
}

function readSearchHistory() {
  if (typeof window === "undefined") {
    return EMPTY_SEARCH_HISTORY;
  }

  const storedValue = window.localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);

  if (storedValue === cachedSearchHistoryRaw) {
    return cachedSearchHistoryEntries;
  }

  cachedSearchHistoryRaw = storedValue;
  cachedSearchHistoryEntries =
    storedValue === null
      ? EMPTY_SEARCH_HISTORY
      : parseStoredHistory(storedValue);

  return cachedSearchHistoryEntries;
}

function writeSearchHistory(entries: SearchHistoryEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    SEARCH_HISTORY_STORAGE_KEY,
    JSON.stringify(entries.slice(0, SEARCH_HISTORY_LIMIT)),
  );

  window.dispatchEvent(new CustomEvent("search-history-updated"));
}

function subscribeToSearchHistory(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener("search-history-updated", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("search-history-updated", onStoreChange);
  };
}

function getServerSearchHistorySnapshot() {
  return EMPTY_SEARCH_HISTORY;
}

export function upsertSearchHistoryEntry(entry: SearchHistoryEntry) {
  const nextHistory = [
    entry,
    ...readSearchHistory().filter(
      (historyEntry) => historyEntry.id !== entry.id,
    ),
  ].slice(0, SEARCH_HISTORY_LIMIT);

  writeSearchHistory(nextHistory);
}

export function deleteSearchHistoryEntry(entryId: string) {
  const nextHistory = readSearchHistory().filter(
    (entry) => entry.id !== entryId,
  );
  writeSearchHistory(nextHistory);
}

export function clearSearchHistory() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SEARCH_HISTORY_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("search-history-updated"));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HistoryEntryCard({
  entry,
  isActive,
  onRestore,
  onDelete,
}: {
  entry: SearchHistoryEntry;
  isActive: boolean;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(buildCsv(entry.response))}`;
  const matchCount = entry.response.matches.length;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="font-mono text-sm tracking-tight">
          {entry.request.sequence}
        </CardTitle>
        <CardAction>
          <Button
            type="button"
            variant="ghost-destructive"
            size="icon-sm"
            aria-label={`Delete search for ${entry.request.sequence}`}
            onClick={onDelete}
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        </CardAction>
        <CardDescription className="flex flex-wrap items-center gap-1.5">
          {isActive && (
            <Badge variant="success" size="sm">
              Current
            </Badge>
          )}
          <Badge variant="outline" size="sm">
            seed {entry.request.minSeed}
          </Badge>
          <Badge variant={matchCount > 0 ? "success" : "outline"} size="sm">
            {matchCount} match{matchCount === 1 ? "" : "es"}
          </Badge>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="text-muted-foreground space-y-1 text-xs">
          <p>{dateTimeFormatter.format(new Date(entry.createdAt))}</p>
          <p className="font-mono text-[11px]">
            k-mers: {entry.response.kmers.join(", ")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <SheetClose asChild>
            <Button
              type="button"
              variant={isActive ? "secondary" : "open"}
              size="sm"
              className="flex-1"
              onClick={onRestore}
              disabled={isActive}
            >
              {isActive ? <EyeIcon /> : <SearchIcon />}
              {isActive ? "Viewing" : "Load results"}
            </Button>
          </SheetClose>
          {matchCount > 0 && (
            <Button asChild variant="outline" size="sm">
              <a
                href={csvHref}
                download={`seed-matches-k${entry.response.minSeed}-${entry.response.kmers.join("-")}.csv`}
              >
                <DownloadIcon className="size-3.5" />
                CSV
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface SearchHistoryProps {
  activeRunId: string | null;
  onRestore: (entry: SearchHistoryEntry) => void;
}

export function SearchHistory({ activeRunId, onRestore }: SearchHistoryProps) {
  const entries = useSyncExternalStore(
    subscribeToSearchHistory,
    readSearchHistory,
    getServerSearchHistorySnapshot,
  );

  if (entries.length === 0) {
    return null;
  }

  const deleteHistoryEntry = (entryId: string) => {
    deleteSearchHistoryEntry(entryId);
  };

  const clearHistory = () => {
    clearSearchHistory();
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="default"
          size="icon-lg"
          className={cn(
            "fixed top-2 right-2 z-40 gap-2 shadow-lg sm:top-4 sm:right-4",
            entries.length === 0 ? "hidden" : "",
          )}
          disabled={entries.length === 0}
        >
          <HistoryIcon className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <HistoryIcon className="size-4" />
            Search History
          </SheetTitle>
          <SheetDescription>
            Past searches stored locally in this browser.
          </SheetDescription>
        </SheetHeader>

        <Separator />

        <ScrollArea className="-mx-2 mt-2 flex-1">
          <div className="space-y-3 px-6 py-1">
            {entries.map((entry, index) => (
              <HistoryEntryCard
                key={buildHistoryEntryRenderKey(entry, index)}
                entry={entry}
                isActive={entry.id === activeRunId}
                onRestore={() => onRestore(entry)}
                onDelete={() => deleteHistoryEntry(entry.id)}
              />
            ))}
          </div>
        </ScrollArea>

        <Separator />

        <SheetFooter>
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={clearHistory}
          >
            <Trash2Icon />
            Clear all history
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
