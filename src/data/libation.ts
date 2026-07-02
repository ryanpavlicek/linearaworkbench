// The recognized libation-formula vocabulary — the recurring words of the
// dedicatory formula on stone vessels and libation tables. One shared list
// so the tablet-structure classifier and the Libation Formulas module can
// never disagree about which inscriptions are libation texts.

export const LIBATION_WORDS: readonly string[] = [
  "A-TA-I-*301-WA-JA",
  "JA-SA-SA-RA-ME",
  // The a-di-ki-te family, as the corpus actually attests it. The list once
  // carried "A-DI-KI-TE-TE-DU", which matches zero corpus tokens: it is a
  // fragment of the restored reading of PK Za 11 (Younger, ad loc., reads
  // the damaged word as A-DI-KI-TE-TE-DU-PU-RE), not a word any inscription
  // carries. Attested forms: A-DI-KI-TE (PK Za 12), A-DI-KI-TE-TE (PK Za 11),
  // and the ja-prefixed JA-DI-KI-TE-TE-DU-PU₂-RE (PK Za 15) /
  // JA-DI-KI-TE-TE-*307-PU₂-RE (PK Za 8). Whether these are variants of one
  // word (often connected to Mt. Dikte) is contested — exploratory grouping.
  "A-DI-KI-TE",
  "A-DI-KI-TE-TE",
  "JA-DI-KI-TE-TE-DU-PU₂-RE",
  "JA-DI-KI-TE-TE-*307-PU₂-RE",
  "TA-NA-TE",
  "I-DA-MA-TE",
  "SI-RU-TE",
  "DI-KI-SE",
  "A-SA-SA-RA-ME",
  "PI-TE-RI",
  "U-NA-KA-NA-SI",
  "I-PI-NA-MA",
];

export const LIBATION_WORD_SET: ReadonlySet<string> = new Set(LIBATION_WORDS);
