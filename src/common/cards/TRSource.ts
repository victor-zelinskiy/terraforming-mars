export const TR_SOURCES = [
  'oxygen',
  'temperature',
  'oceans',
  'tr',
  'venus',
  'moonHabitat',
  'moonMining',
  'moonLogistic',
] as const;

// TRSource represents the ways an action will gain TR. This is used
// exclusively to compute tax when Reds are in power.
export type TRSource = Partial<{
  oxygen: number,
  temperature: number,
  oceans: number,
  tr: number,
  venus: number
  moonHabitat: number,
  moonMining: number,
  moonLogistic: number,
}>

/**
 * The TR two (or more) sources grant TOGETHER.
 *
 * One action routinely carries two independent bumps — a standard project's own
 * terraforming PLUS the TR the chosen space grants for clearing its hazard — and
 * the Reds tax is owed on the SUM. Keeping only the last one written under-counts
 * the tax, and an under-counted tax is a payment prompt the player cannot answer.
 */
export function sumTRSources(...sources: ReadonlyArray<TRSource | undefined>): TRSource {
  const out: TRSource = {};
  for (const source of sources) {
    if (source === undefined) {
      continue;
    }
    for (const key of TR_SOURCES) {
      const value = source[key];
      if (value !== undefined) {
        out[key] = (out[key] ?? 0) + value;
      }
    }
  }
  return out;
}
