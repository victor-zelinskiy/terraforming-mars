/*
 * THE ONE-PLAY CLASS IN MOTION (TR49) — the two flights of an armed effect, played in the landing scene's SHIPMENT
 * beat (`consolePlayedHero.shipPrice`), while the played card still stands in its composer:
 *   · SPEND — an armed effect this play uses up leaves the dock's «⚡» chip (its standing place) and is drawn into the
 *     card it serves: a requirement modifier into the face's requirement cassette, a discount into the cost badge;
 *     the chip disappears on the DEPARTURE (the law of a spend);
 *   · ARM — a card that arms the next play sends its printed glyph (the waiver's plate, Special Design's plate,
 *     Indentured Workers' −8) out of its face into the dock, and the chip appears on the TOUCHDOWN.
 * Spends go first (the price enters the card), arms after (the card's own effect leaves it).
 *
 * The shipment runs BEFORE the commit (the transport holds the view through the pre-commit half) with the answer
 * already known, so the flights read the DIFF of the two views themselves and present ahead of the view: a spent
 * effect is taken out of the drawn list at its token's launch, an armed one is drawn INVISIBLE (its box is the
 * destination) until its token touches down. The commit's own block lets every hold go (`releaseArmedEffectHolds`
 * from `seedPlayedHeroRewardHold`) — the applied view then draws exactly what the holds drew. A missing end (a glyph
 * the face does not print, a dock not on screen) is no flight: the hold lets go and the trail names why. An abort
 * lets go too (the view was never applied — the chip stands as it stood). Reduced motion flies nothing.
 */
import {nextTick, reactive} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ArmedPlayEffectModel} from '@/common/models/ArmedPlayEffectModel';
import {ArmedEffectView, armedEffectsOf} from '@/client/console/armedEffects';
import {runTransferFlight, killTransferPiece, TransferStagePiece} from '@/client/console/resourceTransfer/resourceTransferDirector';
import {TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';
import {transferEndVerdict} from '@/client/console/resourceTransfer/transferEndVisible';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {motionMs} from '@/client/components/motion/motionTokens';

export type ArmedFlightDirection = 'arm' | 'spend';

export type ArmedFlightToken = {id: number, view: ArmedEffectView, direction: ArmedFlightDirection};

/** A presented armed effect: `held` — drawn but invisible, its arm token still on the way. */
export type PresentedArmedEffect = ArmedEffectView & {held?: boolean};

/**
 * An effect this play arms. Before the commit the view does not have it yet: drawn ahead of the view (invisible until
 * `landed`). From the commit on (`committed`) the view draws it, and the arrival only keeps it invisible until the
 * token touches down — then it is gone.
 */
type Arrival = {view: ArmedEffectView, landed: boolean, committed: boolean};

export const armedFlightState = reactive({
  tokens: [] as Array<ArmedFlightToken>,
  /** Armed by this play, ahead of the view — drawn invisible until the token has landed, then drawn. */
  arriving: [] as Array<Arrival>,
  /** Spent by this play, ahead of the view — no longer drawn from the token's launch. */
  gone: [] as Array<ArmedEffectView>,
  /**
   * Spent by a STAGED play's landing ritual (the answer is not known yet — the server's forecast is): no longer drawn
   * until the staged play is over (`releaseStagedArmedSpends` from `clearStagedPlay`, or the ritual's abort).
   */
  stagedGone: [] as Array<ArmedEffectView>,
  /** What the last flights did, newest last (`arm:landed`, `spend:no-source`, …) — the e2e reads it. */
  trail: [] as Array<string>,
});

let nextId = 1;

type ArmedFlightStage = {piece: (id: number) => TransferStagePiece | undefined};
let stage: ArmedFlightStage | undefined;

export function registerArmedFlightStage(s: ArmedFlightStage): () => void {
  stage = s;
  return () => {
    if (stage === s) {
      stage = undefined;
    }
  };
}

function sameEffect(a: ArmedEffectView, b: ArmedEffectView): boolean {
  return a.source === b.source && a.kind === b.kind;
}

function note(entry: string): void {
  armedFlightState.trail.push(entry);
  if (armedFlightState.trail.length > 12) {
    armedFlightState.trail.splice(0, armedFlightState.trail.length - 12);
  }
}

/**
 * The effects a surface DRAWS: the live ones minus those whose spend token has left, then the ones this play arms
 * ahead of the view (invisible until their token lands).
 */
export function presentedArmedEffects(live: ReadonlyArray<ArmedEffectView>): ReadonlyArray<PresentedArmedEffect> {
  const arriving = armedFlightState.arriving;
  const kept: Array<PresentedArmedEffect> = live
    .filter((l) => !armedFlightState.gone.some((g) => sameEffect(g, l)) && !armedFlightState.stagedGone.some((g) => sameEffect(g, l)))
    .map((l) => arriving.some((a) => !a.landed && sameEffect(a.view, l)) ? {...l, held: true} : l);
  for (const a of arriving) {
    if (!a.committed && !live.some((l) => sameEffect(l, a.view))) {
      kept.push(a.landed ? a.view : {...a.view, held: true});
    }
  }
  return kept;
}

/**
 * THE COMMIT'S BLOCK (and the scene's end): the applied view now draws what the holds drew. The spent effects let go;
 * an armed one whose token is still in the air — it was launched with the card's lift, not ahead of it — stays
 * invisible on the view's own entry until its touchdown, its token untouched.
 */
export function settleArmedEffectHolds(): void {
  armedFlightState.gone.splice(0);
  for (let i = armedFlightState.arriving.length - 1; i >= 0; i--) {
    const a = armedFlightState.arriving[i];
    if (a.landed) {
      armedFlightState.arriving.splice(i, 1);
    } else {
      a.committed = true;
    }
  }
}

/** An ABORT (the view never applied): every hold lets go, every token in the air is taken down. */
export function releaseArmedEffectHolds(): void {
  armedFlightState.arriving.splice(0);
  armedFlightState.gone.splice(0);
  for (const t of armedFlightState.tokens) {
    const piece = stage?.piece(t.id);
    if (piece !== undefined) {
      killTransferPiece(piece);
    }
  }
  armedFlightState.tokens.splice(0);
}

/** A STAGED play's ritual is next: what it will spend (the composer's forecast), consumed by that ritual's shipment. */
let stagedSpends: ReadonlyArray<ArmedEffectView> = [];

export function stageArmedSpends(models: ReadonlyArray<ArmedPlayEffectModel>): void {
  stagedSpends = armedEffectsOf({armedPlayEffects: [...models]});
}

/** The staged play is over (committed / cancelled) or its ritual aborted: the view draws the chip again. */
export function releaseStagedArmedSpends(): void {
  stagedSpends = [];
  armedFlightState.stagedGone.splice(0);
}

function centreOf(el: Element): TransferPoint | undefined {
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2 ? {x: r.left + r.width / 2, y: r.top + r.height / 2} : undefined;
}

/** The effect's standing place — the dock's chip (the hand album's strip when the dock does not draw it). */
function standingChipOf(view: ArmedEffectView): Element | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const source = CSS.escape(view.source);
  for (const variant of ['chip', 'strip']) {
    const el = document.querySelector(`[data-armed-strip][data-armed-variant="${variant}"][data-armed-source="${source}"] [data-armed-kind="${view.kind}"]`);
    if (el !== null) {
      return el;
    }
  }
  return undefined;
}

