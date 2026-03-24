"use client";

import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SeedFinderIntro() {
  return (
    <CardHeader className="text-center">
      <CardDescription className="font-mono text-xs tracking-widest uppercase">
        CRISPR Analysis
      </CardDescription>
      <CardTitle className="text-2xl">Seed Finder Tool</CardTitle>
      <CardDescription>
        PAM-proximal seed matches in TSS regions
      </CardDescription>
      <div className="text-muted-foreground mt-4 space-y-3 text-left text-sm">
        <p className="text-foreground font-semibold">
          Cas9 guide RNA seed matches near TSS loci
        </p>
        <p>
          Seed sequences are identified by searching +/-1,000 bp of annotated
          transcription start sites (TSS) using the human reference genome hg38.
          Only perfect matches are considered. Seed matches are reported for
          MANE TSSs which are protein coding. Seed-mediated off-target activity
          at non-protein coding transcripts may also result in off-target
          effects. The seed matches for a given seed match length include all
          seed matches equal to or greater than that length (eg if a seed match
          is 13 bp, it will also appear under 12 bp seed matches). All reported
          seed matches are adjacent to an &apos;NGG&apos; Cas9 PAM sequence.
        </p>
        <p>
          While off-target seed matches may apply to enzymatically active Cas9,
          our analysis focused on seed-mediated off-targets specifically with
          KRAB-dCas9 (CRISPRi), while other seed-mediated off-target work has
          utilized CRISPRa systems.
        </p>
        <p>
          You can read more in our preprint{" "}
          <a
            className="text-primary underline hover:no-underline"
            href="https://biorxiv.org"
            target="_blank"
            rel="noreferrer"
          >
            here
          </a>{" "}
          (TODO: update when preprint out) and run the described method yourself{" "}
          <a
            className="text-primary underline hover:no-underline"
            href="https://github.com/AustinHartman/perturb_seed"
            target="_blank"
            rel="noreferrer"
          >
            here
          </a>
          .
        </p>
      </div>
    </CardHeader>
  );
}
