"use client";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { MAX_SEED_LENGTH, MIN_SEED_LENGTH } from "@/lib/seed-search";

interface SeedLengthSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function SeedLengthSlider({ value, onChange }: SeedLengthSliderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <Label htmlFor="seed-length">Min Seed Length</Label>
        <Badge>{value}</Badge>
      </div>
      <Slider
        id="seed-length"
        min={MIN_SEED_LENGTH}
        max={MAX_SEED_LENGTH}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
      <div className="flex justify-between text-xs tabular-nums">
        <span>{MIN_SEED_LENGTH}</span>
        <span>{MAX_SEED_LENGTH}</span>
      </div>
    </div>
  );
}
