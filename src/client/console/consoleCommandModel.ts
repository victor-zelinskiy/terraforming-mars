/**
 * consoleCommandModel — the PURE fit model of the console command bar
 * (docs/CONSOLE_TV_PREMIUM_PLAN.md §3.2).
 *
 * The TV rule: a hint label is NEVER truncated. When a state's command run
 * does not fit the bar's two bay zones, whole low-priority commands are
 * DROPPED (they remain reachable — every dropped hint is an on-screen
 * affordance or a global control discoverable from the board home), and the
 * primary verbs (A / B) are never dropped. Ellipsis in the bar is a bug.
 *
 * Pure math (no Vue/DOM/i18n) — unit-tested under the server runner. The
 * bar feeds estimated label widths (consoleHandDock.commandWidthRem) and
 * its two zone budgets; this module decides WHICH commands render and how
 * they split around the hand-dock bay.
 */

import {bayCommandSplit} from '@/client/console/consoleHandDock';
import {GlyphControl} from '@/client/gamepad/glyphSets';

/**
 * ONE console command (a bar hint = the live meaning of a physical control).
 * Lives HERE (pure TS) so plain .ts modules (consolePanelUi, the *Ui
 * mirrors) can import the type — a named type import from a .vue file
 * breaks the mochapack test bundle (see the fork's Card.vue gotcha).
 * ConsoleCommandBar.vue re-exports it for the .vue importers.
 */
export type ConsoleCommand = {
  control: GlyphControl,
  /** A paired second glyph (LB+RB acting as ONE command, e.g. «Бонус»). */
  control2?: GlyphControl,
  /** English i18n key. */
  label: string,
  enabled?: boolean,
  /** Availability count (LB Достижения ②) — rendered as a badge chip. */
  badge?: number,
  /** Something is claimable behind this command — the glyph+label glow. */
  highlight?: boolean,
  /**
   * TV fit model: when the run overflows the bay zones, WHOLE commands drop
   * instead of labels truncating. Higher drops first; omitted → derived
   * from the control class (defaultDropPriority). A/B never drop.
   */
  priority?: number,
};

/** The subset of ConsoleCommand the fit model needs (kept dependency-free). */
export type CommandFitEntry = {
  /** Estimated rendered width, rem (consoleHandDock.commandWidthRem). */
  width: number,
  /** Never drop (the A/B contract — a primary verb must always show). */
  keep: boolean,
  /**
   * Drop order among the droppable: HIGHER drops first. Callers derive it
   * from the control class (global/stick hints 3, bumper/trigger chords 2,
   * X-verbs 1) or pass an explicit per-command override.
   */
  dropPriority: number,
};

export type CommandRunPlan = {
  /** Indices (into the input run) that RENDER, in original order. */
  kept: ReadonlyArray<number>,
  /** Indices dropped to fit the zones (original order). */
  dropped: ReadonlyArray<number>,
  /** How many of `kept` render in the LEFT zone (bayCommandSplit). */
  splitIndex: number,
};

/**
 * Fit a command run into the bay bar's two zones. Greedy: while the total
 * estimated width exceeds the combined zone budget, drop the highest
 * `dropPriority` droppable (ties: the WIDEST first — frees the most room;
 * then the latest). `keep` entries never drop; if only keeps remain and
 * still overflow, everything kept renders (the CSS clip is the last-resort
 * guard — with ≤4 primary verbs this cannot happen on any real profile).
 */
export function planCommandRun(
  entries: ReadonlyArray<CommandFitEntry>,
  zoneLeftRem: number,
  zoneRightRem: number,
): CommandRunPlan {
  const budget = Math.max(0, zoneLeftRem) + Math.max(0, zoneRightRem);
  const keptSet = new Set<number>(entries.map((_, i) => i));
  const total = () => {
    let sum = 0;
    for (const i of keptSet) {
      sum += entries[i].width;
    }
    return sum;
  };
  while (total() > budget) {
    let victim = -1;
    for (const i of keptSet) {
      const e = entries[i];
      if (e.keep) {
        continue;
      }
      if (victim === -1) {
        victim = i;
        continue;
      }
      const v = entries[victim];
      if (e.dropPriority > v.dropPriority ||
        (e.dropPriority === v.dropPriority && (e.width > v.width || (e.width === v.width && i > victim)))) {
        victim = i;
      }
    }
    if (victim === -1) {
      break; // only keeps left — render them all, CSS clips as last resort
    }
    keptSet.delete(victim);
  }
  const kept = entries.map((_, i) => i).filter((i) => keptSet.has(i));
  const dropped = entries.map((_, i) => i).filter((i) => !keptSet.has(i));
  const splitIndex = bayCommandSplit(kept.map((i) => entries[i].width), zoneLeftRem, zoneRightRem);
  return {kept, dropped, splitIndex};
}

/**
 * Default drop priority by glyph control: the primary face verbs never
 * drop; X-verbs go last among the droppable; chords and global/stick
 * hints (re-discoverable from the board home / visible on-screen) go
 * first. An explicit per-command `priority` overrides this.
 */
export function defaultDropPriority(control: string): number {
  switch (control) {
  case 'confirm':
  case 'back':
    return 0; // callers also set keep=true for these
  case 'secondary':
    return 1;
  case 'bumperL':
  case 'bumperR':
  case 'triggerL':
  case 'triggerR':
    return 2;
  default:
    return 3; // view / stick / dpad hints — visible or global affordances
  }
}
