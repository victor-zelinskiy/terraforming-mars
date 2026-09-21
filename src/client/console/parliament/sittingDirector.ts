/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SITTING DIRECTOR (Turmoil Redux — docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md
 * §6; docs/TURMOIL_REDUX_PARLIAMENT_SITTING_V2.md) — the ONE owner of the
 * sitting's timelines. A page's beats (`sittingBeats.ts`) become GSAP master
 * timelines under NAMED animation holds (`parliament-sitting:<stage>[/<beat>]`),
 * and every object on them MOVES from a real, measured place to a real,
 * measured place — from the state the DISPLAY HOLDS still show
 * (`parliamentDisplayHolds.ts`, seeded with the response) to the state the
 * model already carries:
 *
 *   ВЕРДИКТ   — the winning card lights IN ITS SLOT (the table is exactly as
 *               voted — nothing is parked, nothing has moved), the delegate
 *               number pulses, the winner row reveals.
 *   ПРИНЯТИЕ  — three beats IN TURN, each under its own hold, the next one
 *               starting only once the previous has landed (≥ 250 ms apart):
 *               ПОВЕСТКА — the reached segment of the track lights, the
 *               marker GLIDES from its old step (where the hold keeps it) to
 *               the new one, the step pulses, the influence ticks, the
 *               step's TR bonus leaves the step for the rail;
 *               ПОДДЕРЖКА — party by party in the summary's order, the
 *               plaque lighting as it accepts, the neutral cubes leaving the
 *               supply ≥ 90 ms apart, the parties ≥ 180 ms apart, the whole
 *               opposition tier in view for it (the stage steps out of the
 *               way — never a peek at 8 %);
 *               ПРИНЯТИЕ — one phrase: the old law leaves the government for
 *               the discard, the winner FLIPs out of its slot into the
 *               government (its slot stays as an empty outline in its own
 *               place), its delegates go home by owner, the ruling party's
 *               plaque rises from the opposition row into the government
 *               while the old ruler's descends (one DOM instance per party —
 *               a FLIP, the row re-laid out after the landing), and the
 *               chairman quest RELEASES (closed, with its outcome) → the new
 *               one REVEALS.
 *   НАГРАДА   — the wave of what the law paid this seat (`beatReward`), from
 *               the carrier card's printed graphic to the rail.
 *   ИТОГИ     — the losers leave their homes for the discard, the fresh
 *               resolutions are DEALT with a real 3D turn, the support votes
 *               seat on them, every free delegate returns to the lobby, and
 *               the results card REVEALS in the same panel.
 *
 * A DURING A BEAT = «дожать»: the current run and every flight of the stage
 * are driven to their resting pose (`progress(1)`), and every beat still to
 * come plays instantly — never a skipped stage, never a proxy left in the
 * air. Reduced motion = the resting poses at once, the same stages, the same
 * A presses. Perf-lite plays the same timelines: transform / opacity only.
 *
 * Every beat is BOUNDED and NAMED: the hold's ceiling calls `expire`, which
 * ends the wedge (kills the flights, releases the display holds of THAT
 * stage, releases the peek) rather than merely masking it; `diagnose` names
 * what was still in the air. Durations go through the motion scale; no
 * wall-clock timer anywhere (`parliamentNoTimers.spec.ts`).
 */
