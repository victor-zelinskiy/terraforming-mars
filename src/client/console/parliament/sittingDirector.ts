/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SITTING DIRECTOR (Turmoil Redux — docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md
 * §6; docs/TURMOIL_REDUX_PARLIAMENT_SITTING.md § Э4) — the ONE owner of the
 * sitting's timelines. A stage's beats (`sittingBeats.ts`) become one GSAP
 * master timeline under ONE animation hold (`parliament-sitting:<stage>`),
 * every object on it MOVES from a real, measured place to a real, measured
 * place:
 *
 *   ВЕРДИКТ   — light + numbers on the winning card (parked face-up over the
 *               slot it won in); nothing flies.
 *   ПРИНЯТИЕ  — the old law leaves for the deck zone; the winner FLIPs from its
 *               slot into the government (one visible card the whole way — the
 *               government's face waits under `govAwaits`); its delegates go
 *               home by OWNER (a player's to their reserve, neutral to the
 *               supply); popular support seats its cubes on the parties'
 *               places (the tier peeks through the stage for the beat); the
 *               ruling plaque and the quest REVEAL; the Agenda glide runs its
 *               own hold beside it.
 *   ОБНОВЛЕНИЕ — the losers leave for the deck zone; three resolutions are
 *               DEALT from the deck's top card WITH A REAL 3D TURN (the face is
 *               readable only past 90°, the slot's own face shows on the
 *               touchdown, the proxy leaves on the next frame); support votes
 *               seat on the fresh cards; every free delegate returns to the
 *               lobby.
 *   ЗАКРЫТИЕ  — the compact results card REVEALS.
 *
 * A DURING A BEAT = «дожать»: the master and every flight are driven to their
 * resting pose (`progress(1)`) — never a skipped stage, never a proxy left in
 * the air. Reduced motion = the resting poses at once, the same stages, the
 * same A presses (the holds register and release synchronously). Perf-lite
 * plays the same timelines: transform / opacity only, no `filter`.
 *
 * Every beat is BOUNDED and NAMED: the hold's ceiling calls `expire`, which
 * ends the wedge (kills the flights, clears the display holds, releases the
 * peek) rather than merely masking it; `diagnose` names what was still in the
 * air. Durations go through the motion scale; no wall-clock timer anywhere
 * (`parliamentNoTimers.spec.ts`).
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
import {descendCascade} from '@/client/console/surfaceMotion/workspaceDescend';
import {AgendaMove, ParliamentViewVm} from './consoleParliamentModel';
import {SittingStage} from './consoleSittingFlow';
import {emptyParliamentHolds, parliamentHolds, resetParliamentHolds} from './parliamentDisplayHolds';
import {
  DEAL_FLIGHT_MS, DEAL_STAGGER_MS, dealResolutionCard, dropFlight, ENACT_MOVE_MS, finishParliamentFlights, flightEl, flightRegistered, flyCube,
  killParliamentFlights, nextFlightId, placeCubeRect, pushCardFlight, rectOf, registerFlightHandle,
} from './parliamentFlights';
import {Rect, runCardDealFlight} from './consoleParliamentVoteMotion';
import {SittingBeat} from './sittingBeats';

// ── the storyboard's budget (base ms; §6) ───────────────────────────────────
const VERDICT_LIGHT_MS = 220;
const VERDICT_PULSE_MS = 180;
const VERDICT_BADGE_MS = 260;
const DISCARD_MS = 320;
const RETURN_STAGGER_MS = 70;
const SUPPORT_STAGGER_MS = 70;
const REVEAL_MS = 220;
const LOSER_STAGGER_MS = 90;
const SEAT_STAGGER_MS = 80;
const LOBBY_STAGGER_MS = 90;
const CLOSING_MS = 300;
/** A compact beat (resume / review) runs at half length, no dwell. */
const COMPACT = 0.5;
/** The hold's ceiling — above the longest stage (the renewal ≈ 2.4 s) by a wide margin. */
const STAGE_HOLD_CEILING_MS = 12_000;

