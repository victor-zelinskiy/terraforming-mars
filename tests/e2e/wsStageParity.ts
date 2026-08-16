/**
 * THE EMBEDDED WORKSPACE STAGE — the parity baseline, in ONE place.
 *
 * «Купить открытую карту?» (ConsoleTaskHost, embedded) and «Получена карта»
 * (ConsoleRevealOverlay, embedded) are the same moment and must present the
 * same screen. Both e2e specs measure their own stage and assert against these
 * numbers, so:
 *
 *  · the two stages can never drift apart silently — a change to one fails
 *    BOTH specs against the same constant, not one spec against the other;
 *  · the baseline is re-synced deliberately, in one edit, when the shared
 *    chassis genuinely changes (`.con-ws-stage-*` in console.less, the shared
 *    `ConsoleWsStageHead`, or `consoleWsStageLayout`).
 *
 * ── WHY THE CHASSIS BOX AND NOT THE CARD'S SCREEN RECT ─────────────────────
 * The pin used to be the hero's `boundingBox()`, which includes the FOCUSED
 * card's emphasis transform — so the same stage measured 472 or 494 depending
 * on whether input had opened yet, and the two specs disagreed for a reason
 * that had nothing to do with either stage. What actually has to match is the
 * chassis: the head, the row box, the status line, and the zoom the shared
 * layout engine solved from them. Those are transform-free and they ARE the
 * contract — the card size follows from them by construction.
 *
 * They are MEASURED values, not design targets: run either spec, read the
 * `[PARITY:<profile>]` line it prints, and paste it here.
 */
export type StageBox = {
  /** The shared header's reserved row. */
  headH: number,
  /** The card row's own box — the budget the layout engine is handed. */
  rowH: number,
  rowW: number,
  /** The reserved status line under the cards. */
  statusH: number,
  /** `--con-cards-zoom`, as the layout published it. */
  zoom: string,
  /** The embedded host's own box, and the workspace zone it was teleported
   *  into — the two must agree, or one stage is solving in a smaller room. */
  hostW: number,
  zoneW: number,
};

/**
 * Re-synced 2026-08-15 — the HUD/BAR UNIFICATION rework landed (one shared
 * `--con-hud-h` bar height, `--con-main-gap: var(--con-hud-gap)`, and
 * `--con-ws-left` re-derived through `--con-rail-outer-w`), so the band
 * between the two bars grew and the workspace zone widened on the scaled
 * profiles: the ROW gained height everywhere (fhd 719→768, tv4k 1356→1492,
 * deck 482→512), width on tv4k/deck (2340→2380, 828→840, with host/zone
 * following), and the zoom followed the taller room (1.475→1.581,
 * 2.736→3.032, 0.968→1.033). Heads and status lines are untouched, and the
 * PARITY these constants exist for was verified before pasting: at every
 * profile the purchase and receive stages measured BYTE-IDENTICAL boxes
 * (tv4k hero 970.23×1394.72 on both) — the chassis moved, the two stages
 * moved together.
 *
 * (2026-08-09 — the previous sync: only the zoom moved, when `wsStageLayout`
 * started SNAPPING onto the grid its own CSS is serialized with and the
 * vertical budget gained a sub-pixel guard.)
 */
export const WS_STAGE_BOX: Record<string, StageBox> = {
  // 2026-08-16 — the MIRRORED EDGE SYSTEM landed (`--con-pad-x` became
  // `var(--con-edge-x)`, `--con-rail-w` 9.1→10rem): a WIDTH-only re-sync.
  // fhd nets out unchanged (the freed edge went to the rail), tv4k +6px,
  // deck −17px; every height and zoom held, and the parity was verified
  // before pasting (purchase == receive byte-identical per profile).
  fhd: {headH: 36, rowH: 768, rowW: 1065, statusH: 48, zoom: '1.581', hostW: 1113, zoneW: 1113},
  tv4k: {headH: 94, rowH: 1492, rowW: 2386, statusH: 96, zoom: '3.032', hostW: 2482, zoneW: 2482},
  deck: {headH: 36, rowH: 512, rowW: 823, statusH: 44, zoom: '1.033', hostW: 859, zoneW: 859},
};

/**
 * The shared heading's computed voice per profile — `.con-ws-stage-title`
 * (1.3rem/700 base, 1.8rem on the TV ladder × the 4K rem base). Before the
 * ladder named the SHARED class, only the buy stage reached the 4K size (via
 * `html.con-profile-tv .con-task__title`) and the reveal stayed at 1.3rem.
 */
export const WS_STAGE_HEAD: Record<string, {size: string, weight: string}> = {
  fhd: {size: '26px', weight: '700'},
  tv4k: {size: '72px', weight: '700'},
  deck: {size: '26px', weight: '700'},
};

/**
 * Read the stage chassis out of an embedded host root. Identical on both
 * specs on purpose — a probe that differs is a comparison that proves nothing.
 */
export function stageProbe(root: Element): StageBox {
  const h = (sel: string) => (root.querySelector(sel) as HTMLElement | null)?.offsetHeight ?? 0;
  const row = root.querySelector('.con-ws-stage-row') as HTMLElement | null;
  return {
    headH: h('.con-ws-stage-head'),
    rowH: row?.offsetHeight ?? 0,
    rowW: row?.offsetWidth ?? 0,
    statusH: h('.con-ws-stage-status'),
    zoom: row === null ? '' : getComputedStyle(row).getPropertyValue('--con-cards-zoom').trim(),
    hostW: (root as HTMLElement).offsetWidth,
    zoneW: (root.closest('[data-outcome-zone]') as HTMLElement | null)?.offsetWidth ?? 0,
  };
}