import {gsap} from 'gsap';
import {nextTick, reactive} from 'vue';
import {Color} from '@/common/Color';
import {ParliamentModel, ParliamentPhaseSummaryModel} from '@/common/models/ParliamentModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {AnimationHold, beginAnimationHold} from '@/client/components/presentation/animationHold';
import {motionMs} from '@/client/components/motion/motionTokens';
import {resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import {consoleMotionMs, consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {probeTick} from '@/client/console/probeTick';
import {descendCascade, descendFlipFrom} from '@/client/console/surfaceMotion/workspaceDescend';
import {resolveActionCommitAnchors, resolveGainIconOrigins, runActionCommitMotion} from '@/client/console/consoleActionCommitMotion';
import {runResourceTransfers} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {ResourceTransferSpec, TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';
import {AgendaMove, ParliamentViewVm} from './consoleParliamentModel';
import {SittingStage} from './consoleSittingFlow';
import {BODY_SWAP_MS} from './consoleParliamentFlow';
import {enactedCardEl} from './consoleResolutionPayout';
import {SupportMark, SupportSource, supportSceneOf, SupportWaveEntry} from './supportScene';
import {parliamentHolds, releaseEnactmentHolds, releaseRenewalHolds} from './parliamentDisplayHolds';
import {
  flushAgendaBonus, flushParliamentRewards, markAgendaBonusLanded, markRewardLanded, OwedReward, parliamentRewardState, takeAgendaBonus,
  takeOwedRewards,
} from './parliamentRewardBeat';
import {
  DEAL_FLIGHT_MS, DEAL_STAGGER_MS, dealResolutionCard, dropFlight, ENACT_MOVE_MS, finishParliamentFlights, flightEl, flightRegistered, flyCube,
  killParliamentFlights, nextFlightId, placeCubeRect, pushCardFlight, rectOf, registerFlightHandle,
} from './parliamentFlights';
import {scheduleParliamentBeat} from './parliamentBeat';
import {Rect, runCardDealFlight} from './consoleParliamentVoteMotion';
import {SittingBeat, returningInstances} from './sittingBeats';

// ── the storyboard's budget (base ms; §6, v2) ───────────────────────────────
const VERDICT_LIGHT_MS = 220;
const VERDICT_PULSE_MS = 180;
const VERDICT_BADGE_MS = 260;
/** The pause between the enactment's beats — the next starts only once the previous has LANDED. */
const BEAT_GAP_MS = 250;
/**
   * ПОВЕСТКА: the reached segment lights before the marker leaves; the glide's own length is the SHARED marker
   * director's (charge → lift → glide → lock → pulse ≈ 1.07 s — the same phrase the hydro track's marker
   * speaks, and a console-wide object language is not worth trimming for one beat's budget). So this lead is
   * the only part of the beat that is ours: v4 cut it from 240 ms, which is what kept the beat near 1.2 s.
   */
const AGENDA_SEGMENT_MS = 150;
const AGENDA_GLIDE_BUDGET_MS = 900;
/** ПОДДЕРЖКА: cube by cube, party by party. The row is already standing (v4 — there is no tier to bring in). */
const SUPPORT_CUBE_STAGGER_MS = 90;
const SUPPORT_PARTY_GAP_MS = 150;
/** ПРИНЯТИЕ. */
const DISCARD_MS = 320;
const RETURN_STAGGER_MS = 70;
const PLAQUE_FLIP_MS = 420;
const QUEST_RELEASE_MS = 180;
const QUEST_REVEAL_MS = 260;
/** ИТОГИ. */
const LOSER_STAGGER_MS = 90;
const SEAT_STAGGER_MS = 80;
const LOBBY_STAGGER_MS = 90;
const CLOSING_MS = 300;
/** The reward page's own reveal (the reading rows cascade — RELEASE → UNFOLD → REVEAL). */
const REWARD_REVEAL_MS = 260;
/** The carrier card's ACTION COMMIT impulse hands the wave off at `COMMIT_HANDOFF_AT_MS` (≈460); the wave itself ≈ pop + arc + settle. */
const REWARD_IMPULSE_MS = 460;
const REWARD_WAVE_MS = 900;
/** The ruling party's answer leaves its plaque once the resolution's own chips have landed — surfaces in turn. */
const REACTION_GAP_MS = 120;
/** The winner's tile RECEIPT (the frame back from the board): the «received» pose is READ before the next step takes the page. */
const RECEIPT_DWELL_MS = 1500;
/** A reward page that only READS (a resolution with no payout): long enough for the sentence to be read. */
const QUIET_REWARD_DWELL_MS = 900;
/** A compact beat (resume / review) runs at half length, no dwell. */
const COMPACT = 0.5;
/** A beat's hold ceiling — above the longest beat (the renewal ≈ 2.4 s, the enactment's phrase ≈ 2.4 s) by a wide margin. */
const STAGE_HOLD_CEILING_MS = 12_000;

/** What the director is doing — read by the tiers (the poses) and the specs. */
export const sittingMotion = reactive({
  /** The stage whose beats are playing ('' at rest). */
  stage: '' as SittingStage | '',
  /** The beat of the stage that is playing ('' at rest / a one-beat stage). */
  beat: '' as '' | 'agenda' | 'support' | 'enact',
  /**
   * …and WHICH WAVE of the support beat is in the air ('' between waves). The two waves obey two different
   * rules — the parties nobody spoke for take from the supply, the unenacted resolutions send their own —
   * and the reading band names the rule of the wave the player is watching, never both at once.
   */
  supportWave: '' as '' | 'absent' | 'lost',
  /** The stage steps out of the way: the opposition tier is in full view (the support beat lands on its places). */
  /** The winning card's slot, lit for the verdict (its instance; '' = none). */
  litSlot: '' as string,
  /** The party whose plaque is ACCEPTING support right now ('' = none). */
  /** The Agenda segment the marker is crossing (its steps light). */
  agendaSegment: undefined as AgendaMove | undefined,
  /** The results card has been REVEALED (the renewal's beats are over) — hidden until then while the stage plays. */
  resultsRevealed: false,
  /**
   * THE GOVERNMENT IS CHANGING HANDS RIGHT NOW (v4 §2.2). The two plaques travel between the government's
   * slot and the opposition row, which are two TIERS: their path crosses the other tier's own objects, and
   * the ruler block, the ruling row and the government plate all CLIP their content by design. So for the
   * length of the swap the travelling tiles are the top-most things on the screen and nothing clips them
   * (`.con-parl--swapping`) — without it the rising tile was cut to the slot it was flying INTO and the
   * move read as the substitution the whole rework exists to remove.
   */
  swapping: false,
});

export type SittingDirectorContext = {
  /** The section's root — every measurement is scoped to it. */
  root: HTMLElement;
  view: ParliamentViewVm;
  model: ParliamentModel | undefined;
  summary: ParliamentPhaseSummaryModel;
  viewer: Color | undefined;
  /** The Agenda tier's own glide (it registers its own hold); `onLanded` fires when the marker has settled on its step. */
  playAgendaGlide?: (move: AgendaMove, onLanded?: () => void) => void;
};

type StageRun = {
  stage: SittingStage;
  master: gsap.core.Timeline;
  hold: AnimationHold;
  /** Flights launched by this run (their ids) — «дожать» drives them to rest. */
  flights: Set<string>;
  /** Waves / glides in the air the run launched — the run rests once they have touched down. */
  pending: number;
  /** What an abort must tear down beside the flights (the carrier card's commit impulse, a plaque FLIP). */
  kills: Array<() => void>;
  /** The Agenda CARD bonus taken by this run's glide — its parked reveal is released when the run is at rest. */
  releaseAgendaCard?: boolean;
  finished: boolean;
};

let run: StageRun | undefined;
/** The STAGE whose beats are playing (a multi-beat stage spans several runs) and whether A asked to hurry it. */
let stagePlaying: SittingStage | '' = '';
let hurry = false;

const s = (baseMs: number): number => motionMs(baseMs) / 1000;

export function sittingMotionActive(): boolean {
  return stagePlaying !== '' || (run !== undefined && !run.finished);
}

/** The label the hold carries — the e2e reads the registry by it. */
export function sittingHoldLabel(stage: SittingStage, beat = ''): string {
  return beat === '' ? `parliament-sitting:${stage}` : `parliament-sitting:${stage}/${beat}`;
}

// ── measured places ────────────────────────────────────────────────────────

function governmentCardRect(root: HTMLElement): Rect | undefined {
  return rectOf(root.querySelector('[data-parl-gov] .con-parl__gov-card .pcard') ?? root.querySelector('[data-parl-gov] .con-parl__gov-card'));
}

function deckRect(root: HTMLElement): Rect | undefined {
  return rectOf(root.querySelector('[data-parl-deck-top]')) ?? rectOf(root.querySelector('[data-parl-deck]'));
}

function slotFaceRect(root: HTMLElement, instance: string): Rect | undefined {
  return rectOf(root.querySelector(`.con-parl__slot[data-instance="${instance}"] .con-parl__card .pcard`) ??
    root.querySelector(`.con-parl__slot[data-instance="${instance}"] .con-parl__card`));
}

function itemsOf(root: HTMLElement, selector: string): Array<HTMLElement> {
  return Array.from(root.querySelectorAll<HTMLElement>(selector));
}

/** A face-up proxy standing still over `at`. Returns its id, or undefined when nothing is measurable. */
async function parkFace(resolutionId: string, at: Rect | undefined): Promise<string | undefined> {
  const face = resolutionPremiumVmById(resolutionId);
  if (at === undefined || face === undefined || at.width < 4) {
    return undefined;
  }
  const id = nextFlightId('sit-park');
  pushCardFlight({id, width: Math.round(at.width), height: Math.round(at.height), face, faceUp: true});
  await nextTick();
  const proxy = flightEl(id);
  if (proxy === null || proxy === undefined) {
    dropFlight(id);
    return undefined;
  }
  gsap.set(proxy, {x: at.left, y: at.top, scale: 1, transformOrigin: '50% 50%', autoAlpha: 1});
  return id;
}

/** A parked proxy flies to the deck zone and dissolves (the old law, a loser). */
function flyToDeck(runState: StageRun, ctx: SittingDirectorContext, id: string, delayMs: number, onGone?: () => void): void {
  const proxy = flightEl(id);
  const to = deckRect(ctx.root);
  if (proxy === null || proxy === undefined || to === undefined) {
    dropFlight(id);
    onGone?.();
    return;
  }
  const r = proxy.getBoundingClientRect();
  const from: Rect = {left: r.left, top: r.top, width: r.width, height: r.height};
  const tw = gsap.timeline({delay: s(delayMs)});
  tw.to(proxy, {
    x: to.left + to.width / 2 - from.width / 2, y: to.top + to.height / 2 - from.height / 2,
    scale: Math.max(0.12, to.width / from.width), autoAlpha: 0, duration: s(DISCARD_MS), ease: 'power2.in',
    onComplete: () => {
      runState.flights.delete(id);
      dropFlight(id);
      onGone?.();
    },
  });
  registerFlightHandle(id, {tween: tw, kill: () => tw.kill()});
  runState.flights.add(id);
}

// ── ВЕРДИКТ ────────────────────────────────────────────────────────────────

/** The winning card lights IN ITS SLOT, the delegate number pulses, the winner row reveals; a tie's phrase last. */
function beatVerdict(tl: gsap.core.Timeline, ctx: SittingDirectorContext, k: number): number {
  const root = ctx.root;
  let at = 0;
  tl.call(() => {
    sittingMotion.litSlot = ctx.summary.winner.instance;
  }, undefined, at);
  at += s(VERDICT_LIGHT_MS) * k;
  // v4 §2.1: the verdict reads ON THE TABLE — the winning card's own delegate count, its badge and the
  // winner's chip beside it. There is no panel over the row to pulse.
  const winnerSlot = '.con-parl__slot[data-instance="' + ctx.summary.winner.instance + '"]';
  const number = root.querySelector<HTMLElement>(winnerSlot + ' .con-parl__tally-num');
  if (number !== null) {
    tl.fromTo(number, {scale: 1}, {scale: 1.22, duration: s(VERDICT_PULSE_MS) * k * 0.5, ease: 'power2.out', transformOrigin: '50% 50%'}, at);
    tl.to(number, {scale: 1, duration: s(VERDICT_PULSE_MS) * k * 0.5, ease: 'power2.in', clearProps: 'transform,transformOrigin'}, at + s(VERDICT_PULSE_MS) * k * 0.5);
  }
  at += s(VERDICT_PULSE_MS) * k;
  const rows = itemsOf(root, winnerSlot + ' .con-parl__slot-win, ' + winnerSlot + ' [data-parl-leader]');
  if (rows.length > 0) {
    descendCascade(tl, rows, s(VERDICT_BADGE_MS) * k, s(120) * k, at);
  }
  return at + s(VERDICT_BADGE_MS) * k + (rows.length > 1 ? s(120) * k : 0);
}

// ── ПРИНЯТИЕ · ПОВЕСТКА ────────────────────────────────────────────────────

/**
 * THE AGENDA STEP'S TR BONUS — the marker has settled on its step: the +1 TR
 * the server paid leaves that very step (its printed rating glyph) for the
 * rail's score cell, which has held the old rating until this touchdown.
 * Nothing owed → nothing flies; an unmeasurable step releases the hold at
 * once (honestly late, never lost).
 */
function launchAgendaBonus(runState: StageRun, ctx: SittingDirectorContext): void {
  const bonus = takeAgendaBonus(ctx.summary.generation);
  if (bonus === undefined) {
    return;
  }
  const spec = bonus.spec;
  if (bonus.kind === 'card' || spec === undefined) {
    // A CARD step: the reward is the reveal batch PARKED since the response arrived — released once this
    // run is at REST (the marker settled), which lets the card-bonus scene lift the cover off this very step.
    if (runState.finished) {
      markAgendaBonusLanded();
    } else {
      runState.releaseAgendaCard = true;
    }
    return;
  }
  const step = ctx.root.querySelector<HTMLElement>(`.con-parl__step[data-step="${bonus.step}"]`);
  const node = step?.querySelector<HTMLElement>('.con-parl__step-res') ?? step?.querySelector<HTMLElement>('.con-parl__step-node') ?? step;
  const r = node?.getBoundingClientRect();
  if (node === null || node === undefined || r === undefined || r.width < 2) {
    flushAgendaBonus('unmeasurable-step');
    return;
  }
  if (runState.finished) {
    flushAgendaBonus('stage-finished');
    return;
  }
  trackWave(runState, runResourceTransfers({
    specs: [spec],
    source: {point: {x: r.left + r.width / 2, y: r.top + r.height / 2}},
    arrival: 'auto',
    onArrive: () => markAgendaBonusLanded(),
  }));
}

/** ПОВЕСТКА: the reached segment lights, the marker glides from its old step to the new one, the step's bonus follows the arrival. */
function beatAgenda(tl: gsap.core.Timeline, ctx: SittingDirectorContext, k: number, runState: StageRun): number {
  const agenda = ctx.summary.agenda;
  const move: AgendaMove | undefined = parliamentHolds.agendaAwaits ??
    (agenda !== undefined && agenda.to !== agenda.from ? {player: agenda.player, from: agenda.from, to: agenda.to} : undefined);
  if (move === undefined || ctx.playAgendaGlide === undefined) {
    tl.call(() => {
      parliamentHolds.agendaAwaits = undefined;
      flushAgendaBonus('no-glide');
    }, undefined, 0.01);
    return 0;
  }
  const glide = ctx.playAgendaGlide;
  let at = 0;
  tl.call(() => {
    sittingMotion.agendaSegment = move;
  }, undefined, at);
  at += s(AGENDA_SEGMENT_MS) * k;
  // The glide is the beat's OWN work: the master's arithmetic ends before the marker settles, so the run counts
  // the glide as airborne until its landing — the bonus then leaves the reached step.
  runState.pending++;
  tl.call(() => glide(move, () => {
    sittingMotion.agendaSegment = undefined;
    parliamentHolds.agendaAwaits = undefined;
    launchAgendaBonus(runState, ctx);
    runState.pending = Math.max(0, runState.pending - 1);
  }), undefined, at);
  at += s(AGENDA_GLIDE_BUDGET_MS) * k;
  return at;
}

// ── ПРИНЯТИЕ · ПОДДЕРЖКА ───────────────────────────────────────────────────

/** The support cubes of ONE party leave the neutral supply for the party's next free places, cube by cube. */
/** The roll call's pace: one party named every step — a reading rhythm, left to right, no returns. */
const ROLL_STEP_MS = 70;
const ROLL_TAIL_MS = 100;
const SUPPORT_SETTLE_MS = 170;

/** Where a support cube comes FROM, as a place on screen (v3 В3) — never the centre of the screen. */
function supportSourceRect(root: HTMLElement, source: SupportSource, to: Rect | undefined): Rect | undefined {
  if (source.from === 'supply') {
    return placeCubeRect(root, '[data-parl-neutral-cube]');
  }
  const selector = source.from === 'ribbon' ?
    `.con-parl__slot[data-instance="${source.instance}"] .con-parl__ribbon` :
    `.con-parl__slot[data-instance="${source.instance}"] .con-parl__card`;
  const host = rectOf(root.querySelector(selector));
  if (host === undefined || to === undefined) {
    return host;
  }
  // A cube leaves the card (or its ribbon) at the CUBE's own size, from the middle of that object.
  return {left: host.left + host.width / 2 - to.width / 2, top: host.top + host.height / 2 - to.height / 2, width: to.width, height: to.height};
}

/**
 * THE ROLL CALL's mark: the object that speaks for a party answers ONCE, on its own — a short mechanical
 * press of the card, nothing else on screen moves (v3, law 1). The party's tile gains its WORD in the same
 * call; the word is written into the reserved row, never flashed.
 */
function markRollSource(root: HTMLElement, mark: SupportMark, runState: StageRun, k: number): void {
  const el = mark.kind === 'slot' ?
    root.querySelector<HTMLElement>(`.con-parl__slot[data-instance="${mark.instance}"] .con-parl__card`) :
    mark.kind === 'government' ? root.querySelector<HTMLElement>('.con-parl__gov-card') : null;
  if (el === null || runState.finished) {
    return;
  }
  const tw = gsap.fromTo(el, {scale: 1}, {
    scale: 1.014, duration: s(ROLL_STEP_MS) * k, ease: 'sine.inOut', yoyo: true, repeat: 1,
    transformOrigin: '50% 50%', clearProps: 'transform,transformOrigin',
    onInterrupt: () => gsap.set(el, {clearProps: 'transform,transformOrigin'}),
  });
  runState.kills.push(() => {
    tw.kill();
    gsap.set(el, {clearProps: 'transform,transformOrigin'});
  });
}

/**
 * THE TOUCHDOWN ANSWER (v3, law 1): the ONE socket that received the cube grows denser for a moment —
 * a one-shot CSS animation that ends on its own. No tile changes colour, no neighbour lights, nothing
 * repeats; the counter under it ticks in the same frame because the hold is consumed here.
 */
function answerSupportPlace(root: HTMLElement, party: ReduxParty, index: number): void {
  const el = root.querySelector<HTMLElement>(`[data-parl-support="${party}"] [data-support-place="${index + 1}"]`);
  if (el === null) {
    return;
  }
  el.classList.remove('con-pseal__support-place--landed');
  void el.offsetWidth;
  el.classList.add('con-pseal__support-place--landed');
  el.addEventListener('animationend', () => el.classList.remove('con-pseal__support-place--landed'), {once: true});
}

/** ONE wave: this party's cubes, each from its own place, one every `SUPPORT_CUBE_STAGGER_MS`. */
function launchSupportWave(runState: StageRun, ctx: SittingDirectorContext, wave: SupportWaveEntry, k: number): void {
  const root = ctx.root;
  const holds = parliamentHolds;
  const places = itemsOf(root, `[data-parl-support="${wave.party}"] .con-pseal__support-place`);
  const total = ctx.view.parties.find((p) => p.party === wave.party)?.support ?? 0;
  const incoming = holds.supportIncoming.get(wave.party) ?? wave.cubes.length;
  // The places these cubes take: the ones after the cubes the plaque already shows (live − incoming).
  const base = Math.max(0, Math.min(places.length, total) - incoming);
  let launched = 0;
  wave.cubes.forEach((cube, n) => {
    const index = wave.overflow === true ? places.length - 1 : Math.min(places.length - 1, base + n);
    const to = rectOf(places[index]);
    const from = supportSourceRect(root, cube, to);
    const landed = (): void => {
      if (wave.overflow === true) {
        return;
      }
      answerSupportPlace(root, wave.party, index);
      const left = (holds.supportIncoming.get(wave.party) ?? 0) - 1;
      if (left <= 0) {
        holds.supportIncoming.delete(wave.party);
      } else {
        holds.supportIncoming.set(wave.party, left);
      }
    };
    const id = flyCube('neutral', from, to, n * SUPPORT_CUBE_STAGGER_MS * k, () => {
      landed();
      if (wave.overflow === true && from !== undefined && to !== undefined) {
        // FULL: the places answer as full and the cube goes home — the discard is shown, never merely logged.
        answerSupportPlace(root, wave.party, index);
        const back = flyCube('neutral', to, from, 0, () => undefined);
        if (back !== undefined) {
          runState.flights.add(back);
        }
      }
    });
    if (id !== undefined) {
      runState.flights.add(id);
      launched++;
    }
  });
  if (launched === 0) {
    holds.supportIncoming.delete(wave.party);
  }
}

/**
 * ПОДДЕРЖКА — ONE scene in three beats (v3 В3), all of it in the row, the voting area and the neutral
 * supply: ① the ROLL CALL — each card of the table and then the government mark their party, and the
 * party's tile gains the word that says why it stands where it stands; ② the two parties nobody spoke
 * for take a cube from the SUPPLY; ③ every unenacted card sends its own cube to its party, plus a second
 * one off its delegate ribbon when a player voted there. The enacted card gives nothing and shows it.
 */
function beatSupport(tl: gsap.core.Timeline, ctx: SittingDirectorContext, k: number, runState: StageRun): number {
  const holds = parliamentHolds;
  const root = ctx.root;
  const slots = (holds.heldSlots ?? ctx.view.slots).map((slot) => ({instance: slot.instance, party: slot.party}));
  const scene = supportSceneOf(ctx.summary, slots, holds.rulerBefore ?? ctx.view.rulingParty);
  const waves = scene.waves.filter((wave) => wave.overflow === true || (holds.supportIncoming.get(wave.party) ?? 0) > 0);
  if (waves.length === 0) {
    tl.call(() => holds.supportIncoming.clear(), undefined, 0.01);
    return 0;
  }
  // …and it opens AT ONCE: v3 waited for the stage panel to step out of the way; in v4 the table never left.
  let at = 0;
  for (const entry of scene.roll) {
    tl.call(() => {
      holds.rollStatus.set(entry.party, entry.status);
      markRollSource(root, entry.mark, runState, k);
    }, undefined, at);
    at += s(ROLL_STEP_MS) * k;
  }
  at += s(ROLL_TAIL_MS) * k;
  for (const wave of waves) {
    tl.call(() => {
      sittingMotion.supportWave = wave.status;
      launchSupportWave(runState, ctx, wave, k);
    }, undefined, at);
    at += s((wave.cubes.length - 1) * SUPPORT_CUBE_STAGGER_MS + SUPPORT_PARTY_GAP_MS) * k;
  }
  at += s(SUPPORT_SETTLE_MS) * k;
  // The roll call's words are the SCENE's, not the tiles' own state: they leave with it.
  tl.call(() => {
    holds.rollStatus.clear();
    holds.supportIncoming.clear();
    sittingMotion.supportWave = '';
  }, undefined, at);
  return at;
}

// ── ПРИНЯТИЕ · ПРИНЯТИЕ ────────────────────────────────────────────────────

/** Every party tile's rect right now, by party (the plaques' FLIP measures them before the government changes). */
function partyRects(root: HTMLElement): Map<string, Rect> {
  const out = new Map<string, Rect>();
  for (const el of itemsOf(root, '.con-parl__party[data-party]')) {
    const r = rectOf(el);
    if (r !== undefined) {
      out.set(el.getAttribute('data-party') ?? '', r);
    }
  }
  return out;
}

/** The government CHANGES: the new ruler's tile rises into the government, the old one descends into the row, the row re-lays out — one FLIP each. */
function flipPlaques(runState: StageRun, root: HTMLElement, before: Map<string, Rect>, k: number): void {
  const tl = gsap.timeline();
  // THE POSE FIRST, the measurements after: it lifts the clips the two objects are about to cross.
  sittingMotion.swapping = true;
  const settlePose = () => {
    sittingMotion.swapping = false;
  };
  for (const el of itemsOf(root, '.con-parl__party[data-party]')) {
    const from = before.get(el.getAttribute('data-party') ?? '');
    if (from === undefined) {
      continue;
    }
    const delta = descendFlipFrom(el, from);
    if (delta === undefined || (Math.abs(delta.x) < 0.5 && Math.abs(delta.y) < 0.5 && Math.abs(delta.scale - 1) < 0.002)) {
      continue;
    }
    gsap.set(el, {x: delta.x, y: delta.y, scale: delta.scale, transformOrigin: 'top left'});
    tl.to(el, {x: 0, y: 0, scale: 1, duration: s(PLAQUE_FLIP_MS) * k, ease: 'power3.inOut', clearProps: 'transform,transformOrigin', overwrite: 'auto'}, 0);
  }
  runState.kills.push(() => {
    tl.kill();
    gsap.set(itemsOf(root, '.con-parl__party[data-party]'), {clearProps: 'transform,transformOrigin'});
    settlePose();
  });
  runState.pending++;
  tl.eventCallback('onComplete', () => {
    runState.pending = Math.max(0, runState.pending - 1);
    settlePose();
  });
}

/** ПРИНЯТИЕ: the old law leaves, the winner FLIPs into the government, the delegates go home, the plaques change places, the quest turns over. */
function beatEnactMove(tl: gsap.core.Timeline, ctx: SittingDirectorContext, k: number, runState: StageRun): number {
  const root = ctx.root;
  const holds = parliamentHolds;
  const summary = ctx.summary;
  let at = 0;
  // (1) The old law leaves the government for the deck zone — the government then shows the NEW card, its face waiting.
  const old = holds.govBefore?.enacted;
  if (old !== undefined) {
    tl.call(() => {
      const rect = governmentCardRect(root);
      void parkFace(old.resolutionId, rect).then((id) => {
        holds.govBefore = undefined;
        if (id === undefined || runState.finished) {
          if (id !== undefined) {
            dropFlight(id);
          }
          return;
        }
        flyToDeck(runState, ctx, id, 0);
      });
    }, undefined, at);
    at += s(DISCARD_MS * 0.55) * k;
  } else {
    tl.call(() => {
      holds.govBefore = undefined;
    }, undefined, at);
  }
  // (2) The winner moves from its slot into the government — one visible card (the slot's face waits under the proxy).
  const winner = summary.winner.instance;
  const moveMs = ENACT_MOVE_MS * k;
  tl.call(() => {
    const from = slotFaceRect(root, winner);
    const settle = () => {
      holds.govAwaits = undefined;
      holds.liftedFaces.delete(winner);
      if (holds.heldSlots !== undefined && holds.heldSlots.some((slot) => slot.instance === winner)) {
        holds.vacated.add(winner);
      }
      sittingMotion.litSlot = '';
    };
    void nextTick().then(async () => {
      const to = governmentCardRect(root);
      if (from === undefined || to === undefined || runState.finished) {
        settle();
        return;
      }
      const id = await parkFace(summary.winner.resolution, from);
      const proxy = id === undefined ? undefined : flightEl(id);
      if (id === undefined || proxy === null || proxy === undefined || runState.finished) {
        if (id !== undefined) {
          dropFlight(id);
        }
        settle();
        return;
      }
      holds.liftedFaces.add(winner);
      sittingMotion.litSlot = '';
      proxy.classList.add('con-parl__flight--lit');
      const handle = runCardDealFlight({proxy, from, to, durationMs: moveMs, onLanded: () => {
        settle();
        runState.flights.delete(id);
        probeTick(() => dropFlight(id));
      }});
      registerFlightHandle(id, handle);
      runState.flights.add(id);
    });
  }, undefined, at);
  at += s(moveMs + 40) * k;
  // (3) The delegates go home by OWNER — from the card's centre in the government, each at its reserve's own size.
  tl.call(() => {
    const card = governmentCardRect(root);
    let i = 0;
    for (const [owner, count] of Array.from(holds.returns.entries())) {
      const to = placeCubeRect(root, owner === 'neutral' ? '[data-parl-neutral-cube]' : `[data-parl-seat-reserve="${owner}"]`);
      const from = card === undefined || to === undefined ? undefined :
        {left: card.left + card.width / 2 - to.width / 2, top: card.top + card.height / 2 - to.height / 2, width: to.width, height: to.height};
      for (let n = 0; n < count; n++) {
        const delay = i * RETURN_STAGGER_MS * k;
        i++;
        const id = flyCube(owner, from, to, delay, () => {
          const left = (holds.returns.get(owner) ?? 0) - 1;
          if (left <= 0) {
            holds.returns.delete(owner);
          } else {
            holds.returns.set(owner, left);
          }
        });
        if (id !== undefined) {
          runState.flights.add(id);
        }
      }
    }
    if (i === 0) {
      holds.returns.clear();
    }
  }, undefined, at);
  const returnCount = Array.from(holds.returns.values()).reduce((a, b) => a + b, 0);
  at += returnCount > 0 ? s(480 + (returnCount - 1) * RETURN_STAGGER_MS) * k : 0;
  // (4) The government CHANGES: the plaques change places (one DOM instance per party, a FLIP each).
  const rulerChanges = holds.rulerBefore !== undefined && holds.rulerBefore !== ctx.view.rulingParty;
  tl.call(() => {
    if (!rulerChanges || runState.finished) {
      holds.rulerBefore = undefined;
      return;
    }
    const before = partyRects(root);
    holds.rulerBefore = undefined;
    void nextTick().then(() => {
      if (runState.finished) {
        return;
      }
      flipPlaques(runState, root, before, k);
    });
  }, undefined, at);
  if (rulerChanges) {
    at += s(PLAQUE_FLIP_MS + 60) * k;
  }
  // (5) The chairman quest: the old block RELEASES (closed, with its outcome) → the new one UNFOLDS and REVEALS.
  tl.call(() => {
    const quest = root.querySelector<HTMLElement>('[data-parl-quest]');
    const swap = () => {
      holds.questBefore = undefined;
      void nextTick().then(() => {
        const fresh = root.querySelector<HTMLElement>('[data-parl-quest]');
        if (fresh === null || runState.finished) {
          if (fresh !== null) {
            gsap.set(fresh, {clearProps: 'transform,transformOrigin,opacity,visibility'});
          }
          return;
        }
        // IT COMES FROM THE CARD (v3 В2): the quest is printed on the resolution that just landed above it,
        // so the new block UNFOLDS downward out of that edge — never a panel fading in beside it.
        const tw = gsap.fromTo(fresh, {autoAlpha: 0, scaleY: 0.82, y: -4, transformOrigin: '50% 0%'},
          {autoAlpha: 1, scaleY: 1, y: 0, duration: s(QUEST_REVEAL_MS) * k, ease: 'expo.out', clearProps: 'transform,transformOrigin,opacity,visibility'});
        runState.kills.push(() => {
          tw.kill();
          gsap.set(fresh, {clearProps: 'transform,transformOrigin,opacity,visibility'});
        });
      });
    };
    if (quest === null || runState.finished) {
      swap();
      return;
    }
    // …and the old one FOLDS INTO that same edge before it: one object leaves where the next arrives.
    const out = gsap.to(quest, {autoAlpha: 0, scaleY: 0.86, y: -2, transformOrigin: '50% 0%', duration: s(QUEST_RELEASE_MS) * k, ease: 'power2.in', onComplete: swap});
    runState.kills.push(() => {
      out.kill();
      gsap.set(quest, {clearProps: 'transform,transformOrigin,opacity,visibility'});
    });
  }, undefined, at);
  at += s(QUEST_RELEASE_MS + QUEST_REVEAL_MS) * k;
  return at;
}

// ── НАГРАДА ────────────────────────────────────────────────────────────────

/** A wave the run launched — the run rests only once it has touched down. */
function trackWave(runState: StageRun, wave: Promise<void>): void {
  runState.pending++;
  void wave.finally(() => {
    runState.pending = Math.max(0, runState.pending - 1);
  });
}

/** The ruling party's plaque in the government — the source of the party's ANSWER (the law is the party's, never the resolution's). */
function rulerPlaqueEl(root: HTMLElement): HTMLElement | undefined {
  return root.querySelector<HTMLElement>('[data-parl-ruler] .con-pseal') ?? root.querySelector<HTMLElement>('[data-parl-ruler]') ?? undefined;
}

/** The birth points of `specs` on `el`'s printed graphic (the carrier card, the ruler's formula) — the address's own icons. */
function iconOriginsOn(el: HTMLElement, specs: ReadonlyArray<ResourceTransferSpec>): Array<TransferPoint | undefined> {
  return resolveGainIconOrigins(resolveActionCommitAnchors(el, undefined), specs);
}

/** One wave: `rewards`' chips from their origins on `sourceEl` to their rail rows; each touchdown releases its own hold. */
function launchWave(runState: StageRun, rewards: ReadonlyArray<OwedReward>, sourceEl: HTMLElement, sourceSelector: string): Promise<void> {
  const specs = rewards.map((r) => r.spec);
  const bySpec = new Map<ResourceTransferSpec, OwedReward>(rewards.map((r) => [r.spec, r]));
  const wave = runResourceTransfers({
    specs,
    origins: iconOriginsOn(sourceEl, specs),
    source: {selectors: [sourceSelector]},
    arrival: 'auto',
    onArrive: (spec) => {
      const reward = bySpec.get(spec);
      if (reward !== undefined) {
        markRewardLanded(reward);
      }
    },
  });
  trackWave(runState, wave);
  return wave;
}

/**
 * НАГРАДА: what the law just paid THIS seat arrives by its ADDRESS
 * (`rewardAddress.ts`). With records OWED: the carrier card's ACTION COMMIT
 * impulse — the mechanical fix, the light band over its printed effect, the
 * ring on the result icon — hands off to the WAVE: each chip is born on the
 * card's own icon of its unit, flies to its rail row and ticks the counter on
 * contact (the panel hold seeded with the record releases per touchdown, the
 * delta chip rides that transition). The ruling party's ANSWER (a `reaction`
 * record) leaves the party's plaque in the government AFTER the resolution's
 * own chips have landed — surfaces in turn. With nothing owed: the page's own
 * reveal (the reading rows cascade). A carrier that is not on screen releases
 * every hold at once — the counters tick, honestly late, never lost.
 */
function beatReward(tl: gsap.core.Timeline, ctx: SittingDirectorContext, k: number, runState: StageRun): number {
  const root = ctx.root;
  const owed = takeOwedRewards();
  if (owed.length === 0) {
    // NOTHING FLIES, SO THE BEAT IS A READ (v5). The reward's whole reading is the BAND's line — the payout
    // formula, the ruling party's answer, a skip with its reason — and the band brings it in by its own
    // crossfade. The beat spends its time letting that line be read, never re-animating it.
    let at = s(REWARD_REVEAL_MS) * k;
    // THE TILE'S RECEIPT: the frame is back from the board and the line says what the winner's tile did — it is
    // READ for a beat before the walk goes on.
    if (parliamentRewardState.receiptShowing) {
      at += s(RECEIPT_DWELL_MS) * k;
    }
    // …AND A BEAT WHOSE WHOLE CONTENT IS A READING MUST BE READABLE (v4's own finding, kept). A resolution that
    // pays nothing still leaves something behind — the effect that now stands, or the action to take — and the
    // band is the only place that says so. With only the crossfade to spend, that beat stood 271 ms (measured)
    // and the walk moved on: a reading nobody can read is not a reading. «Дожать» still drives it to its
    // end, because the dwell is part of the beat's own timeline.
    if (root.querySelector('[data-parl-band-quiet]') !== null) {
      at += s(QUIET_REWARD_DWELL_MS) * k;
    }
    return at;
  }
  const card = enactedCardEl();
  const own = owed.filter((r) => r.delivery.address.source === 'card-icon');
  const reactions = owed.filter((r) => r.delivery.address.source === 'party-plaque');
  const release = (list: ReadonlyArray<OwedReward>) => list.forEach((r) => markRewardLanded(r));
  if (card === undefined) {
    release(owed);
    return 0;
  }
  const cardSelector = '[data-parl-sit-hero] .con-parl__gov-card .pcard, .con-parl [data-parl-gov-carry] .con-parl__gov-card .pcard';
  const flyReactions = () => {
    if (reactions.length === 0) {
      return;
    }
    const plaque = rulerPlaqueEl(root);
    if (plaque === undefined || runState.finished) {
      release(reactions);
      return;
    }
    const emblem = plaque.querySelector<HTMLElement>('.con-pseal__emblem');
    if (emblem !== null) {
      gsap.fromTo(emblem, {scale: 1}, {
        scale: 1.14, duration: s(160), ease: 'sine.out', yoyo: true, repeat: 1, transformOrigin: '50% 50%', clearProps: 'transform,transformOrigin',
        onInterrupt: () => gsap.set(emblem, {clearProps: 'transform,transformOrigin'}),
      });
    }
    void launchWave(runState, reactions, plaque, '[data-parl-ruler] .con-pseal__formula, [data-parl-ruler]');
  };
  let at = 0;
  if (own.length > 0) {
    tl.call(() => {
      if (runState.finished) {
        release(own);
        return;
      }
      let handedOff = false;
      const handle = runActionCommitMotion({
        cardWrapEl: card,
        ctaEl: undefined,
        actionNode: undefined,
        kind: 'resources',
        firstResource: own[0].spec.resource,
        onHandoff: () => {
          handedOff = true;
          void launchWave(runState, own, card, cardSelector).then(() => {
            void nextTick(() => probeTick(flyReactions));
          });
        },
        onSettled: () => {
          if (!handedOff) {
            // The impulse was torn down before its handoff (an abort): the wave never left, so nothing else will
            // release these records.
            release(own);
            release(reactions);
          }
        },
      });
      runState.kills.push(handle.kill);
    }, undefined, at);
    at += s(REWARD_IMPULSE_MS + REWARD_WAVE_MS) * k;
    if (reactions.length > 0) {
      at += s(REACTION_GAP_MS + REWARD_WAVE_MS) * k;
    }
  } else {
    tl.call(flyReactions, undefined, at);
    at += s(REWARD_WAVE_MS) * k;
  }
  return at;
}

// ── ИТОГИ ──────────────────────────────────────────────────────────────────

/** The renewal: the losers leave their homes, the deal WITH THE TURN, the support votes seat, the lobby refills — then the results card reveals. */
function beatResults(tl: gsap.core.Timeline, ctx: SittingDirectorContext, k: number, runState: StageRun): number {
  const root = ctx.root;
  const holds = parliamentHolds;
  const summary = ctx.summary;
  let at = 0;
  const returning = returningInstances(summary);
  const losers = (summary.discarded ?? []).filter((loser) => !returning.has(loser.instance));
  const dealCount = summary.refreshed.filter((f) => holds.freshFaces.has(f.instance)).length;
  const releaseTable = () => {
    holds.heldSlots = undefined;
    holds.vacated.clear();
    holds.liftedFaces.clear();
    holds.winnerSlot = undefined;
  };
  // (1) The losers leave from the homes they stood in (the held table): a proxy over each, the live table under them, the flights off.
  if (losers.length > 0) {
    tl.call(() => {
      void Promise.all(losers.map((loser) => parkFace(loser.resolution, slotFaceRect(root, loser.instance)))).then((ids) => {
        releaseTable();
        ids.forEach((id, n) => {
          if (id === undefined) {
            return;
          }
          if (runState.finished) {
            dropFlight(id);
            return;
          }
          flyToDeck(runState, ctx, id, n * LOSER_STAGGER_MS * k);
        });
      });
    }, undefined, at);
    at += s(DISCARD_MS + (losers.length - 1) * LOSER_STAGGER_MS) * k;
  } else if (dealCount > 0 || holds.heldSlots === undefined) {
    tl.call(releaseTable, undefined, at);
  }
  // (2) THE DEAL: each fresh resolution leaves the deck's top card, turns in flight, lands in its slot.
  let dealt = 0;
  tl.call(() => {
    const deckTop = deckRect(root);
    summary.refreshed.forEach((fresh) => {
      if (!holds.freshFaces.has(fresh.instance)) {
        return;
      }
      const face = root.querySelector<HTMLElement>(`.con-parl__slot[data-instance="${fresh.instance}"] .con-parl__card .pcard`) ??
        root.querySelector<HTMLElement>(`.con-parl__slot[data-instance="${fresh.instance}"] .con-parl__card`);
      const launched = () => {
        holds.deckPending = Math.max(0, holds.deckPending - 1);
      };
      const landed = () => {
        holds.freshFaces.delete(fresh.instance);
      };
      const id = dealResolutionCard({
        from: deckTop, to: rectOf(face), delayMs: dealt * DEAL_STAGGER_MS * k, durationMs: DEAL_FLIGHT_MS * k,
        face: resolutionPremiumVmById(fresh.resolution), onLaunch: launched, onLanded: landed,
      });
      if (id === undefined) {
        launched();
        landed();
      } else {
        runState.flights.add(id);
        dealt++;
      }
    });
  }, undefined, at);
  const dealSpan = dealCount > 0 ? s(DEAL_FLIGHT_MS + (dealCount - 1) * DEAL_STAGGER_MS) * k : 0;
  at += dealSpan;
  // (3) The support votes seat on the fresh cards: from the neutral supply.
  const seatCount = holds.hiddenCubes.size;
  if (seatCount > 0) {
    tl.call(() => {
      const supply = placeCubeRect(root, '[data-parl-neutral-cube]');
      let i = 0;
      for (const fresh of summary.refreshed) {
        const slot = ctx.view.slots.find((sl) => sl.instance === fresh.instance);
        if (slot === undefined) {
          continue;
        }
        const hidden = Array.from(holds.hiddenCubes).filter((key) => key.startsWith(`${slot.instance}#`));
        for (const key of hidden) {
          const seq = key.substring(key.lastIndexOf('#') + 1);
          const to = rectOf(root.querySelector(`.con-parl__slot[data-instance="${slot.instance}"] [data-seq="${seq}"]`));
          const delay = i * SEAT_STAGGER_MS * k;
          i++;
          const id = flyCube('neutral', supply, to, delay, () => {
            holds.hiddenCubes.delete(key);
            const left = (holds.support.get(fresh.party) ?? 0) - 1;
            if (left <= 0) {
              holds.support.delete(fresh.party);
            } else {
              holds.support.set(fresh.party, left);
            }
          });
          if (id !== undefined) {
            runState.flights.add(id);
          }
        }
      }
      if (i === 0) {
        holds.hiddenCubes.clear();
        holds.support.clear();
      }
    }, undefined, at);
    at += s(480 + (seatCount - 1) * SEAT_STAGGER_MS) * k;
  }
  // (4) Every free delegate returns from the reserve to the lobby's socket.
  const lobbyCount = holds.lobby.size;
  if (lobbyCount > 0) {
    tl.call(() => {
      let i = 0;
      for (const color of Array.from(holds.lobby)) {
        const from = placeCubeRect(root, `[data-parl-seat-reserve="${color}"]`);
        const to = placeCubeRect(root, `[data-parl-seat-lobby="${color}"]`);
        const delay = i * LOBBY_STAGGER_MS * k;
        i++;
        const id = flyCube(color, from, to, delay, () => holds.lobby.delete(color));
        if (id !== undefined) {
          runState.flights.add(id);
        }
      }
      if (i === 0) {
        holds.lobby.clear();
      }
    }, undefined, at);
    at += s(480 + (lobbyCount - 1) * LOBBY_STAGGER_MS) * k;
  }
  // (5) …and only once the LAST object has landed does the reading panel take the row's place (v4 §1): the
  //     table's beats above all moved objects the player had to see, so the card that describes them may not
  //     stand over the row while they fly. Flipping `resultsRevealed` is what puts the surface into READING
  //     mode; the panel mounts and unfolds on the next tick, and the card's rows cascade inside it.
  tl.call(() => {
    sittingMotion.resultsRevealed = true;
    void nextTick().then(() => probeTick(() => {
      const rows = itemsOf(root, '.con-sit__panel--on .con-sit__results > *');
      if (rows.length === 0 || runState.finished) {
        return;
      }
      const reveal = gsap.timeline();
      descendCascade(reveal, rows, s(CLOSING_MS) * k, 0, 0);
      runState.kills.push(() => {
        reveal.kill();
        gsap.set(rows, {clearProps: 'transform,opacity,visibility'});
      });
    }));
  }, undefined, at);
  // The panel's own unfold (0.3–0.4 s) plus the rows' cascade — the beat owns the whole reading handoff.
  at += s(BODY_SWAP_MS + CLOSING_MS) * k;
  return at;
}

// ── the runs ───────────────────────────────────────────────────────────────

/** Force the poses a STAGE would end in — reduced motion, or the ceiling's honest recovery. */
function settleStagePoses(stage: SittingStage): void {
  killParliamentFlights();
  sittingMotion.agendaSegment = undefined;
  switch (stage) {
  case 'verdict':
    sittingMotion.litSlot = '';
    break;
  case 'enact':
    sittingMotion.litSlot = '';
    releaseEnactmentHolds();
    flushAgendaBonus('stage-settled');
    break;
  case 'reward':
    // The rail's held counters tick now — a reward whose beat cannot play is announced by its delta chip, never withheld.
    flushParliamentRewards('stage-settled');
    break;
  case 'results':
    releaseRenewalHolds();
    sittingMotion.resultsRevealed = true;
    break;
  }
}

/**
 * ONE RUN — a master timeline under its named hold; resolves when at rest
 * (naturally, by «дожать», or by the ceiling). `build` adds the beat's calls
 * and returns the storyboard's arithmetic (seconds).
 */
function runBeat(stage: SittingStage, beat: '' | 'agenda' | 'support' | 'enact', compact: boolean,
  build: (tl: gsap.core.Timeline, runState: StageRun) => number): Promise<void> {
  const master = gsap.timeline({paused: true});
  const runState: StageRun = {stage, master, hold: {release: () => undefined}, flights: new Set(), pending: 0, kills: [], finished: false};
  const total = build(master, runState);
  // The master spans the storyboard's arithmetic; the run is AT REST only once its last flight has landed (the
  // flights fly on their own timelines), so the hold is the director's own and releases on that touchdown.
  master.to({}, {duration: Math.max(0.01, total + (compact ? 0 : s(80)))}, 0);
  run = runState;
  sittingMotion.beat = beat;
  runState.hold = beginAnimationHold(sittingHoldLabel(stage, beat), {
    maxHoldMs: STAGE_HOLD_CEILING_MS,
    diagnose: () => ({stage, beat, flights: Array.from(runState.flights).filter((id) => flightRegistered(id)), waves: runState.pending, holds: {
      returns: parliamentHolds.returns.size, incoming: parliamentHolds.supportIncoming.size, support: parliamentHolds.support.size,
      fresh: parliamentHolds.freshFaces.size, lobby: parliamentHolds.lobby.size, gov: parliamentHolds.govBefore !== undefined, ruler: parliamentHolds.rulerBefore,
    }}),
    expire: () => {
      if (run === runState) {
        finishSittingMotion();
        settleStagePoses(stage);
        settle();
      }
    },
  });
  let resolveRun: () => void = () => undefined;
  const settle = (): void => {
    if (run !== runState || runState.finished) {
      return;
    }
    runState.finished = true;
    runState.hold.release();
    sittingMotion.beat = '';
    sittingMotion.supportWave = '';
    if (runState.releaseAgendaCard) {
      runState.releaseAgendaCard = false;
      markAgendaBonusLanded();
    }
    resolveRun();
  };
  const awaitFlights = (): void => {
    if (run !== runState) {
      resolveRun();
      return;
    }
    const airborne = runState.pending > 0 || Array.from(runState.flights).some((id) => flightRegistered(id));
    if (airborne) {
      probeTick(awaitFlights);
    } else {
      settle();
    }
  };
  return new Promise<void>((resolve) => {
    resolveRun = resolve;
    master.eventCallback('onComplete', awaitFlights);
    master.play();
    if (hurry) {
      finishSittingMotion();
    }
  });
}

/** A pause between two beats on the motion clock (instant under «дожать» / reduced motion). */
function gap(baseMs: number): Promise<void> {
  if (hurry || consoleReducedMotionActive()) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => scheduleParliamentBeat(baseMs, resolve));
}

/**
 * PLAY A STAGE's beats. Resolves when the stage is at rest (naturally, by
 * «дожать», or by the ceiling). `compact` halves every duration and drops the
 * dwell (a restore). Reduced motion: the resting poses at once, the hold
 * registered and released synchronously.
 */
export async function playSittingStage(stage: SittingStage, beats: ReadonlyArray<SittingBeat>, ctx: SittingDirectorContext, opts: {compact: boolean}): Promise<void> {
  killSittingMotion();
  const own = beats.filter((b) => b.stage === stage);
  // The REWARD page always has a beat of its own (the reading's reveal, or the wave of what just arrived); the
  // RESULTS page always reveals its card — the summary's records are not their only fact.
  if ((own.length === 0 && stage !== 'reward' && stage !== 'results') || consoleReducedMotionActive()) {
    settleStagePoses(stage);
    // …EXCEPT THAT A READING IS STILL A READING UNDER REDUCED MOTION. The poses land at once — that is what
    // reduced motion asks for — but a page whose WHOLE content is a sentence («ЭФФЕКТ / ДЕЙСТВИЕ, ПОКА
    // ПРИНЯТА …», the only place a payout-less resolution says what it leaves behind) must still stand long
    // enough to be read: reduced motion removes MOTION, not information. The dwell rides the stage's own beat
    // machinery (hold, ceiling, «дожать»), never a wall clock.
    if (stage === 'reward' && ctx.root.querySelector('.con-sit__panel--on [data-sit-quiet]') !== null) {
      stagePlaying = stage;
      sittingMotion.stage = stage;
      try {
        await runBeat(stage, '', opts.compact, () => s(QUIET_REWARD_DWELL_MS));
      } finally {
        if (stagePlaying === stage) {
          stagePlaying = '';
          sittingMotion.stage = '';
        }
      }
    }
    return;
  }
  const k = opts.compact ? COMPACT : 1;
  stagePlaying = stage;
  sittingMotion.stage = stage;
  hurry = false;
  try {
    switch (stage) {
    case 'verdict':
      await runBeat(stage, '', opts.compact, (tl) => beatVerdict(tl, ctx, k));
      break;
    case 'enact':
      await runBeat(stage, 'agenda', opts.compact, (tl, r) => beatAgenda(tl, ctx, k, r));
      await gap(BEAT_GAP_MS);
      if (stagePlaying === stage) {
        await runBeat(stage, 'support', opts.compact, (tl, r) => beatSupport(tl, ctx, k, r));
        await gap(BEAT_GAP_MS);
      }
      if (stagePlaying === stage) {
        await runBeat(stage, 'enact', opts.compact, (tl, r) => beatEnactMove(tl, ctx, k, r));
      }
      break;
    case 'reward':
      await runBeat(stage, '', opts.compact, (tl, r) => beatReward(tl, ctx, k, r));
      break;
    case 'results':
      sittingMotion.resultsRevealed = false;
      await runBeat(stage, '', opts.compact, (tl, r) => beatResults(tl, ctx, k, r));
      sittingMotion.resultsRevealed = true;
      break;
    }
  } finally {
    if (stagePlaying === stage) {
      stagePlaying = '';
      sittingMotion.stage = '';
      hurry = false;
    }
  }
}

/**
 * «ДОЖАТЬ»: A during a beat drives the current run and every flight of the
 * stage to their resting pose — the touchdown callbacks fire, the holds fold,
 * the proxies leave on the next frame — and every beat still to come plays
 * at once. Never a skipped stage.
 */
export function finishSittingMotion(): void {
  hurry = true;
  const current = run;
  if (current === undefined || current.finished) {
    return;
  }
  finishParliamentFlights();
  current.master.progress(1);
  // A flight launched by the master's last `call` (progress(1) fires it) is driven to rest too.
  finishParliamentFlights();
}

/** Abort (unmount, a stage change mid-beat, the ceiling) — nothing stays posed. */
export function killSittingMotion(): void {
  const current = run;
  run = undefined;
  stagePlaying = '';
  hurry = false;
  sittingMotion.stage = '';
  sittingMotion.beat = '';
  sittingMotion.supportWave = '';
  sittingMotion.agendaSegment = undefined;
  if (current === undefined) {
    return;
  }
  current.finished = true;
  current.master.kill();
  current.hold.release();
  for (const id of current.flights) {
    dropFlight(id);
  }
  for (const kill of current.kills) {
    kill();
  }
  if (current.releaseAgendaCard) {
    // An aborted enactment still owes the step's card — released honestly now.
    current.releaseAgendaCard = false;
    markAgendaBonusLanded();
  }
}

/** The director's whole reset (the section's unmount): the flights and the poses of the motion; the display holds stay (they outlive the section). */
export function resetSittingDirector(): void {
  killSittingMotion();
  sittingMotion.litSlot = '';
  sittingMotion.resultsRevealed = false;
}

/** The number of milliseconds a compact replay of `stages` takes at most (the resume budget read by the section). */
export function sittingCompactBudgetMs(stages: ReadonlyArray<SittingStage>): number {
  return stages.length * consoleMotionMs(900) * COMPACT;
}
