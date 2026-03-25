export const GUIDE_LIBRARY_OBJECT_PREFIX = "guide-libraries";

export interface GuideHandler {
  alias: string;
  sequence: string;
}

export const GUIDE_LIBRARY_FILES = [
  {
    aliases: ["dolcetto_seta", "dolcetto_set_a", "dolcetto_a"],
    label: "Dolcetto Set A",
    objectKey: `${GUIDE_LIBRARY_OBJECT_PREFIX}/dolcetto-set-a.txt`,
  },
  {
    aliases: ["dolcetto_setb", "dolcetto_set_b", "dolcetto_b"],
    label: "Dolcetto Set B",
    objectKey: `${GUIDE_LIBRARY_OBJECT_PREFIX}/dolcetto-set-b.txt`,
  },
] as const;
