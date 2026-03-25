const GUIDE_ALIAS_NORMALIZER_REGEX = /[^a-z0-9]+/g;
const GUIDE_ALIAS_TRIM_REGEX = /^_+|_+$/g;

const GUIDE_LIBRARY_PREFIXES = [
  {
    aliases: ["dolcetto_seta", "dolcetto_set_a", "dolcetto_a"],
    canonical: "dolcetto_seta",
  },
  {
    aliases: ["dolcetto_setb", "dolcetto_set_b", "dolcetto_b"],
    canonical: "dolcetto_setb",
  },
] as const;

export function normalizeGuideQuery(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replaceAll(GUIDE_ALIAS_NORMALIZER_REGEX, "_")
    .replaceAll(GUIDE_ALIAS_TRIM_REGEX, "");
}

export function canonicalizeGuideQuery(value: string) {
  const normalizedValue = normalizeGuideQuery(value);

  for (const prefix of GUIDE_LIBRARY_PREFIXES) {
    for (const alias of prefix.aliases) {
      if (normalizedValue === alias) {
        return prefix.canonical;
      }

      if (normalizedValue.startsWith(`${alias}_`)) {
        return `${prefix.canonical}${normalizedValue.slice(alias.length)}`;
      }
    }
  }

  return normalizedValue;
}