/** What the director is doing — read by the section (peek) and the specs. */
export const sittingMotion = reactive({
  /** The stage whose beats are playing ('' at rest). */
  stage: '' as SittingStage | '',
  /** The parties tier PEEKS through the stage (the support beat lands on its places). */
  peek: false,
});

export type SittingDirectorContext = {
  /** The section's root — every measurement is scoped to it. */
  root: HTMLElement;
  view: ParliamentViewVm;
  model: ParliamentModel | undefined;
  summary: ParliamentPhaseSummaryModel;
  viewer: Color | undefined;
  /** The Agenda tier's own glide (it registers its own hold). */
  playAgendaGlide?: (move: AgendaMove) => void;
};

type StageRun = {
  stage: SittingStage;
  master: gsap.core.Timeline;
  hold: AnimationHold;
  /** Flights launched by this stage (their ids) — «дожать» drives them to rest. */
  flights: Set<string>;
  finished: boolean;
};

let run: StageRun | undefined;
/** The parked proxies of the sitting's opening (the winner over its former slot, the old law over the government). */
const parked = {winner: undefined as string | undefined, old: undefined as string | undefined};

const s = (baseMs: number): number => motionMs(baseMs) / 1000;

export function sittingMotionActive(): boolean {
  return run !== undefined && !run.finished;
}

/** The label the hold carries — the e2e reads the registry by it. */
export function sittingHoldLabel(stage: SittingStage): string {
  return `parliament-sitting:${stage}`;
}

// ── the display holds, per stage ───────────────────────────────────────────

/**
 * WHAT THE ENACTMENT STILL HAS TO MOVE, seeded before the sitting's first
 * frame: the returned delegates stay off their reserves, the gained support
 * stays off the parties' places, the government's face waits for the card.
 */
export function seedEnactHolds(summary: ParliamentPhaseSummaryModel, view: ParliamentViewVm): void {
  const pending = emptyParliamentHolds();
  for (const entry of summary.returned ?? []) {
    pending.returns.set(entry.owner, entry.count);
  }
  for (const entry of summary.support) {
    if (entry.gained > 0) {
      pending.support.set(entry.party, entry.gained);
    }
  }
  if (view.enacted !== undefined && view.enacted.instance === summary.enacted.instance) {
    pending.govAwaits = summary.enacted.instance;
  }
  Object.assign(parliamentHolds, pending);
}

/**
 * WHAT THE RENEWAL STILL HAS TO MOVE: the fresh cards are still on the deck
 * (their faces hidden, the pile one card thicker each), their neutral votes
 * have not arrived, the parties' consumed support still shows on the
 * plaques, the free delegates are still in the reserves.
 */
export function seedRenewalHolds(summary: ParliamentPhaseSummaryModel, view: ParliamentViewVm): void {
  // MERGED into whatever the enactment still holds (a resume seeds both sets
  // before its first frame), never a fresh record over it.
  const pending = parliamentHolds;
  for (const fresh of summary.refreshed) {
    pending.freshFaces.add(fresh.instance);
    if (fresh.neutralVotes <= 0) {
      continue;
    }
    const slot = view.slots.find((sl) => sl.instance === fresh.instance);
    if (slot === undefined) {
      continue;
    }
    const seqs = slot.votes.filter((v) => v.owner === 'neutral').map((v) => v.seq).sort((a, b) => a - b).slice(0, fresh.neutralVotes);
    for (const seq of seqs) {
      pending.hiddenCubes.add(`${slot.instance}#${seq}`);
    }
    pending.support.set(fresh.party, (pending.support.get(fresh.party) ?? 0) + seqs.length);
  }
  pending.deckPending = summary.refreshed.length;
  for (const color of summary.lobbyRefilled) {
    pending.lobby.add(color);
  }
}

// ── the parked cards of the opening ────────────────────────────────────────

