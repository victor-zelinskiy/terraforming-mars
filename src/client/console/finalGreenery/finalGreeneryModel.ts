/*
 * FINAL GREENERY — the PURE model of the endgame beat where a player turns
 * leftover plants into greeneries, one at a time, until they choose to stop.
 *
 * WHY IT IS ITS OWN SCREEN. Structurally this is a two-branch `OrOptions`, and
 * the console used to render it as exactly that: two calm rows, «Выберите место
 * на поле →» and «Не размещать озеленение». The second row is not a decline.
 * It calls `playerIsDoneWithGame` — it ENDS THE PLAYER'S GAME, irreversibly,
 * while their remaining plants are still worth victory points. A row that reads
 * like "no thanks" and behaves like "I'm finished" is the most expensive
 * misclick in the match, so it gets a screen that says so: the conversion is
 * the offer, stopping is DESTRUCTIVE, and it takes two presses.
 *
 * Everything here is derived from the server's structural marker
 * (`finalGreeneryPrompt`) plus the public player model — never from titles.
 * No Vue, no DOM, no i18n: keys out, the surface translates. Unit-tested under
 * the server runner (tests/client/components/console/finalGreeneryModel.spec.ts).
 */

import {PlayerInputModel} from '@/common/models/PlayerInputModel';

/** What the player is choosing between. */
export type FinalGreeneryActionRole = 'place' | 'stop';

export type FinalGreeneryAction = {
  role: FinalGreeneryActionRole;
  /** Index into `OrOptions.options` — what gets submitted. */
  optionIndex: number;
  /** i18n KEY of the label. */
  titleKey: string;
  /** i18n KEY of the sub-line (where it leads / what it costs you). */
  leadKey: string;
  /** Stopping is irreversible: A arms it, a second A commits. */
  destructive: boolean;
};

export type FinalGreeneryViewModel = {
  /** Plants in stock right now. */
  plants: number;
  /** What one greenery costs THIS player (discounts already applied). */
  cost: number;
  /** How many more greeneries those plants can still pay for. */
  affordable: number;
  /** Legal spaces left on the board (server-supplied — a board rule). */
  spaces: number;
  actions: ReadonlyArray<FinalGreeneryAction>;
};

// ── copy keys (English text IS the i18n key) ────────────────────────────────

export const EYEBROW = 'End of the game';
export const HEADLINE = 'Turn plants into greeneries?';
export const PLACE_TITLE = 'Place a greenery';
export const PLACE_LEAD = 'Choose a location on the board';
export const STOP_TITLE = 'Finish your game';
export const STOP_LEAD = 'Your remaining plants stay unused';
export const STOP_ARMED = 'Press again to finish your game';
export const SUPPLY_LABEL = 'Plants';
export const AFFORDABLE_LABEL = 'Greeneries you can still place';

/**
 * Build the finale screen, or `undefined` when this prompt is not it. Like
 * every other console adapter, an unrecognised shape keeps its existing UI
 * rather than being half-rendered.
 *
 * @param viewer the public model of the player being asked (plants + the
 *   discount-aware greenery cost live there; the marker must not duplicate them).
 */
export function buildFinalGreenery(
  input: PlayerInputModel | undefined,
  viewer: {plants: number, plantsNeededForGreenery: number} | undefined,
): FinalGreeneryViewModel | undefined {
  const marker = input?.finalGreeneryPrompt;
  if (marker === undefined || input?.type !== 'or' || viewer === undefined) {
    return undefined;
  }
  // The branches are told apart by TYPE, never by title: the placement is a
  // board pick, stopping is a leaf.
  let placeIndex = -1;
  let stopIndex = -1;
  input.options.forEach((option, index) => {
    if (option.type === 'space' && placeIndex === -1) {
      placeIndex = index;
    } else if (option.type === 'option' && stopIndex === -1) {
      stopIndex = index;
    }
  });
  if (placeIndex === -1 || stopIndex === -1) {
    return undefined;
  }

  const cost = Math.max(1, viewer.plantsNeededForGreenery);
  return {
    plants: viewer.plants,
    cost,
    affordable: Math.floor(viewer.plants / cost),
    spaces: marker.spaces,
    actions: [
      {
        role: 'place',
        optionIndex: placeIndex,
        titleKey: PLACE_TITLE,
        leadKey: PLACE_LEAD,
        destructive: false,
      },
      {
        role: 'stop',
        optionIndex: stopIndex,
        titleKey: STOP_TITLE,
        leadKey: STOP_LEAD,
        destructive: true,
      },
    ],
  };
}

// ── the pad semantics (pure — the screen only renders and emits) ────────────

export type FinalGreeneryPress =
  /** Hand the placement to the board — the ordinary space-pick path. */
  | {kind: 'placement', optionIndex: number}
  /** First press on the irreversible branch: show what it means, wait. */
  | {kind: 'arm'}
  /** Second press on the armed branch — the game actually ends here. */
  | {kind: 'finish', optionIndex: number}
  /** Nothing to do (an unbound button). */
  | undefined;

/**
 * WHAT a press means. The destructive branch is deliberately the ONLY thing on
 * this screen that needs two presses — arming is not a style choice here, it is
 * the difference between "I meant it" and "I was mashing A through the endgame".
 *
 * B is not represented: there is nothing to step back to. The prompt is
 * mandatory and the surface has no cancel — the shell's defer (minimize to look
 * at the board) is handled where every other mandatory task handles it.
 */
export function finalGreeneryPressIntent(
  vm: FinalGreeneryViewModel,
  focusIdx: number,
  action: string | undefined,
  armed: boolean,
): FinalGreeneryPress {
  if (action !== 'primary') {
    return undefined;
  }
  const chosen = vm.actions[focusIdx];
  if (chosen === undefined) {
    return undefined;
  }
  if (!chosen.destructive) {
    return {kind: 'placement', optionIndex: chosen.optionIndex};
  }
  return armed ? {kind: 'finish', optionIndex: chosen.optionIndex} : {kind: 'arm'};
}

/** D-pad movement, wrapping. Moving ALWAYS disarms — an armed destructive
 *  action must never survive the player looking at the other option. */
export function finalGreeneryFocusStep(vm: FinalGreeneryViewModel, focusIdx: number, delta: number): number {
  const n = vm.actions.length;
  return n === 0 ? 0 : (focusIdx + delta + n) % n;
}

/** The pad contract: the confirm verb states which of the two it is. */
export function finalGreeneryCommandKeys(vm: FinalGreeneryViewModel, focusIdx: number, armed: boolean): Array<string> {
  const chosen = vm.actions[focusIdx];
  if (chosen?.destructive === true) {
    return ['Navigate', armed ? STOP_ARMED : STOP_TITLE, 'Minimize'];
  }
  return ['Navigate', PLACE_LEAD, 'Minimize'];
}
