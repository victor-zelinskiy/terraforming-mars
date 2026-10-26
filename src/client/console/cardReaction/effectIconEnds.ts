/*
 * @console-shared LIVE — console native stands on this file.
 *
 * WHERE A REACTION'S TOKEN IS BORN — the printed icon of the reacting card's
 * EFFECT ROW («СРАБАТЫВАНИЕ КАРТЫ — ОДИН ФРЕЙМВОРК», the owner's decision 2):
 * Hartlan Heating's «: 6 [heat] [1 M€ prod]» births six heat tokens on its
 * printed heat and the production token on its printed plate — never on the
 * card's body, never on the cause (the played card's tag, the composer's chip
 * — those are MARKED, not birth places).
 *
 * The row is addressed by the card file's `printedEffect` (the forecast's
 * block index — the n-th EFFECT frame of the face, in print order) when it
 * declares one; else by its CONTENT (the first effect frame whose result
 * prints the token's resource); else the whole face stands in (the k-th icon
 * grammar over everything it prints). Icons are resolved by the ONE icon
 * grammar every commit beat uses (`consoleActionCommitMotion.resolveGainIconEnds`
 * — the k-th token of a resource on the k-th icon that prints it, a
 * production step on its plate), as OBJECT ends re-measured at the birth
 * (T06 — a face that receded gets no token out of its old pose).
 */
import {ResourceTransferSpec, TransferEnd} from '@/client/console/resourceTransfer/resourceTransferModel';
import {iconMatches, resolveGainIconEnds} from '@/client/console/consoleActionCommitMotion';

/** The EFFECT frames of a rendered face (a corp box's effect half included), in print order — never an action frame. */
export function effectRowsOf(face: HTMLElement): Array<HTMLElement> {
  return Array.from(face.querySelectorAll<HTMLElement>('.pcard-effect'))
    .filter((row) => !row.classList.contains('pcard-effect--action'));
}

/** The RESULT part of an effect frame — the cluster after the colon (the whole frame when it prints one part). */
export function effectResultOf(row: HTMLElement): HTMLElement {
  const parts = row.querySelectorAll<HTMLElement>(':scope > .pcard-effect__part');
  return parts.length > 0 ? parts[parts.length - 1] : row;
}

/** The effect frame the tokens are born on: the declared block, else the frame that PRINTS the first token's resource. */
export function effectRowFor(face: HTMLElement, printedEffect: number | undefined, specs: ReadonlyArray<ResourceTransferSpec>): HTMLElement | undefined {
  const rows = effectRowsOf(face);
  if (rows.length === 0) {
    return undefined;
  }
  if (printedEffect !== undefined && rows[printedEffect] !== undefined) {
    return rows[printedEffect];
  }
  const first = specs[0];
  if (first !== undefined) {
    const key = first.resource === 'rating' ? 'tr' : first.resource;
    const printing = rows.find((row) => Array.from(effectResultOf(row).querySelectorAll<HTMLElement>('.pcard-ic')).some((icon) => iconMatches(icon, key)) ||
      (first.resource === 'megacredits' && effectResultOf(row).querySelector('.pcard-mi--mc') !== null));
    if (printing !== undefined) {
      return printing;
    }
  }
  return rows.length === 1 ? rows[0] : undefined;
}

/**
 * Does this effect frame print the token's own kind — a production step on a plate, a stock icon outside one?
 * Read over the WHOLE frame: a frame may print two results after two colons (Tharsis Republic's
 * «[city]* : [M€ prod] [city] : 3 [M€]» is ONE frame), and the trigger part prints the cause, not a resource.
 */
export function rowPrints(row: HTMLElement, spec: ResourceTransferSpec): boolean {
  const key = spec.resource === 'rating' ? 'tr' : spec.resource;
  const icons = Array.from(row.querySelectorAll<HTMLElement>('.pcard-ic'));
  const mcTiles = Array.from(row.querySelectorAll<HTMLElement>('.pcard-mi--mc'));
  const onPlate = (el: HTMLElement): boolean => el.closest('.pcard-prod') !== null;
  if (spec.channel === 'production') {
    return icons.some((icon) => onPlate(icon) && iconMatches(icon, key)) || (spec.resource === 'megacredits' && mcTiles.some(onPlate));
  }
  return icons.some((icon) => !onPlate(icon) && iconMatches(icon, key)) || (spec.resource === 'megacredits' && mcTiles.some((mc) => !onPlate(mc)));
}

/**
 * Each spec's birth place on the face, aligned by index — `undefined` for a
 * token the face prints no icon for (the caller degrades THAT token by name:
 * it ticks, nothing is born out of nowhere). With a DECLARED block every token
 * is born on it; without one EACH token finds the frame that prints ITS OWN
 * kind (Tharsis Republic: the 3 M€ on the «city: 3 M€» row, the production
 * step on the «city: [M€ prod]» row — the first field run resolved every token
 * against the first token's row and the production had nowhere to be born).
 */
export function resolveEffectIconEnds(face: HTMLElement, printedEffect: number | undefined, specs: ReadonlyArray<ResourceTransferSpec>): Array<TransferEnd | undefined> {
  const rows = effectRowsOf(face);
  const cardEl = face.querySelector<HTMLElement>('.pcard') ?? face;
  const declared = printedEffect !== undefined ? rows[printedEffect] : undefined;
  if (declared !== undefined || rows.length === 0) {
    return declared === undefined ? resolveGainIconEnds({cardEl}, specs) : resolveGainIconEnds({cardEl, groupEl: declared, resultEl: effectResultOf(declared)}, specs);
  }
  // Group the tokens by the frame that prints each one's kind; resolve every group on its own frame, scatter back.
  const out: Array<TransferEnd | undefined> = new Array(specs.length).fill(undefined);
  const groups = new Map<HTMLElement | undefined, Array<number>>();
  specs.forEach((spec, i) => {
    const row = rows.find((r) => rowPrints(r, spec)) ?? (rows.length === 1 ? rows[0] : undefined);
    const list = groups.get(row);
    if (list === undefined) {
      groups.set(row, [i]);
    } else {
      list.push(i);
    }
  });
  for (const [row, indexes] of groups) {
    const subset = indexes.map((i) => specs[i]);
    const ends = row === undefined ?
      resolveGainIconEnds({cardEl}, subset) :
      resolveGainIconEnds({cardEl, groupEl: row, resultEl: effectResultOf(row)}, subset);
    // A token the LAST part does not print may stand in an earlier result part of the same frame (the production
    // plate before Tharsis' second colon) — ask the whole frame for those before giving up.
    const missing = row === undefined ? [] : indexes.filter((_, k) => ends[k] === undefined);
    const retried = missing.length > 0 && row !== undefined ?
      resolveGainIconEnds({cardEl, groupEl: row, resultEl: row}, missing.map((i) => specs[i])) : [];
    indexes.forEach((i, k) => {
      out[i] = ends[k];
    });
    missing.forEach((i, k) => {
      out[i] = retried[k];
    });
  }
  return out;
}