/** The winner's former slot: the first EMPTY home's card outline (the refresh has not happened), else the slots' plate. */
function formerSlotRect(root: HTMLElement): Rect | undefined {
  return rectOf(root.querySelector('[data-parl-slot-empty] [data-parl-slot-empty-card]')) ??
    rectOf(root.querySelector('[data-parl-voting] .con-parl__slots'));
}

function governmentCardRect(root: HTMLElement): Rect | undefined {
  return rectOf(root.querySelector('[data-parl-gov] .con-parl__gov-card .pcard') ?? root.querySelector('[data-parl-gov] .con-parl__gov-card'));
}

function deckRect(root: HTMLElement): Rect | undefined {
  return rectOf(root.querySelector('[data-parl-deck-top]')) ?? rectOf(root.querySelector('[data-parl-deck]'));
}

/** A face-up proxy standing still over `at` (the parked pose). Returns its id, or undefined when nothing is measurable. */
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

/**
 * THE OPENING'S PARKED CARDS: the winner stands face-up where it won (the
 * government's face waits hidden), the old law stands over the government
 * until the enactment moves both. Under reduced motion nothing is parked —
 * the poses are final.
 */
export async function parkSittingCards(ctx: SittingDirectorContext): Promise<void> {
  unparkSittingCards();
  if (consoleReducedMotionActive() || parliamentHolds.govAwaits === undefined) {
    parliamentHolds.govAwaits = undefined;
    return;
  }
  const gov = governmentCardRect(ctx.root);
  parked.winner = await parkFace(ctx.summary.winner.resolution, formerSlotRect(ctx.root));
  if (parked.winner === undefined) {
    parliamentHolds.govAwaits = undefined;
    return;
  }
  parliamentHolds.parked = parked.winner;
  if (ctx.summary.discardedEnacted !== undefined) {
    parked.old = await parkFace(ctx.summary.discardedEnacted.resolution, gov);
  }
}

export function unparkSittingCards(): void {
  for (const key of ['winner', 'old'] as const) {
    const id = parked[key];
    if (id !== undefined) {
      dropFlight(id);
      parked[key] = undefined;
    }
  }
  parliamentHolds.parked = undefined;
}

// ── the beats ──────────────────────────────────────────────────────────────

function itemsOf(root: HTMLElement, selector: string): Array<HTMLElement> {
  return Array.from(root.querySelectorAll<HTMLElement>(selector));
}

