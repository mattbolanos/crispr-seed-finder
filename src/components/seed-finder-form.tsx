"use client";

import { Search } from "lucide-react";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { DnaInput } from "@/components/dna-input";
import { SeedLengthSlider } from "@/components/seed-length-slider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isDnaValid } from "@/lib/utils";

export function SeedFinderForm() {
  const [sequence, setSequence] = useQueryState(
    "sequence",
    parseAsString.withDefault("")
  );
  const [seedLength, setSeedLength] = useQueryState(
    "seedLength",
    parseAsInteger.withDefault(9)
  );

  const isReady = isDnaValid(sequence || "");

  return (
    <div className="flex flex-col items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardDescription className="font-mono text-xs uppercase tracking-widest">
            CRISPR Analysis
          </CardDescription>
          <CardTitle className="text-2xl">Seed Finder Tool</CardTitle>
          <CardDescription>
            PAM-proximal seed matches in TSS regions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-10">
          <SeedLengthSlider value={seedLength} onChange={setSeedLength} />
          <DnaInput value={sequence} onChange={setSequence} />
        </CardContent>
        <CardFooter>
          <Button size="lg" className="w-full" disabled={!isReady}>
            <Search data-icon="inline-start" />
            Find Seeds
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
