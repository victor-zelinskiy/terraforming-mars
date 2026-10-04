/*
 * «ШАГ ШКАЛЫ ПЛАТИТ» — the scene of a card that answers each step of a scale
 * (TR24 Venusian Census, Aphrodite): the pure half
 * (`scaleStepRewardModel.ts`) and the director's laws (`scaleStepRewardBeat.ts`):
 *
 *  1. THE CLAIM — only the records NEW in a response, once by `seq`; a first
 *     view (a reload) claims nothing; the viewer's OWN gain is held on its
 *     counter in the seed, another seat's never.
 *  2. CAUSE BEFORE CONSEQUENCE — nothing is released while the board is
 *     covered, while the park still holds the scale's value, or before the
 *     marker has ARRIVED at the division the step reached.
 *  3. THE TOUCHDOWN — the counter is released token by token; the scene ends
 *     with nothing held, the queue empty and its quiet promise resolved.
 *  4. HONEST DEGRADE — nothing to measure: the holds go at once, `degraded`.
 */
import {expect} from 'chai';
import {GlobalParameter} from '@/common/GlobalParameter';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {Resource} from '@/common/Resource';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ScaleStepRewardModel} from '@/common/models/ScaleStepRewardModel';
import {
  freshScaleStepRewards, scaleAccentOf, scaleStepHoldSpec, scaleStepTokenOrigins, scaleStepTokenSpecs,
} from '@/client/console/scaleStepReward/scaleStepRewardModel';
import {
  resetScaleStepRewards, scaleStepRewardBusy, scaleStepRewardState, scaleStepRewardsQuiet, seedScaleStepRewardHolds,
} from '@/client/console/scaleStepReward/scaleStepRewardBeat';
import {
  noteScaleMarkerMoving, noteScaleMarkerSettled, resetScaleMarkerPoses, scaleMarkerArrived,
} from '@/client/components/board/scaleMarkerArrival';
import {boardBeatParkState, registerBoardWatchableProbe, resetBoardBeatPark} from '@/client/console/boardBeatPark';
import {clearPanelRewardHold, heldCardResource, heldStock} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {resetPresentationLedger} from '@/client/console/presentationLedger';

function census(seq: number, over: Partial<ScaleStepRewardModel> = {}): ScaleStepRewardModel {
  return {
    seq, parameter: GlobalParameter.VENUS, steps: 1, before: 8, after: 10, owner: 'blue', card: CardName.VENUSIAN_CENSUS,
    gain: {kind: 'cardResource', resource: CardResource.DATA, amount: 2}, by: 'red', ...over,
  };
}

function aphrodite(seq: number): ScaleStepRewardModel {
  return census(seq, {card: CardName.APHRODITE, steps: 2, after: 12, gain: {kind: 'stock', resource: Resource.MEGACREDITS, amount: 4}});
}

function view(color: string, rewards: ReadonlyArray<ScaleStepRewardModel> | undefined): PlayerViewModel {
  return {thisPlayer: {color}, game: {scaleStepRewards: rewards}} as unknown as PlayerViewModel;
}

/** A venus cursor on the page with a real box (jsdom lays nothing out). */
function mountMarker(rect = {left: 400, top: 200, width: 40, height: 40}): HTMLElement {
  const el = document.createElement('div');
  el.className = 'scale-marker scale-marker--venus';
  el.dataset.scaleMarker = 'venus';
  el.getBoundingClientRect = () => ({...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON: () => ({})}) as DOMRect;
  document.body.appendChild(el);
  return el;
}

function until(predicate: () => boolean, ms = 3000): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) {
        resolve();
      } else if (Date.now() - started > ms) {
        reject(new Error('timed out'));
      } else {
        setTimeout(tick, 10);
      }
    };
    tick();
  });
}

