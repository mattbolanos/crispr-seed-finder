"use client";

import { SearchIcon } from "lucide-react";
import type { FormEvent } from "react";
import { DnaInput } from "@/components/dna-input";
import { SeedLengthSlider } from "@/components/seed-length-slider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface SeedFinderSearchControlsProps {
  isReady: boolean;
  isSearching: boolean;
  resolvedGuideSequence: string | null;
  seedLength: number;
  query: string;
  onSeedLengthChange: (value: number) => void;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function SeedFinderSearchControls({
  isReady,
  isSearching,
  resolvedGuideSequence,
  seedLength,
  query,
  onSeedLengthChange,
  onQueryChange,
  onSubmit,
}: SeedFinderSearchControlsProps) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <SeedLengthSlider value={seedLength} onChange={onSeedLengthChange} />
      <DnaInput
        resolvedGuideSequence={resolvedGuideSequence}
        value={query}
        onChange={onQueryChange}
        seedLength={seedLength}
      />
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!isReady || isSearching}
      >
        {isSearching ? <Spinner /> : <SearchIcon />}
        {isSearching ? "Searching..." : "Find Seeds"}
      </Button>
    </form>
  );
}
