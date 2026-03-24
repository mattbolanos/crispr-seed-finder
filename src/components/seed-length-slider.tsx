"use client";

import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

const MIN = 6;
const MAX = 12;

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
        min={MIN}
        max={MAX}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
      <div className="flex justify-between text-xs tabular-nums">
        <span>{MIN}</span>
        <span>{MAX}</span>
      </div>
    </div>
  );
}
