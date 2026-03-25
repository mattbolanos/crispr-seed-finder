import "server-only";

import {
  GUIDE_LIBRARY_FILES,
  type GuideHandler,
} from "@/lib/guide-library-manifest";
import { canonicalizeGuideQuery, normalizeGuideQuery } from "@/lib/guide-query";
import { fetchR2TextFile } from "@/lib/r2";
import { isSequenceSearchable, normalizeSequence } from "@/lib/seed-search";

const GUIDE_ALIAS_EXAMPLE = "dolcetto_seta_gata3_g1";

interface GuideLibraryData {
  guideHandlers: GuideHandler[];
  guideLookup: Map<string, string>;
}

let guideLibraryDataPromise: Promise<GuideLibraryData> | null = null;

async function buildGuideLookup() {
  const guideHandlers: GuideHandler[] = [];
  const lookup = new Map<string, string>();

  for (const source of GUIDE_LIBRARY_FILES) {
    const fileContents = await fetchR2TextFile(source.objectKey);

    if (!fileContents) {
      throw new Error(`Missing guide library in R2: ${source.objectKey}`);
    }

    const guideIndexesByGene = new Map<string, number>();

    for (const line of fileContents.split("\n").slice(1)) {
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        continue;
      }

      const [sequence, geneSymbol] = trimmedLine.split("\t");

      if (!sequence || !geneSymbol) {
        continue;
      }

      const normalizedGeneSymbol = normalizeGuideQuery(geneSymbol);

      if (!normalizedGeneSymbol) {
        continue;
      }

      const nextGuideIndex =
        (guideIndexesByGene.get(normalizedGeneSymbol) ?? 0) + 1;

      guideIndexesByGene.set(normalizedGeneSymbol, nextGuideIndex);

      const normalizedSequence = normalizeSequence(sequence);
      const canonicalAlias = `${source.aliases[0]}_${normalizedGeneSymbol}_g${nextGuideIndex}`;

      guideHandlers.push({
        alias: canonicalAlias,
        sequence: normalizedSequence,
      });
      lookup.set(canonicalAlias, normalizedSequence);
    }
  }

  return {
    guideHandlers,
    guideLookup: lookup,
  };
}

async function getGuideLibraryData() {
  if (!guideLibraryDataPromise) {
    guideLibraryDataPromise = buildGuideLookup().catch((error) => {
      guideLibraryDataPromise = null;
      throw error;
    });
  }

  return guideLibraryDataPromise;
}

export async function resolveGuideSequence(query: string) {
  const normalizedQuery = normalizeSequence(query);

  if (isSequenceSearchable(normalizedQuery)) {
    return normalizedQuery;
  }

  const { guideLookup } = await getGuideLibraryData();
  return guideLookup.get(canonicalizeGuideQuery(query)) ?? null;
}

export async function listGuideHandlers() {
  const { guideHandlers } = await getGuideLibraryData();
  return guideHandlers;
}

export function getGuideLookupExample() {
  return GUIDE_ALIAS_EXAMPLE;
}
