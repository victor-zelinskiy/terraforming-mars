/*
 * CARD DEAL SEQUENCE — the reactive glue between a console card surface
 * (ConsoleStartScene / ConsoleTaskHost) and the GSAP deal director.
 *
 * One instance per host component (created in data(), disposed in
 * beforeUnmount). It owns the deal lifecycle:
 *
 *  prepare(dealKey, cardNames)  — SYNCHRONOUS, called from a pre-flush
 *      watcher on the prompt identity, BEFORE the new frame paints. Decides
 *      whether a cinematic runs (reduced motion → no; already dealt → no)
 *      and, when it does, arms the HOLD state in the same render pass so
 *      the real cards mount hidden — zero first-frame flash, zero layout
 *      shift (the grid is final from frame one).
 *
 *  launch(opts)                 — after the frame settled (nextTick +
 *      swap-transition delay), measures the real slots and starts the
 *      director. Any degenerate measure (JSDOM, zero rects, missing layer)
 *      finishes instantly — a held slot can never strand the prompt.
 *
 *  skip()                       — any gamepad press mid-deal jumps to the
 *      final state (the host swallows that press).
 *
 * While `state.active` the host: renders ConsoleCardDealLayer, holds its
 * slots via `isHeld(key)`, advertises ONLY the skip hint in the command
 * bar, and suppresses the focus frame — the action bar never promises a
 * selection that isn't interactive yet.
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {consoleReducedMotionActive, REDUCED_MOTION_CAP_MS} from '@/client/console/composables/useConsoleReducedMotion';
import {shouldRunDealOnce} from '@/client/console/cardDeal/cardDealMemory';
import {dealTimings, REDUCED_REVEAL_STEP_MS} from '@/client/console/cardDeal/cardDealModel';
import {DealHandle, DealTargetRect, runCardDealTimeline} from '@/client/console/cardDeal/cardDealDirector';

export type DealLaunchArgs = {
  /** The real card elements (`.card-container`) in card order. */
  slotCards: ReadonlyArray<HTMLElement>,
  /** Proxy flyers from ConsoleCardDealLayer (same order). */
  proxies: ReadonlyArray<HTMLElement>,
  /** Deck stack element from the layer. */
  deck: HTMLElement | null,
};

/** Measure retry budget: layout / fit-zoom may need a few frames to settle. */
const MEASURE_RETRIES = 12;

export type CardDealSequence = ReturnType<typeof createCardDealSequence>;

export function createCardDealSequence() {
  const state = reactive({
    /** A managed cinematic is running — hosts hold slots + swallow input. */
    active: false,
    /** Cards the ACTIVE deal is flying (drives the proxy layer render). */
    cards: [] as Array<CardName>,
    /** Slot keys whose real card has been revealed (hold released). */
    revealed: new Set<string>(),
    /** Bumps per prepared deal (keys the proxy layer). */
    nonce: 0,
  });

  let keys: Array<string> = [];
  let handle: DealHandle | undefined;
  let retries = 0;
  let probeSig = '';
  let reducedTimers: Array<ReturnType<typeof setTimeout>> = [];

  const isHeld = (key: string): boolean => state.active && !state.revealed.has(key);

  const finish = () => {
    keys.forEach((k) => state.revealed.add(k));
    state.active = false;
    state.cards = [];
    handle = undefined;
  };

  /**
   * Reduced-motion variant: no proxies, no flight — the real slots reveal
   * in a short stagger capped well under REDUCED_MOTION_CAP_MS, riding the
   * slot's own opacity transition. Input is NOT gated (active flips off
   * immediately) — reduced motion never delays interactivity.
   */
  const runReduced = () => {
    const pending = [...keys];
    state.active = false;
    state.cards = [];
    pending.forEach((k, i) => {
      const t = setTimeout(() => state.revealed.add(k),
        Math.min(i * REDUCED_REVEAL_STEP_MS, REDUCED_MOTION_CAP_MS));
      reducedTimers.push(t);
    });
  };

  return {
    state,
    isHeld,

    /**
     * Decide + arm, synchronously (pre-paint). Returns true when a managed
     * cinematic will run and the host must call launch() after settle.
     */
    prepare(dealKey: string, cardNames: ReadonlyArray<CardName>, slotKeys: ReadonlyArray<string>): boolean {
      this.dispose();
      state.revealed = new Set<string>();
      keys = [...slotKeys];
      if (cardNames.length === 0 || typeof window === 'undefined') {
        finish();
        return false;
      }
      if (!shouldRunDealOnce(dealKey)) {
        finish();
        return false;
      }
      if (consoleReducedMotionActive()) {
        runReduced();
        return false;
      }
      state.active = true;
      state.cards = [...cardNames];
      state.nonce++;
      return true;
    },

    /** Measure + run (host calls after nextTick + swap-transition delay). */
    launch(args: DealLaunchArgs): void {
      if (!state.active || handle !== undefined) {
        return;
      }
      const {slotCards, proxies, deck} = args;
      if (slotCards.length !== keys.length || proxies.length !== keys.length) {
        finish();
        return;
      }
      const targets: Array<DealTargetRect> = slotCards.map((el) => {
        const r = el.getBoundingClientRect();
        return {left: r.left, top: r.top, width: r.width, height: r.height};
      });
      // Layout not ready (fit-zoom mid-retry / fonts / a frame swap still in
      // flight): retry until the rects are non-degenerate AND stable across
      // two consecutive frames. Budget exhausted → degenerate reveals
      // instantly (JSDOM / broken layout), a merely-unstable grid deals on
      // the last measure — never strand the prompt.
      const degenerate = targets.some((r) => r.width < 10 || r.height < 10);
      const sig = targets.map((r) => `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}`).join('|');
      if (retries < MEASURE_RETRIES && (degenerate || sig !== probeSig)) {
        probeSig = sig;
        retries++;
        requestAnimationFrame(() => this.launch(args));
        return;
      }
      if (degenerate) {
        finish();
        return;
      }
      retries = 0;
      probeSig = '';
      const layerH = window.innerHeight;
      const layerW = window.innerWidth;
      handle = runCardDealTimeline({
        proxies,
        targets,
        deck,
        // The dealer sits bottom-centre, above the command bar band.
        deckAnchor: {x: layerW / 2, y: layerH - 200},
        timings: dealTimings(keys.length),
        onReveal: (i) => {
          const k = keys[i];
          if (k !== undefined) {
            state.revealed.add(k);
          }
        },
        onDone: finish,
      });
    },

    /** Any input mid-deal: jump to the final state (host swallows the press). */
    skip(): void {
      if (handle !== undefined) {
        handle.skip();
      } else if (state.active) {
        finish();
      }
    },

    /** Unmount / re-prepare: tear down timers + timeline. */
    dispose(): void {
      reducedTimers.forEach(clearTimeout);
      reducedTimers = [];
      if (handle !== undefined) {
        handle.kill();
        handle = undefined;
      }
      if (state.active) {
        finish();
      }
      retries = 0;
    },
  };
}