/** Where a SPEND is absorbed: the card's requirement cassette (a requirement modifier) or its cost badge (a discount). */
function spendAbsorbOf(view: ArmedEffectView, card: HTMLElement): Element {
  const selectors = view.kind === 'discount' ? ['.pcard__cost-badge', '.pcard__cost'] : ['.pcard__reqs', '.pcard__req'];
  for (const s of selectors) {
    const el = card.querySelector(s);
    if (el !== null && centreOf(el) !== undefined) {
      return el;
    }
  }
  return card;
}

/** Where an ARM is born: the card's own PRINTED glyph of the effect — never its body (the law of the real face glyph). */
function armGlyphOf(view: ArmedEffectView, card: HTMLElement): Element | undefined {
  const selectors = view.kind === 'discount' ? ['.pcard-mi--mc'] :
    view.kind === 'requirementWaiver' ? ['.pcard-plate--waived', '.pcard-plate'] : ['.pcard-plate'];
  for (const s of selectors) {
    for (const el of card.querySelectorAll(s)) {
      if (el.closest('.pcard__reqs') === null && centreOf(el) !== undefined) {
        return el;
      }
    }
  }
  return undefined;
}

/** The spend's tempo — a quick draw into the card it serves; its own quick absorb is the shipment's end beat. */
const SPEND_PACE = 0.6;

async function flyToken(view: ArmedEffectView, direction: ArmedFlightDirection, from: TransferPoint, to: TransferPoint, index: number,
  onLaunch: () => void, onTouch: () => void): Promise<boolean> {
  const id = nextId++;
  armedFlightState.tokens.push({id, view, direction});
  await nextTick();
  const piece = stage?.piece(id);
  const drop = () => {
    const at = armedFlightState.tokens.findIndex((t) => t.id === id);
    if (at >= 0) {
      armedFlightState.tokens.splice(at, 1);
    }
  };
  if (piece === undefined) {
    drop();
    return false;
  }
  const handles = runTransferFlight(piece, {
    from, to, index, delayMs: index * motionMs(90), uiScale: conUiScale(), hold: false,
    // A spend leaves its chip sideways and is drawn quickly into the card it serves; an arm is tossed out of the face.
    ...(direction === 'spend' ? {launch: 'side' as const, absorb: 'quick' as const, pace: SPEND_PACE} : {}),
  });
  void handles.launched.then(onLaunch);
  void handles.touched.then(onTouch);
  void handles.finished.then(drop);
  await handles.finished;
  return true;
}

