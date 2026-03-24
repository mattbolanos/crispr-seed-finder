"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DNA_REGEX, REQUIRED_LENGTH } from "@/lib/dna";
import { cn } from "@/lib/utils";

const NUCLEOTIDE_COLORS: Record<string, string> = {
  A: "text-emerald-400",
  T: "text-rose-400",
  C: "text-sky-400",
  G: "text-amber-400",
};

interface DnaInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function DnaInput({ value, onChange }: DnaInputProps) {
  const isValidChars = value.length === 0 || DNA_REGEX.test(value);
  const [touched, setTouched] = useState(false);

  let errorMessage = "";
  if (!isValidChars) {
    errorMessage = "Only A, T, C, G characters are allowed";
  } else if (touched && value.length > 0 && value.length !== REQUIRED_LENGTH) {
    errorMessage = `${REQUIRED_LENGTH - value.length} more bp needed`;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <Label htmlFor="dna-input">gRNA Sequence</Label>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {value.length}/{REQUIRED_LENGTH} bp
        </span>
      </div>
      <Input
        id="dna-input"
        placeholder="e.g. GGGCCGCCGCGGGCACGGAG"
        maxLength={REQUIRED_LENGTH}
        value={value}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          setTouched(false);
        }}
        onBlur={() => setTouched(true)}
        aria-invalid={!!errorMessage}
      />
      {/* Colored nucleotide preview */}

      <div className="flex gap-[2px] px-1" aria-hidden>
        {value.split("").map((char, i) => (
          <span
            key={`${i}-${char}`}
            className={cn(
              "font-mono text-xs font-bold transition-all duration-200",
              NUCLEOTIDE_COLORS[char] || "text-muted-foreground",
            )}
            style={{
              animationDelay: `${i * 30}ms`,
            }}
          >
            {char}
          </span>
        ))}
        {Array.from({ length: REQUIRED_LENGTH - value.length }).map((_, i) => (
          <span
            key={`empty-${i.toString()}`}
            className="text-muted-foreground/20 font-mono text-xs"
          >
            •
          </span>
        ))}
      </div>

      <div className="h-4">
        {errorMessage && (
          <p className="text-destructive/80 text-xs">{errorMessage}</p>
        )}
      </div>
    </div>
  );
}