describe('scaleStepRewardModel (pure)', () => {
  it('a record is NEW only against the view before it — oldest first; a first view claims nothing', () => {
    const a = census(4100);
    const b = aphrodite(4101);
    expect(freshScaleStepRewards([a], [a, b], true).map((r) => r.seq)).deep.eq([4101]);
    expect(freshScaleStepRewards(undefined, [b, a], true).map((r) => r.seq)).deep.eq([4100, 4101]);
    expect(freshScaleStepRewards(undefined, [a, b], false), 'a reload replays nothing').deep.eq([]);
    expect(freshScaleStepRewards([a], [a], true)).deep.eq([]);
  });

  it('the tokens: one per unit of a card resource; one chip per STEP of a stock payment', () => {
    expect(scaleStepTokenSpecs(census(1, {steps: 2, gain: {kind: 'cardResource', resource: CardResource.DATA, amount: 4}})))
      .deep.eq(Array.from({length: 4}, () => ({channel: 'card-resource', resource: 'data', amount: 1})));
    expect(scaleStepTokenSpecs(aphrodite(2))).deep.eq([
      {channel: 'stock', resource: 'megacredits', amount: 2},
      {channel: 'stock', resource: 'megacredits', amount: 2},
    ]);
    expect(scaleStepHoldSpec(census(3))).deep.eq({channel: 'card-resource', resource: 'data', amount: 2});
    expect(scaleStepHoldSpec(aphrodite(4))).deep.eq({channel: 'stock', resource: 'megacredits', amount: 4});
  });

  it('every token is born INSIDE the marker\'s box, never two on one point', () => {
    const marker = {x: 100, y: 50, w: 40, h: 40};
    for (const n of [1, 2, 4]) {
      const origins = scaleStepTokenOrigins(marker, n);
      expect(origins).has.length(n);
      for (const o of origins) {
        expect(o.x).within(marker.x, marker.x + marker.w);
        expect(o.y).within(marker.y, marker.y + marker.h);
      }
      expect(new Set(origins.map((o) => `${o.x.toFixed(2)},${o.y.toFixed(2)}`)).size).eq(n);
    }
    expect(scaleAccentOf(GlobalParameter.VENUS)).eq('venus');
    expect(scaleAccentOf(GlobalParameter.OCEANS)).is.undefined;
  });

  it('the marker has ARRIVED only when it RESTS on (or past) the division', () => {
    resetScaleMarkerPoses();
    expect(scaleMarkerArrived('venus', 10), 'no cursor published').is.false;
    noteScaleMarkerSettled('venus', 8);
    expect(scaleMarkerArrived('venus', 10)).is.false;
    noteScaleMarkerMoving('venus', 10);
    expect(scaleMarkerArrived('venus', 10), 'gliding is not arrived').is.false;
    noteScaleMarkerSettled('venus', 10);
    expect(scaleMarkerArrived('venus', 10)).is.true;
    noteScaleMarkerSettled('venus', 14);
    expect(scaleMarkerArrived('venus', 10), 'a glide carried further passed the division').is.true;
  });
});