/** ВЕРДИКТ: the winning card lights, the delegate number pulses, the winner row reveals; a tie's phrase last. */
function beatVerdict(tl: gsap.core.Timeline, ctx: SittingDirectorContext, k: number): number {
  const root = ctx.root;
  const winnerProxy = parked.winner === undefined ? undefined : flightEl(parked.winner);
  const lit = winnerProxy ?? root.querySelector<HTMLElement>('[data-parl-gov] .con-parl__gov-card');
  let at = 0;
  if (lit !== null && lit !== undefined) {
    tl.call(() => lit.classList.add('con-parl__flight--lit', 'con-parl__gov-card--lit'), undefined, at);
  }
  at += s(VERDICT_LIGHT_MS) * k;
  const number = root.querySelector<HTMLElement>('.con-sit__panel--on [data-sit-row="delegates"] b');
  if (number !== null) {
    tl.fromTo(number, {scale: 1}, {scale: 1.22, duration: s(VERDICT_PULSE_MS) * k * 0.5, ease: 'power2.out', transformOrigin: '50% 50%'}, at);
    tl.to(number, {scale: 1, duration: s(VERDICT_PULSE_MS) * k * 0.5, ease: 'power2.in'}, at + s(VERDICT_PULSE_MS) * k * 0.5);
  }
  at += s(VERDICT_PULSE_MS) * k;
  const rows = itemsOf(root, '.con-sit__panel--on [data-sit-row="winner"], .con-sit__panel--on [data-sit-row="tie"]');
  if (rows.length > 0) {
    descendCascade(tl, rows, s(VERDICT_BADGE_MS) * k, s(120) * k, at);
  }
  return at + s(VERDICT_BADGE_MS) * k + (rows.length > 1 ? s(120) * k : 0);
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

/** ПРИНЯТИЕ: the old law leaves, the winner moves into the government, the delegates go home, support seats, the plaque reveals. */
function beatEnact(tl: gsap.core.Timeline, ctx: SittingDirectorContext, k: number, runState: StageRun, agenda: AgendaMove | undefined): number {
  const root = ctx.root;
  const holds = parliamentHolds;
  let at = 0;
  // The Agenda glide runs beside the enactment on its own hold.
  if (agenda !== undefined && ctx.playAgendaGlide !== undefined) {
    const glide = ctx.playAgendaGlide;
    tl.call(() => glide(agenda), undefined, 0.01);
  }
  // (1) The old law leaves for the deck zone.
  if (parked.old !== undefined) {
    const old = parked.old;
    tl.call(() => {
      parked.old = undefined;
      flyToDeck(runState, ctx, old, 0);
    }, undefined, at);
  }
  // (2) The winner moves from its slot into the government — one visible card.
  const moveMs = ENACT_MOVE_MS * k;
  tl.call(() => {
    const id = parked.winner;
    const proxy = id === undefined ? undefined : flightEl(id);
    const to = governmentCardRect(root);
    const from = id === undefined || proxy === null || proxy === undefined ? undefined :
      ((r) => ({left: r.left, top: r.top, width: r.width, height: r.height}))(proxy.getBoundingClientRect());
    const settle = () => {
      holds.govAwaits = undefined;
      holds.parked = undefined;
      if (id !== undefined) {
        runState.flights.delete(id);
        probeTick(() => dropFlight(id));
      }
      parked.winner = undefined;
    };
    if (id === undefined || proxy === null || proxy === undefined || to === undefined || from === undefined) {
      settle();
      return;
    }
    proxy.classList.remove('con-parl__flight--lit');
    const handle = runCardDealFlight({proxy, from, to, durationMs: moveMs, onLanded: settle});
    registerFlightHandle(id, handle);
    runState.flights.add(id);
  }, undefined, at + 0.02);
  at += s(moveMs);
  // (3) The delegates go home by OWNER — from the card's centre, each at its reserve's own size.
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
  // (4) Popular support: the tier peeks through the stage, the neutral cubes seat on the parties' places.
  const supportTotal = Array.from(holds.support.values()).reduce((a, b) => a + b, 0);
  if (supportTotal > 0) {
    tl.call(() => {
      sittingMotion.peek = true;
      void nextTick(() => probeTick(() => launchSupport(runState, ctx, k)));
    }, undefined, at);
    at += s(SUPPORT_STAGGER_MS * (supportTotal - 1) + 480 + 80) * k;
  }
  // (5) The ruling plaque and the quest REVEAL.
  const reveals = itemsOf(root, '[data-parl-ruler], [data-parl-quest]');
  if (reveals.length > 0) {
    descendCascade(tl, reveals, s(REVEAL_MS) * k, s(100) * k, at);
    at += s(REVEAL_MS + 100) * k;
  }
  return at;
}

/** The support cubes leave the neutral supply for each party's next free place (the parties tier is peeking). */
function launchSupport(runState: StageRun, ctx: SittingDirectorContext, k: number): void {
  const root = ctx.root;
  const holds = parliamentHolds;
  const supply = placeCubeRect(root, '[data-parl-neutral-cube]');
  let i = 0;
  for (const [party, count] of Array.from(holds.support.entries())) {
    const places = itemsOf(root, `.con-parl__party[data-party="${party}"] .con-pseal__support-place`);
    const shownTotal = ctx.view.parties.find((p) => p.party === party)?.support ?? 0;
    for (let n = 0; n < count; n++) {
      // The place this cube takes: the first not yet lit (the plaque shows live − pending).
      const index = Math.min(places.length - 1, Math.max(0, shownTotal - count + n));
      const to = rectOf(places[index]);
      const delay = i * SUPPORT_STAGGER_MS * k;
      i++;
      const id = flyCube('neutral', supply, to, delay, () => {
        const left = (holds.support.get(party as ReduxParty) ?? 0) - 1;
        if (left <= 0) {
          holds.support.delete(party as ReduxParty);
        } else {
          holds.support.set(party as ReduxParty, left);
        }
        if (holds.support.size === 0) {
          sittingMotion.peek = false;
        }
      });
      if (id !== undefined) {
        runState.flights.add(id);
      }
    }
  }
  if (i === 0) {
    holds.support.clear();
    sittingMotion.peek = false;
  }
}

/** ОБНОВЛЕНИЕ: the losers leave, the deal WITH THE TURN, the support votes seat, the lobby refills. */
function beatRenewal(tl: gsap.core.Timeline, ctx: SittingDirectorContext, k: number, runState: StageRun): number {
  const root = ctx.root;
  const holds = parliamentHolds;
  const summary = ctx.summary;
  let at = 0;
  // (1) The losers leave from the slots they stood in (the fresh faces wait hidden there).
  const losers = summary.discarded ?? [];
  if (losers.length > 0) {
    tl.call(() => {
      const homes = itemsOf(root, '.con-parl__slots .con-parl__slot-home');
      losers.forEach((loser, n) => {
        const home = homes[n];
        const at2 = rectOf(home?.querySelector('.con-parl__card') ?? home ?? null);
        void parkFace(loser.resolution, at2).then((id) => {
          if (id === undefined || runState.finished) {
            if (id !== undefined) {
              dropFlight(id);
            }
            return;
          }
          flyToDeck(runState, ctx, id, n * LOSER_STAGGER_MS * k);
        });
      });
    }, undefined, at);
    at += s(DISCARD_MS + (losers.length - 1) * LOSER_STAGGER_MS) * k;
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
  const dealCount = summary.refreshed.filter((f) => holds.freshFaces.has(f.instance)).length;
  const dealSpan = dealCount > 0 ? s(DEAL_FLIGHT_MS + (dealCount - 1) * DEAL_STAGGER_MS) * k : 0;
  at += dealSpan;
  // (3) The support votes seat on the fresh cards: from the neutral supply (the parties tier is parked under the stage — a real, measured place).
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
  return at;
}

/** ЗАКРЫТИЕ: the compact results card reveals, row by row. */
function beatClosing(tl: gsap.core.Timeline, ctx: SittingDirectorContext, k: number): number {
  const rows = itemsOf(ctx.root, '.con-sit__panel--on .con-sit__closing > *');
  if (rows.length === 0) {
    return 0;
  }
  descendCascade(tl, rows, s(CLOSING_MS) * k, s(60) * k, 0);
  return s(CLOSING_MS) * k + s(60) * k * (rows.length - 1);
}

// ── the stage run ──────────────────────────────────────────────────────────

/** Force the poses a stage would end in — reduced motion, or the ceiling's honest recovery. */
function settleStagePoses(): void {
  unparkSittingCards();
  killParliamentFlights();
  resetParliamentHolds();
  sittingMotion.peek = false;
}

/**
 * PLAY A STAGE's beats. Resolves when the stage is at rest (naturally, by
 * «дожать», or by the ceiling). `compact` halves every duration and drops
 * the dwell (resume / review). Reduced motion: the resting poses at once,
 * the hold registered and released synchronously.
 */
export function playSittingStage(stage: SittingStage, beats: ReadonlyArray<SittingBeat>, ctx: SittingDirectorContext, opts: {compact: boolean}): Promise<void> {
  killSittingMotion();
  const own = beats.filter((b) => b.stage === stage);
  if (own.length === 0 || consoleReducedMotionActive()) {
    // Nothing to move (or a reduced-motion pose): every object is already where it ends.
    if (stage === 'enact' || stage === 'renewal' || consoleReducedMotionActive()) {
      settleStagePoses();
    }
    return Promise.resolve();
  }
  const k = opts.compact ? COMPACT : 1;
  const master = gsap.timeline({paused: true});
  const runState: StageRun = {stage, master, hold: {release: () => undefined}, flights: new Set(), finished: false};
  let total = 0;
  const agenda = own.find((b) => b.kind === 'agenda')?.agenda;
  switch (stage) {
  case 'verdict':
    total = beatVerdict(master, ctx, k);
    break;
  case 'enact':
    total = beatEnact(master, ctx, k, runState, agenda === undefined ? undefined : {player: agenda.player, from: agenda.from, to: agenda.to});
    break;
  case 'renewal':
    total = beatRenewal(master, ctx, k, runState);
    break;
  case 'closing':
    total = beatClosing(master, ctx, k);
    break;
  case 'reward':
    // The reward's physics (the wave, the take, the tile) belong to Э5; its poses are static here.
    break;
  }
  // The master spans the storyboard's arithmetic; the stage is AT REST only
  // once its last flight has landed (the flights fly on their own timelines),
  // so the hold is the director's own and releases on that touchdown, never
  // on the master's end alone — an early release let a cube launched by the
  // master's last beat land after the hold was gone.
  master.to({}, {duration: Math.max(0.01, total + (opts.compact ? 0 : s(80)))}, 0);
  run = runState;
  sittingMotion.stage = stage;
  runState.hold = beginAnimationHold(sittingHoldLabel(stage), {
    maxHoldMs: STAGE_HOLD_CEILING_MS,
    diagnose: () => ({stage, flights: Array.from(runState.flights).filter((id) => flightRegistered(id)), peek: sittingMotion.peek, holds: {
      returns: parliamentHolds.returns.size, support: parliamentHolds.support.size, fresh: parliamentHolds.freshFaces.size, lobby: parliamentHolds.lobby.size,
    }}),
    expire: () => {
      if (run === runState) {
        finishSittingMotion();
        settleStagePoses();
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
    sittingMotion.stage = '';
    runState.hold.release();
    resolveRun();
  };
  const awaitFlights = (): void => {
    if (run !== runState) {
      resolveRun();
      return;
    }
    const airborne = Array.from(runState.flights).some((id) => flightRegistered(id));
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
  });
}

/**
 * «ДОЖАТЬ»: A during a beat drives the master and every flight of the stage
 * to their resting pose — the touchdown callbacks fire, the holds fold, the
 * proxies leave on the next frame. Never a skipped stage.
 */
export function finishSittingMotion(): void {
  const current = run;
  if (current === undefined || current.finished) {
    return;
  }
  finishParliamentFlights();
  current.master.progress(1);
  // A flight launched by the master's last `call` (progress(1) fires it) is driven to rest too.
  finishParliamentFlights();
  sittingMotion.peek = false;
}

/** Abort (unmount, a stage change mid-beat, the ceiling) — nothing stays posed. */
export function killSittingMotion(): void {
  const current = run;
  run = undefined;
  sittingMotion.stage = '';
  if (current === undefined) {
    return;
  }
  current.finished = true;
  current.master.kill();
  current.hold.release();
  for (const id of current.flights) {
    dropFlight(id);
  }
  sittingMotion.peek = false;
}

/** The director's whole reset (the section's unmount). */
export function resetSittingDirector(): void {
  killSittingMotion();
  unparkSittingCards();
  sittingMotion.peek = false;
  sittingMotion.stage = '';
}

/** The number of milliseconds a compact replay of `stages` takes at most (the resume budget read by the section). */
export function sittingCompactBudgetMs(stages: ReadonlyArray<SittingStage>): number {
  return stages.length * consoleMotionMs(900) * COMPACT;
}
