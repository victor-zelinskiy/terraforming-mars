/**
 * UI-facing stage names for the Delta Project ("Гидросеть") track, indexed by
 * track position (0..11). These are English i18n KEYS — translated client-side
 * in the premium overlay AND in the journal via the STRING log token. Position 0
 * is the start; positions 10/11 are the 2 VP / 5 VP finish slots.
 *
 * Shared by the server (advance logging) and the client (overlay) so the names
 * never drift between the journal and the track.
 */
export const DELTA_STAGE_NAMES: ReadonlyArray<string> = [
  'Track start', // 0
  'Dam Foundations', // 1 — Building
  'Pumping Stations', // 2 — Power
  'Terran Hydro Standards', // 3 — Earth
  'Orbital Logistics', // 4 — Space
  'Hydrological Modeling', // 5 — Science
  'Shoreline Biostabilization', // 6 — Plant
  'Microbial Soil Fixation', // 7 — Microbe
  'External Contracts', // 8 — Jovian
  'Ecosystem Barriers', // 9 — Animal
  'Engineering Contribution', // 10 — 2 VP
  'Hydronetwork Architect', // 11 — 5 VP
] as const;
