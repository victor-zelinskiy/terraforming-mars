/**
 * P29 — the SHARED Hydronetwork compact-preview copy: ONE source for the
 * desktop journal-chip hover (`HydronetPreviewPopover`) and the console
 * journal inspect card (`ConsoleJournalPanel`), so the two shells can
 * never diverge on what the Hydronetwork "is".
 *
 * The Delta Project is presented as the global «Гидросеть» subsystem —
 * it has NO user-facing card (JournalCardChip suppresses fullscreen);
 * this compact rule line is its premium identity instead. Keys live in
 * `ru/ui.json` / `ru/console.json` like the rest of the UI copy.
 */
export const HYDRO_PREVIEW = {
  /** The display title (already translated across the fork). */
  titleKey: 'Mars Hydronetwork',
  /** One-line mechanical rule — what advancing the Hydronetwork means. */
  descriptionKey: 'Global project: spend energy to advance the Hydronetwork stage by stage and collect stage rewards.',
} as const;
