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

const NUCLEOTIDE_UNDERLINES: Record<string, string> = {
  A: "decoration-emerald-400/60",
  T: "decoration-rose-400/60",
  C: "decoration-sky-400/60",
  G: "decoration-amber-400/60",
};

interface DnaInputProps {
  resolvedGuideSequence: string | null;
  value: string;
  onChange: (value: string) => void;
  seedLength: number;
}

export function DnaInput({
  resolvedGuideSequence,
  value,
  onChange,
  seedLength,
}: DnaInputProps) {
  const trimmedValue = value.trim();
  const isSequenceQuery =
    trimmedValue.length === 0 || DNA_REGEX.test(trimmedValue);
  const displayValue = isSequenceQuery ? trimmedValue.toUpperCase() : "";
  const isKnownGuide = !isSequenceQuery && resolvedGuideSequence !== null;
  const previewValue = (
    isSequenceQuery ? displayValue : (resolvedGuideSequence ?? "")
  ).toUpperCase();
  const [touched, setTouched] = useState(false);

  let errorMessage = "";
  if (touched && trimmedValue.length > 0) {
    if (isSequenceQuery && displayValue.length !== REQUIRED_LENGTH) {
      errorMessage =
        displayValue.length < REQUIRED_LENGTH
          ? `${REQUIRED_LENGTH - displayValue.length} more bp needed`
          : `Remove ${displayValue.length - REQUIRED_LENGTH} bp`;
    } else if (!isSequenceQuery && !isKnownGuide) {
      errorMessage = "Guide not found";
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <Label htmlFor="dna-input">gRNA Sequence</Label>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {isSequenceQuery
            ? `${displayValue.length}/${REQUIRED_LENGTH} bp`
            : "Guide alias"}
        </span>
      </div>
      <Input
        id="dna-input"
        placeholder="GGGCCGCCGCGGGCACGGAG or guide alias"
        maxLength={80}
        value={value}
        onChange={(e) => {
          const nextValue = e.target.value;

          onChange(
            DNA_REGEX.test(nextValue) ? nextValue.toUpperCase() : nextValue,
          );
          setTouched(false);
        }}
        onBlur={() => setTouched(true)}
        aria-invalid={!!errorMessage}
      />
      <div className="h-4 space-y-1 px-1">
        {previewValue.length > 0 ? (
          <div className="flex items-center gap-[2px]" aria-hidden>
            <span className="text-muted-foreground mr-1 font-mono text-xs">
              5&apos; -
            </span>
            {previewValue.split("").map((char, i) => {
              const isSeed = i >= REQUIRED_LENGTH - seedLength;
              return (
                <span
                  key={`${i}-${char}`}
                  className={cn(
                    "font-mono text-xs font-bold transition-all duration-200",
                    NUCLEOTIDE_COLORS[char] || "text-muted-foreground",
                    isSeed &&
                      cn(
                        "underline decoration-2 underline-offset-4",
                        NUCLEOTIDE_UNDERLINES[char] ||
                          "decoration-muted-foreground",
                      ),
                  )}
                  style={{
                    animationDelay: `${i * 30}ms`,
                  }}
                >
                  {char.replace("T", "U")}
                </span>
              );
            })}
            {Array.from({
              length: Math.max(REQUIRED_LENGTH - previewValue.length, 0),
            }).map((_, i) => (
              <span
                key={`empty-${i.toString()}`}
                className="text-muted-foreground/20 font-mono text-xs"
              >
                -
              </span>
            ))}
            <span className="text-muted-foreground/40 ml-1 font-mono text-xs font-bold">
              NGG
            </span>
            <span className="text-muted-foreground ml-1 font-mono text-xs">
              - 3&apos;
            </span>
          </div>
        ) : null}
      </div>

      <div className="h-4">
        {errorMessage && (
          <p className="text-destructive/80 text-xs">{errorMessage}</p>
        )}
      </div>
    </div>
  );
}