describe('scaleStepRewardBeat (the director)', function() {
  // The scene walks its real breath on the GSAP clock — nothing is faked.
  // eslint-disable-next-line no-invalid-this
  this.timeout(10_000);
  let watchable = true;
  let marker: HTMLElement | undefined;

  beforeEach(() => {
    resetScaleStepRewards();
    resetBoardBeatPark();
    resetPresentationLedger();
    resetScaleMarkerPoses();
    clearPanelRewardHold();
    watchable = true;
    registerBoardWatchableProbe(() => watchable);
    noteScaleMarkerSettled('venus', 8);
    marker = mountMarker();
  });

  afterEach(() => {
    marker?.remove();
    marker = undefined;
    resetScaleStepRewards();
    resetBoardBeatPark();
    clearPanelRewardHold();
  });

  it('the viewer\'s OWN gain is held on its counter in the seed; another seat\'s never; a seq is claimed once', () => {
    noteScaleMarkerMoving('venus', 10); // the cursor is still travelling: the scene waits
    seedScaleStepRewardHolds(view('blue', []), view('blue', [census(5100), aphrodite(5101)]));
    expect(heldCardResource('data')).eq(2);
    expect(heldStock('megacredits')).eq(4);
    // The same frame again (a WS echo of the poll): nothing claimed twice.
    seedScaleStepRewardHolds(view('blue', []), view('blue', [census(5100), aphrodite(5101)]));
    expect(heldCardResource('data')).eq(2);
    expect(scaleStepRewardState.queue).has.length(2);
    // The opponent's page: the same records, nothing held.
    resetScaleStepRewards();
    clearPanelRewardHold();
    seedScaleStepRewardHolds(view('red', []), view('red', [census(5200)]));
    expect(heldCardResource('data')).eq(0);
    expect(scaleStepRewardState.queue.map((e) => e.own)).deep.eq([false]);
  });

  it('CAUSE BEFORE CONSEQUENCE: nothing is released before the marker ARRIVES — then token by token, and the scene ends quiet', async () => {
    noteScaleMarkerMoving('venus', 10);
    seedScaleStepRewardHolds(view('blue', []), view('blue', [census(5300)]));
    const quiet = scaleStepRewardsQuiet();
    expect(scaleStepRewardBusy()).is.true;
    await new Promise((r) => setTimeout(r, 250));
    expect(scaleStepRewardState.phase, 'the cursor is gliding').eq('waiting');
    expect(heldCardResource('data'), 'the counter does not move before its tokens').eq(2);
    noteScaleMarkerSettled('venus', 10);
    await quiet;
    expect(heldCardResource('data')).eq(0);
    expect(scaleStepRewardState.landed).eq(2);
    expect(scaleStepRewardState.phase).eq('idle');
    expect(scaleStepRewardState.degraded, 'a measured marker is no degrade').is.false;
  });

  it('a COVERED board, then a park still holding the value, both keep the scene waiting', async () => {
    watchable = false;
    noteScaleMarkerSettled('venus', 10); // even an arrived cursor: the player does not see it
    seedScaleStepRewardHolds(view('blue', []), view('blue', [census(5400)]));
    await new Promise((r) => setTimeout(r, 200));
    expect(scaleStepRewardState.phase).eq('waiting');
    expect(heldCardResource('data')).eq(2);
    // The board comes back but the park still presents the old value.
    boardBeatParkState.heldParams = {venusScaleLevel: 8};
    watchable = true;
    scaleStepRewardState.nudge++;
    await new Promise((r) => setTimeout(r, 200));
    expect(scaleStepRewardState.phase).eq('waiting');
    // The drain releases the value: the cursor already rests on 10 — the tokens go.
    boardBeatParkState.heldParams = undefined;
    await until(() => scaleStepRewardState.phase === 'idle');
    expect(heldCardResource('data')).eq(0);
  });

  it('two records play ONE AT A TIME, in the ring\'s order', async () => {
    noteScaleMarkerSettled('venus', 12);
    const order: Array<number | undefined> = [];
    seedScaleStepRewardHolds(view('blue', []), view('blue', [census(5501), aphrodite(5502)]));
    await until(() => {
      if (scaleStepRewardState.phase === 'paying' && order.at(-1) !== scaleStepRewardState.seq) {
        order.push(scaleStepRewardState.seq);
      }
      return scaleStepRewardState.phase === 'idle' && scaleStepRewardState.queue.length === 0;
    });
    expect(order).deep.eq([5501, 5502]);
    expect(heldStock('megacredits')).eq(0);
  });

  it('nothing to measure (no box): the holds go at once and the scene says DEGRADED', async () => {
    marker?.remove();
    marker = mountMarker({left: 0, top: 0, width: 0, height: 0});
    noteScaleMarkerSettled('venus', 10);
    seedScaleStepRewardHolds(view('blue', []), view('blue', [census(5600)]));
    await until(() => scaleStepRewardState.phase === 'idle');
    expect(heldCardResource('data')).eq(0);
    expect(scaleStepRewardState.degraded).is.true;
  });

  it('an abort releases every hold still owed and replays nothing', () => {
    noteScaleMarkerMoving('venus', 10);
    seedScaleStepRewardHolds(view('blue', []), view('blue', [census(5700)]));
    expect(heldCardResource('data')).eq(2);
    resetScaleStepRewards();
    expect(heldCardResource('data')).eq(0);
    expect(scaleStepRewardBusy()).is.false;
  });
});
