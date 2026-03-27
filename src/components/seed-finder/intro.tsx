"use client";

import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

function DescriptionParagraphs() {
  return (
    <div className="flex flex-col gap-3">
      <p>
        Seed sequences are identified by searching +/-1,000 bp of annotated
        transcription start sites (TSS) using the human reference genome hg38.
        Only perfect matches are considered. Seed matches are reported for MANE
        TSSs which are protein coding. Seed-mediated off-target activity at
        non-protein coding transcripts may also result in off-target effects.
        The seed matches for a given seed match length include all seed matches
        equal to or greater than that length (eg if a seed match is 13 bp, it
        will also appear under 12 bp seed matches). All reported seed matches
        are adjacent to an &apos;NGG&apos; Cas9 PAM sequence.
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
        and run the described method yourself{" "}
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
      <p>
        Accepted input formats are either a 20 basepair guide sequence where the last
        n bases are treated as the PAM-adjacent seed or a preloaded CRISPRi Dolcetto
        guide name such as dolcetto_seta_gapdh_g1 or dolcetto_setb_ms4a1_g3.
      </p>
    </div>
  );
}

export function SeedFinderIntro() {
  return (
    <CardHeader className="text-center">
      {/* <CardDescription className="font-mono text-xs tracking-widest uppercase">
        CRISPR Analysis
      </CardDescription> */}
      <CardTitle className="text-2xl">Cas9 Guide Seed Finder Tool</CardTitle>
      <CardDescription>
        PAM-proximal seed matches in TSS regions
      </CardDescription>
      <div className="text-muted-foreground mt-4 flex flex-col gap-3 text-left text-sm">
        {/* md+: always visible */}
        <div className="hidden md:block">
          <DescriptionParagraphs />
        </div>

        {/* Below md: open in a drawer */}
        <Drawer>
          <DrawerTrigger asChild>
            <Button size="sm" className="md:hidden" variant="outline">
              <Info />
              Learn more
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>About the Tool</DrawerTitle>
              <DrawerDescription>
                Cas9 guide RNA seed matches near TSS loci
              </DrawerDescription>
            </DrawerHeader>
            <div className="text-muted-foreground overflow-y-auto px-4 text-sm">
              <DescriptionParagraphs />
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </CardHeader>
  );
}
