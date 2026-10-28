/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «ЧТО СЕЙЧАС ОБСЛУЖИВАЕТ СТАРТ» — the ONE honest answer the game-start workspace gives about itself (the owner's
 * reliability iteration, 2026-10-28: «стартовый розыгрыш — самый забагованный экран; поломанные состояния лечатся
 * только перезаходом»).
 *
 * THE DEFECT CLASS THIS CLOSES. The start scene is a full-bleed surface that stays MOUNTED for the whole opening, and
 * every guard that asks «is the live prompt served?» used to read «`.con-start` is rendered» as YES (the leak
 * detector's `SERVING_SURFACES`). So a scene standing EMPTY over a live question — no queue item, no stage panel, no
 * hosted step, nothing moving — was invisible to every guard, to the stranded self-heal and to every e2e: the field
 * report of 2026-10-28 (Strategic Base Planning → a colony on Triton → the scene stood blank, crumb «КОРПОРАЦИЯ ›
 * ПЕРВОЕ ДЕЙСТВИЕ», while the server waited for the prelude's CITY, held behind an admission block) was exactly that,
 * and the player's only way out was a reload.
 *
 * The scene now states WHAT it serves (`startServesOf`, published as `data-start-serves` on its root and mirrored into
 * `consoleStartState.serves`), the detector counts the scene only when the answer names a surface, and the shell's
 * start watchdog names a scene that serves NOTHING while the server asks (`[start-stranded]`, with the admission block
 * and the scene's own blockers — the line a field export carries) and heals it.
 *
 * Pure: no DOM, no Vue, no timers — spec'd under the server runner (`tests/console/startServing.spec.ts`).
 */
import type {AdmissionBlock} from '@/client/console/consolePromptAdmission';

/**
 * What the scene is serving RIGHT NOW:
 *  - `yielded`  — the shell hides it (a board placement, a scene guest, a park): it serves nothing ITSELF — whoever it
 *                 yielded to must;
 *  - `wizard`   — the setup wizard's panes (picks, the summary) or the wait for the other seats;
 *  - `step`     — a step it HOSTS stands in it (the sponsor's hand, a prelude's colony grid, a Parliament scene step);
 *  - `beat`     — something moves on it: the materialization, a hero landing, a queue arrival, a seat flight, a deal,
 *                 a hand delivery, a stage's own entry / leave — a bounded beat, never a strand by itself;
 *  - `outcome`  — an embedded outcome (a reveal, a deck pick) presents in its zone;
 *  - `stage`    — the first-action / bonus-action panel stands;
 *  - `risk`     — the prelude-risk stage stands;
 *  - `queue`    — the deployment queue offers a press (a card, the payment, the campaign's plates);
 *  - `none`     — NOTHING: no press, no panel, no step, nothing moving. With a live question that is a strand.
 */
export type StartServes = 'yielded' | 'wizard' | 'step' | 'beat' | 'outcome' | 'stage' | 'risk' | 'queue' | 'none';

export type StartServingSignals = {
  mode: 'wizard' | 'ceremony',
  /** The shell's `yielded` prop — the scene does not paint. */
  yielded: boolean,
  /** A frame stands ON the start (a hosted step). */
  nestedStep: boolean,
  /** The ceremony's own flow is in a transition (`materializing` · `completing` · `releasing` · …), not at rest. */
  flowBeat: boolean,
  /** Something moves on the scene (hero · queue arrival · seat flight · deal · delivery · reveal not yet embedded). */
  motion: boolean,
  /** An embedded outcome presents in the start's zone. */
  outcomePresenting: boolean,
  /** The first-action or the bonus-action panel stands. */
  stagePanel: boolean,
  /** A stage is between its beats (`staging` · `performing` · `leaving`) — its own bounded motion. */
  stageTransit: boolean,
  /** The prelude-risk stage stands. */
  risk: boolean,
  /** How many queue items offer a press. */
  focusables: number,
};

/** WHAT THE SCENE SERVES — the first truthful answer, in the order the screen would show it. PURE. */
export function startServesOf(s: StartServingSignals): StartServes {
  if (s.yielded) {
    return 'yielded';
  }
  if (s.mode === 'wizard') {
    return 'wizard';
  }
  if (s.nestedStep) {
    return 'step';
  }
  if (s.outcomePresenting) {
    return 'outcome';
  }
  if (s.stagePanel) {
    return 'stage';
  }
  if (s.risk) {
    return 'risk';
  }
  if (s.flowBeat || s.motion || s.stageTransit) {
    return 'beat';
  }
  return s.focusables > 0 ? 'queue' : 'none';
}

/** Does this answer name a surface the PLAYER can act on / watch (the leak detector's «served»)? */
export function startServesSomething(serves: StartServes | undefined): boolean {
  return serves !== undefined && serves !== 'none' && serves !== 'yielded';
}

/**
 * THE BLOCKS A START MAY NOT PAINT OVER. A server placement is the board's question — the start cannot host it, so its
 * own rising edge (`placementActive`) is what makes the scene step aside. When the placement is ADMITTED late, the
 * scene stood over it for the whole wait, serving nothing: and these blocks belong to the BOARD or to the table, not
 * to anything the start shows — a foreign tile owed to the board (it waits for a board the player can SEE: the start
 * covering it is the deadlock's other half), the board's scale story, the mandatory announcement (its plate stands
 * on the board). For them the start steps aside at once and the grid lights when the block falls. The start's OWN
 * scenes keep it standing — a hero landing on its shelf, a reveal embedded in it, a card arriving in the dock from its
 * rows, a discard, a blocking cinematic (`presentation` counts the start's own blocking holds too) — those blocks are
 * the start's beat; a wait on one of them that outlives its scene is the watchdog's (`startStranded`).
 */
export const START_YIELDS_FOR_PLACEMENT_BLOCKS: ReadonlySet<AdmissionBlock> = new Set<AdmissionBlock>([
  'remote-landing', 'board-story', 'announce-gate',
]);

/**
 * MUST THE START STEP ASIDE FOR A HELD SERVER PLACEMENT? The server asks the viewer a board placement, it is not live
 * yet, the start hosts no step of its own (a placement asked INSIDE a hosted step is that step's), and what holds it is
 * not one of the start's own scenes. PURE.
 */
export function startYieldsForHeldPlacement(s: {
  placementAsked: boolean,
  placementLive: boolean,
  nestedStep: boolean,
  block: AdmissionBlock | undefined,
}): boolean {
  return s.placementAsked && !s.placementLive && !s.nestedStep &&
    s.block !== undefined && START_YIELDS_FOR_PLACEMENT_BLOCKS.has(s.block);
}

/**
 * THE START WATCHDOG'S VERDICT (pure): a live question the start does not serve, while nothing else serves it either.
 * `promptLive` — the server asks the viewer something that is not optional; `servedElsewhere` — a surface other than
 * the start stands for it (the shell's task host, a section, the board's live placement, a hand pick, a park).
 */
export function startStranded(s: {serves: StartServes | undefined, promptLive: boolean, servedElsewhere: boolean}): boolean {
  return s.promptLive && !s.servedElsewhere && s.serves === 'none';
}

/** How long a strand must STAND before the watchdog names and heals it (a hand-off frame is never one). */
export const START_STRAND_CONFIRM_MS = 2500;
/** …and how long a heal gets before the watchdog hands the question to the shell's own surfaces (the yield). */
export const START_STRAND_YIELD_MS = 2500;
