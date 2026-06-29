// Pleiades place ids for the find-sites that align to a Pleiades place —
// the standard linked-open-data gazetteer for the ancient world
// (https://pleiades.stoa.org). Coordinate-verified against the site
// gazetteer; minor findspots and peak sanctuaries without a Pleiades place
// are simply absent. Keys match SITE_COORDS / the corpus `site` field.

export const PLEIADES_IDS: Record<string, number> = {
  "Haghia Triada": 589672,
  Khania: 589886,
  Phaistos: 589987,
  Knossos: 781961476,
  Zakros: 650881089,
  Malia: 589922,
  Palaikastro: 213924739,
  Iouktas: 589826,
  Arkhalkhori: 220781958,
  Petras: 743218113,
  Syme: 589805,
  Tylissos: 590084,
  Gournia: 771100776,
  Mokhilos: 484509128,
  Psykhro: 589675,
  Apodoulou: 119143959,
  Zominthos: 156165259,
  Kamilari: 589835,
  // GORILA site KA; the Pleiades date range (750 BC–AD 640) covers the site's
  // later phases, but the Linear A find (a bronze double-axe) is Bronze Age.
  Kardamoutsa: 589839,
  Thera: 599478,
  Kea: 570348,
  Milos: 570474,
  Kythera: 570400,
  Samothrace: 501596,
  Mycenae: 570491,
  Tiryns: 570740,
  Pylos: 570640,
  Miletos: 599799,
  Troy: 550595,
  Cyprus: 707498,
  Enkomi: 13818291,
  "Tel Haror": 687907,
  Margiana: 961934,
};

export function pleiadesUrl(site: string): string | null {
  const id = PLEIADES_IDS[site];
  return id ? `https://pleiades.stoa.org/places/${id}` : null;
}
