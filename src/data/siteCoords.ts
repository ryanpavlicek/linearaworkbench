// Approximate latitude/longitude for every find-site attested in the corpus.
// Sources: standard archaeological references (GORILA, Younger, Wikipedia
// gazetteers). Coordinates are rounded to ~2 decimals (≈1 km) which is
// plenty for site-level mapping.
//
// Sites without precise data are left out — they fall back to a "remote /
// unmapped" list in the Findspot Map module.

export interface SiteCoord {
  name: string;
  lat: number;
  lon: number;
  region: "crete" | "aegean" | "anatolia" | "levant" | "mainland" | "remote";
  // Set when the provenance is disputed: the entry exists because the upstream
  // corpus carries it, but it is not an accepted Linear A find-spot. The string
  // is the reason, surfaced wherever the site is plotted so it is never shown
  // as a genuine provenance.
  contested?: string;
}

export const SITE_COORDS: Record<string, SiteCoord> = {
  // Crete — major palatial / administrative centers
  "Haghia Triada": { name: "Haghia Triada", lat: 35.06, lon: 24.79, region: "crete" },
  "Khania": { name: "Khania", lat: 35.51, lon: 24.02, region: "crete" },
  "Phaistos": { name: "Phaistos", lat: 35.05, lon: 24.81, region: "crete" },
  "Knossos": { name: "Knossos", lat: 35.3, lon: 25.16, region: "crete" },
  "Zakros": { name: "Zakros", lat: 35.1, lon: 26.26, region: "crete" },
  "Malia": { name: "Malia", lat: 35.29, lon: 25.49, region: "crete" },
  "Palaikastro": { name: "Palaikastro", lat: 35.2, lon: 26.27, region: "crete" },

  // Crete — peak sanctuaries, secondary sites, caves
  "Iouktas": { name: "Iouktas (Mt Juktas)", lat: 35.23, lon: 25.16, region: "crete" },
  "Arkhalkhori": { name: "Arkhalokhori", lat: 35.15, lon: 25.3, region: "crete" },
  "Petras": { name: "Petras", lat: 35.21, lon: 26.1, region: "crete" },
  "Syme": { name: "Syme sanctuary", lat: 35.07, lon: 25.55, region: "crete" },
  "Tylissos": { name: "Tylissos", lat: 35.32, lon: 25.01, region: "crete" },
  "Gournia": { name: "Gournia", lat: 35.11, lon: 25.79, region: "crete" },
  "Pyrgos": { name: "Pyrgos", lat: 35.01, lon: 25.16, region: "crete" },
  "Mokhilos": { name: "Mochlos", lat: 35.19, lon: 25.91, region: "crete" },
  "Psykhro": { name: "Psychro cave", lat: 35.16, lon: 25.43, region: "crete" },
  "Vrysinas": { name: "Vrysinas peak sanctuary", lat: 35.3, lon: 24.5, region: "crete" },
  "Apodoulou": { name: "Apodoulou", lat: 35.16, lon: 24.65, region: "crete" },
  "Kophinas": { name: "Kophinas peak sanctuary", lat: 35.0, lon: 24.95, region: "crete" },
  "Larani": { name: "Larani", lat: 35.18, lon: 25.05, region: "crete" },
  "Poros Herakleiou": { name: "Poros Herakleion", lat: 35.34, lon: 25.17, region: "crete" },
  "Zominthos": { name: "Zominthos", lat: 35.25, lon: 24.97, region: "crete" },
  "Kamilari": { name: "Kamilari", lat: 35.04, lon: 24.78, region: "crete" },
  "Kannia": { name: "Kannia", lat: 35.04, lon: 24.91, region: "crete" },
  "Nerokurou": { name: "Nerokurou", lat: 35.5, lon: 24.13, region: "crete" },
  "Platanos": { name: "Platanos", lat: 35.06, lon: 24.81, region: "crete" },
  "Sitia": { name: "Sitia", lat: 35.21, lon: 26.1, region: "crete" },
  "Skoteino Cave": { name: "Skoteino cave", lat: 35.3, lon: 25.39, region: "crete" },
  "Traostalos": { name: "Traostalos peak sanctuary", lat: 35.16, lon: 26.22, region: "crete" },
  "Trypiti": { name: "Trypiti", lat: 35.04, lon: 24.78, region: "crete" },
  "Armenoi": { name: "Armenoi", lat: 35.3, lon: 24.5, region: "crete" },
  "Fourni": { name: "Fourni (Knossos cemetery)", lat: 35.28, lon: 25.16, region: "crete" },
  "Troullos": { name: "Troullos", lat: 35.27, lon: 25.27, region: "crete" },
  "Papourou": { name: "Papourou", lat: 35.02, lon: 24.79, region: "crete" },
  "Prassa": { name: "Prassa", lat: 35.3, lon: 25.2, region: "crete" },
  "Selakanos": { name: "Selakanos", lat: 35.12, lon: 25.6, region: "crete" },
  "Skhinia": { name: "Skhinia", lat: 35.0, lon: 24.8, region: "crete" },
  "Kardamoutsa": { name: "Kardamoutsa", lat: 35.207, lon: 25.458, region: "crete" },
  "Kalo Chorafi": { name: "Kalo Chorafi", lat: 35.3, lon: 25.2, region: "crete" },
  "Haghios Stehanos": { name: "Hagios Stefanos", lat: 36.84, lon: 22.83, region: "mainland" },
  "Crete": { name: "Crete (unspecified)", lat: 35.2, lon: 24.9, region: "crete" },

  // Cyclades and other Aegean islands
  "Thera": { name: "Thera (Akrotiri)", lat: 36.36, lon: 25.4, region: "aegean" },
  "Kea": { name: "Kea (Ayia Irini)", lat: 37.61, lon: 24.34, region: "aegean" },
  "Milos": { name: "Milos (Phylakopi)", lat: 36.73, lon: 24.42, region: "aegean" },
  "Kythera": { name: "Kythera", lat: 36.230, lon: 23.029, region: "aegean" },
  "Samothrace": { name: "Samothrace", lat: 40.48, lon: 25.53, region: "aegean" },

  // Greek mainland
  "Mycenae": { name: "Mycenae", lat: 37.73, lon: 22.75, region: "mainland" },
  "Tiryns": { name: "Tiryns", lat: 37.6, lon: 22.8, region: "mainland" },

  // Anatolia
  "Miletos": { name: "Miletus", lat: 37.53, lon: 27.28, region: "anatolia" },
  "Troy": { name: "Troy", lat: 39.96, lon: 26.24, region: "anatolia" },

  // Levant / further afield
  "Tel Haror": { name: "Tel Haror (Negev)", lat: 31.38, lon: 34.61, region: "levant" },
  "Margiana": {
    name: "Margiana (Turkmenistan)",
    lat: 37.7,
    lon: 62.0,
    region: "remote",
    contested:
      "Disputed: no Linear A inscription is accepted from Central Asia. Present " +
      "in the upstream corpus but not a genuine find-spot — the only link is the " +
      "fringe 'Cretan Protolinear' theory, and the '1427 in Margiana' claim is a " +
      "misreading of the GORILA corpus total (1427 = all Linear A artefacts, " +
      "overwhelmingly Cretan).",
  },
};
