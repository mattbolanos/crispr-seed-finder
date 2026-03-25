# CRISPR Seed Finder

CRISPR Seed Finder is a Next.js app for searching CRISPR seed matches from a DNA sequence. It lets you enter a sequence, choose a supported seed length, and query precomputed k-mer shard data for matching genomic hits.

## Uploading Dolcetto Guide Libraries

The Dolcetto guide alias lookup expects these R2 objects to exist:

- `guide-libraries/dolcetto-set-a.txt`
- `guide-libraries/dolcetto-set-b.txt`

Upload local Dolcetto txt files with:

```bash
npm run upload:guide-libraries -- \
  --set-a /path/to/dolcetto-set-a.txt \
  --set-b /path/to/dolcetto-set-b.txt
```

The uploader loads `.env.local` automatically. Use `--dry-run` to verify the target keys before uploading.
