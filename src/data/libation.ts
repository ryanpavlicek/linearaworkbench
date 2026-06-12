// The recognized libation-formula vocabulary — the recurring words of the
// dedicatory formula on stone vessels and libation tables. One shared list
// so the tablet-structure classifier and the Libation Formulas module can
// never disagree about which inscriptions are libation texts.

export const LIBATION_WORDS: readonly string[] = [
  "A-TA-I-*301-WA-JA",
  "JA-SA-SA-RA-ME",
  "A-DI-KI-TE-TE-DU",
  "TA-NA-TE",
  "I-DA-MA-TE",
  "SI-RU-TE",
  "DI-KI-SE",
  "A-SA-SA-RA-ME",
  "PI-TE-RI",
];

export const LIBATION_WORD_SET: ReadonlySet<string> = new Set(LIBATION_WORDS);