function markLanded(view: ArmedEffectView): void {
  const i = armedFlightState.arriving.findIndex((x) => sameEffect(x.view, view));
  if (i < 0) {
    return;
  }
  if (armedFlightState.arriving[i].committed) {
    armedFlightState.arriving.splice(i, 1); // the view draws it from here
  } else {
    armedFlightState.arriving[i].landed = true;
  }
}

async function flySpend(view: ArmedEffectView, card: HTMLElement, index: number, staged: boolean): Promise<void> {
  const gone = staged ? armedFlightState.stagedGone : armedFlightState.gone;
  const markGone = () => {
    if (!gone.some((g) => sameEffect(g, view))) {
      gone.push(view);
    }
  };
  const chip = standingChipOf(view);
  const from = chip !== undefined && transferEndVerdict(chip).visible ? centreOf(chip) : undefined;
  const to = centreOf(spendAbsorbOf(view, card));
  if (from === undefined || to === undefined) {
    // No visible chip to leave: the effect goes with the commit, as it always did.
    note(`spend:${from === undefined ? 'no-source' : 'no-destination'}`);
    return;
  }
  const flown = await flyToken(view, 'spend', from, to, index, markGone, () => undefined);
  note(flown ? 'spend:landed' : 'spend:no-stage');
  markGone();
}

async function flyArm(view: ArmedEffectView, card: HTMLElement, index: number): Promise<void> {
  armedFlightState.arriving.push({view, landed: false, committed: false});
  await nextTick();
  const glyph = armGlyphOf(view, card);
  const chip = standingChipOf(view);
  // The chip is drawn INVISIBLE (held) — its host must be on screen; the chip itself is measured.
  const host = chip?.closest('[data-armed-strip]')?.parentElement ?? undefined;
  const from = glyph !== undefined ? centreOf(glyph) : undefined;
  const to = chip !== undefined && transferEndVerdict(host).visible ? centreOf(chip) : undefined;
  if (from === undefined || to === undefined) {
    // No honest flight: the chip simply stands (it would at the commit anyway) — never a token out of nothing.
    note(`arm:${from === undefined ? 'no-glyph' : 'no-destination'}`);
    markLanded(view);
    return;
  }
  const flown = await flyToken(view, 'arm', from, to, index, () => undefined, () => markLanded(view));
  note(flown ? 'arm:landed' : 'arm:no-stage');
  markLanded(view);
}

/** Does the answer arm or spend anything (the scene's safety budget makes room for the shipment's flights)? */
export function armedEffectsChange(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): boolean {
  if (before === undefined || after === undefined) {
    return false;
  }
  const was = armedEffectsOf(before.thisPlayer);
  const now = armedEffectsOf(after.thisPlayer);
  return was.length !== now.length || was.some((w) => !now.some((n) => sameEffect(n, w)));
}

/**
 * THE SHIPMENT'S ARMED HALF — `card` is the played card standing in its composer, `before` / `after` the view it
 * replaces and the answer. The SPENDS hold the shipment (their destination is the standing card) and resolve once
 * absorbed (their quick absorb IS the beat — the shipment adds none of its own for them); the ARMS leave the card's printed glyph as it lifts — launched after the spends, never awaited (an arm
 * costs the play nothing: measured A/B, the waiting version added ≈ 1.5 s to TR49's play). Undefined when nothing
 * spends (an arm alone flies beside the lift). Never rejects.
 */
export function shipArmedEffects(card: HTMLElement | undefined, before: PlayerViewModel | undefined, after: PlayerViewModel | undefined,
  mine: () => boolean): Promise<void> | undefined {
  // A STAGED play's ritual runs before any answer: what it spends is the server's forecast (`stageArmedSpends`), and
  // it arms nothing (no arming card places a tile — the arms ride the answer of an ordinary play).
  const staged = before === undefined || after === undefined;
  const was = staged ? [] : armedEffectsOf(before.thisPlayer);
  const now = staged ? [] : armedEffectsOf(after.thisPlayer);
  const spends = staged ? stagedSpends : was.filter((w) => !now.some((n) => sameEffect(n, w)));
  const arms = now.filter((n) => !was.some((w) => sameEffect(n, w)));
  stagedSpends = [];
  if (spends.length === 0 && arms.length === 0) {
    return undefined;
  }
  if (card === undefined || consoleReducedMotionActive()) {
    note(card === undefined ? 'no-card' : 'reduced');
    return undefined;
  }
  const launchArms = () => {
    if (mine() && arms.length > 0) {
      void Promise.all(arms.map((v, i) => flyArm(v, card, i))).catch(() => releaseArmedEffectHolds());
    }
  };
  if (spends.length === 0) {
    launchArms();
    return undefined;
  }
  return Promise.all(spends.map((v, i) => flySpend(v, card, i, staged))).then(launchArms, () => {
    releaseArmedEffectHolds();
  });
}
