import {BoardName} from '@/common/boards/BoardName';

/**
 * Data-driven "board fingerprint" for the premium mini map preview.
 *
 * These weights are tallied from the real board definitions (`src/server/boards/
 * *Board.ts`) — relative magnitudes of each placement bonus + each map's
 * signature special bonus. The preview component renders a stylised hex cluster
 * filled by these weights, so each map reads visibly differently ("what kind of
 * map is this?") without shipping per-hex layouts or screenshots. Real preview
 * assets can replace this later; the component stays the same.
 */

export type FingerprintBonus =
  | 'plant' | 'steel' | 'titanium' | 'card' | 'heat' | 'ocean'
  | 'energy' | 'microbe' | 'animal' | 'temperature' | 'colony';

export type BoardFingerprint = {
  /** Relative bonus weights (any positive scale; the renderer normalises). */
  weights: Partial<Record<FingerprintBonus, number>>;
  /** The map's distinguishing special bonus, highlighted in the preview. */
  signature?: FingerprintBonus;
};

const FINGERPRINTS: Record<BoardName, BoardFingerprint> = {
  [BoardName.THARSIS]: {weights: {plant: 8, steel: 3, card: 2, titanium: 1, ocean: 3}},
  [BoardName.HELLAS]: {weights: {plant: 5, steel: 3, titanium: 2, card: 2, heat: 3, ocean: 3}, signature: 'heat'},
  [BoardName.ELYSIUM]: {weights: {plant: 7, steel: 3, card: 2, titanium: 2, ocean: 3}},
  [BoardName.UTOPIA_PLANITIA]: {weights: {plant: 5, steel: 3, card: 2, energy: 2, ocean: 3}, signature: 'energy'},
  [BoardName.TERRA_CIMMERIA_NOVA]: {weights: {steel: 4, titanium: 3, plant: 4, card: 2, colony: 1, ocean: 2}, signature: 'colony'},
  [BoardName.VASTITAS_BOREALIS]: {weights: {plant: 5, steel: 3, titanium: 2, heat: 3, temperature: 1, ocean: 2}, signature: 'temperature'},
  [BoardName.AMAZONIS]: {weights: {plant: 6, heat: 3, microbe: 2, animal: 1, ocean: 3}, signature: 'animal'},
  [BoardName.TERRA_CIMMERIA]: {weights: {plant: 6, steel: 3, card: 2, energy: 2, ocean: 3}, signature: 'energy'},
  [BoardName.HOLLANDIA]: {weights: {plant: 6, steel: 2, titanium: 2, heat: 2, ocean: 3}},
  // Not offered in the premium UI (outside scope) but kept so the Record is total.
  [BoardName.VASTITAS_BOREALIS_NOVA]: {weights: {plant: 5, steel: 3, titanium: 2, ocean: 3}},
  [BoardName.ARABIA_TERRA]: {weights: {plant: 5, steel: 3, microbe: 2, ocean: 3}, signature: 'microbe'},
};

export function boardFingerprint(id: BoardName): BoardFingerprint {
  return FINGERPRINTS[id] ?? {weights: {plant: 6, steel: 3, ocean: 3}};
}

/**
 * Expand a fingerprint into an ordered list of `count` bonus cells, sampled
 * deterministically from the weights (seeded by the map id so the pattern is
 * stable across renders). The signature bonus is guaranteed at least one cell.
 */
export function fingerprintCells(id: BoardName, count: number): Array<FingerprintBonus> {
  const fp = boardFingerprint(id);
  const entries = Object.entries(fp.weights) as Array<[FingerprintBonus, number]>;
  const total = entries.reduce((s, [, w]) => s + w, 0) || 1;

  // Largest-remainder allocation → stable integer counts per bonus.
  const alloc = entries.map(([bonus, w]) => {
    const exact = (w / total) * count;
    return {bonus, base: Math.floor(exact), frac: exact - Math.floor(exact)};
  });
  let used = alloc.reduce((s, a) => s + a.base, 0);
  alloc.sort((a, b) => b.frac - a.frac);
  for (let i = 0; used < count && i < alloc.length; i++, used++) {
    alloc[i].base++;
  }

  const cells: Array<FingerprintBonus> = [];
  for (const a of alloc) {
    for (let i = 0; i < a.base; i++) {
      cells.push(a.bonus);
    }
  }
  if (fp.signature !== undefined && !cells.includes(fp.signature) && cells.length > 0) {
    cells[cells.length - 1] = fp.signature;
  }

  // Deterministic shuffle (seeded by a hash of the map id) so the icon pattern
  // is stable but distinct per map.
  let seed = 0;
  for (let i = 0; i < id.length; i++) {
    seed = (seed * 31 + id.charCodeAt(i)) & 0xffffffff;
  }
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells;
}
