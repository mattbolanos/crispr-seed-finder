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
  seedLength: number;
  sequence: string;
  onSeedLengthChange: (value: number) => void;
  onSequenceChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function SeedFinderSearchControls({
  isReady,
  isSearching,
  seedLength,
  sequence,
  onSeedLengthChange,
  onSequenceChange,
  onSubmit,
}: SeedFinderSearchControlsProps) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <SeedLengthSlider value={seedLength} onChange={onSeedLengthChange} />
      <DnaInput
        value={sequence}
        onChange={onSequenceChange}
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
