/*
 * «ШАГ ШКАЛЫ ПЛАТИТ РЕЙТИНГ» (TR41 Plasma Fans) — the pure half
 * (`scaleStepRatingPlan`), the hand-over of the Greens' TR answer from the
 * two rail halves (`withoutScaleStepAnswers`), and the director's laws:
 *
 *  1. THE PROMISE OFF THE DIFF — the viewer's own rating rose, in the action
 *     phase, by exactly the steps the scales made (+ the Venus 16 % bonus);
 *     anything else (an ocean, a direct TR beside the step, a rival's step,
 *     the Solar phase, another seat's view) is nobody's to fly.
 *  2. THE ANSWER — the Greens' 2 M€ per rating step is the plan's reaction
 *     only when the M€ moved by exactly that.
 *  3. THE HAND-OVER — a chain that raises a scale and carries no rating of its
 *     own drops the STOCK M€ answers (the scale-step beat's), keeps a
 *     PRODUCTION answer, and keeps everything when it flies its own rating.
 *  4. CAUSE BEFORE CONSEQUENCE — the rating is held on the seed, released
 *     only once the board is watchable, the park has let the value go and the
 *     marker has ARRIVED; the census scene waits for it; a reset releases.
 */
import {expect} from 'chai';
import {Phase} from '@/common/Phase';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {
  resetScaleStepRating, scaleStepRatingBusy, scaleStepRatingPlan, scaleStepRatingState, seedScaleStepRatingHold,
} from '@/client/console/scaleStepReward/scaleStepRatingBeat';
import {commitRailPlan, playRailReward, withoutScaleStepAnswers} from '@/client/console/consoleActionCommit';
import {noteScaleMarkerMoving, noteScaleMarkerSettled, resetScaleMarkerPoses} from '@/client/components/board/scaleMarkerArrival';
import {boardBeatParkState, registerBoardWatchableProbe, resetBoardBeatPark} from '@/client/console/boardBeatPark';
import {clearPanelRewardHold, heldStock} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {RATING_RAIL_KEY, ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {resetPresentationLedger} from '@/client/console/presentationLedger';
import {CardName} from '@/common/cards/CardName';

type Seat = {terraformRating?: number, megacredits?: number};
type Scales = {temperature?: number, oxygenLevel?: number, venusScaleLevel?: number, oceans?: number, phase?: Phase};

function view(seat: Seat, scales: Scales, id = 'p-blue'): PlayerViewModel {
  return {
    id,
    thisPlayer: {color: 'blue', terraformRating: 20, megacredits: 20, ...seat},
    game: {phase: Phase.ACTION, temperature: -30, oxygenLevel: 0, venusScaleLevel: 0, oceans: 0, ...scales},
  } as unknown as PlayerViewModel;
}

const mc = (amount: number): ResourceTransferSpec => ({channel: 'stock', resource: 'megacredits', amount});
const mcProd = (amount: number): ResourceTransferSpec => ({channel: 'production', resource: 'megacredits', amount});

function venusBranch(): ActionPreviewBranch {
  return {
    index: -1, title: '', available: true, renderKeys: [], steps: [],
    effects: [
      {direction: 'cost', icon: 'heat', amount: 8, current: 8, resulting: 0},
      {direction: 'gain', icon: 'venus', amount: 2, current: 6, resulting: 8, unit: '%'},
    ],
  } as unknown as ActionPreviewBranch;
}

function trBranch(): ActionPreviewBranch {
  return {
    index: -1, title: '', available: true, renderKeys: [], steps: [],
    effects: [
      {direction: 'cost', icon: 'heat', amount: 8, current: 8, resulting: 0},
      {direction: 'gain', icon: 'tr', amount: 1, current: 20, resulting: 21},
    ],
  } as unknown as ActionPreviewBranch;
}

describe('scaleStepRatingPlan (pure) — the promise off the diff', () => {
  it('a Venus step the viewer made: one rating step, the Greens\' 2 M€ as the answer', () => {
    const plan = scaleStepRatingPlan(view({}, {venusScaleLevel: 6}), view({terraformRating: 21, megacredits: 22}, {venusScaleLevel: 8}));
    expect(plan).deep.eq({moves: [{accent: 'venus', key: 'venusScaleLevel', steps: 1, after: 8}], rating: 1, venusBonus: false, reaction: 2});
  });

  it('no answer when the M€ moved by anything but 2 per rating step (the Reds rule; the card paid M€ too)', () => {
    expect(scaleStepRatingPlan(view({}, {venusScaleLevel: 6}), view({terraformRating: 21}, {venusScaleLevel: 8}))?.reaction).is.undefined;
    expect(scaleStepRatingPlan(view({}, {venusScaleLevel: 6}), view({terraformRating: 21, megacredits: 25}, {venusScaleLevel: 8}))?.reaction).is.undefined;
  });

  it('14 → 16 %: the step AND the track bonus — two rating steps, the bonus named, the Greens\' 4', () => {
    const plan = scaleStepRatingPlan(view({}, {venusScaleLevel: 14}), view({terraformRating: 22, megacredits: 24}, {venusScaleLevel: 16}));
    expect(plan).deep.include({rating: 2, venusBonus: true, reaction: 4});
    expect(plan?.moves).deep.eq([{accent: 'venus', key: 'venusScaleLevel', steps: 1, after: 16}]);
  });

  it('temperature (2° a step) and oxygen (1 % a step) in one response: the steps add up, each scale a move', () => {
    const plan = scaleStepRatingPlan(view({}, {temperature: -30, oxygenLevel: 0}), view({terraformRating: 23, megacredits: 26}, {temperature: -26, oxygenLevel: 1}));
    expect(plan?.moves).deep.eq([
      {accent: 'temperature', key: 'temperature', steps: 2, after: -26},
      {accent: 'oxygen', key: 'oxygenLevel', steps: 1, after: 1},
    ]);
    expect(plan).deep.include({rating: 3, reaction: 6});
  });

  it('nothing to fly: an ocean (the tile\'s own beat), a direct TR beside the step, a rival\'s step, the Solar phase, two seats, a lowering', () => {
    expect(scaleStepRatingPlan(view({}, {oceans: 0}), view({terraformRating: 21}, {oceans: 1})), 'an ocean').is.undefined;
    expect(scaleStepRatingPlan(view({}, {venusScaleLevel: 6}), view({terraformRating: 22}, {venusScaleLevel: 8})), 'rating 2 for one step').is.undefined;
    expect(scaleStepRatingPlan(view({}, {venusScaleLevel: 6}), view({}, {venusScaleLevel: 8})), 'the viewer\'s rating did not move').is.undefined;
    expect(scaleStepRatingPlan(view({}, {venusScaleLevel: 6}), view({terraformRating: 21}, {venusScaleLevel: 8, phase: Phase.SOLAR})), 'the Solar phase').is.undefined;
    expect(scaleStepRatingPlan(view({}, {venusScaleLevel: 6}), view({terraformRating: 21}, {venusScaleLevel: 8}, 'p-red')), 'another seat').is.undefined;
    expect(scaleStepRatingPlan(view({}, {venusScaleLevel: 8}), view({terraformRating: 21}, {venusScaleLevel: 6})), 'a lowering').is.undefined;
    expect(scaleStepRatingPlan(undefined, view({terraformRating: 21}, {venusScaleLevel: 8})), 'a first view').is.undefined;
  });
});

describe('withoutScaleStepAnswers — the Greens\' TR answer is the scale-step beat\'s, never the chain\'s', () => {
  it('a scale step with no rating in the chain: the stock M€ answer is dropped, a production answer stays', () => {
    expect(withoutScaleStepAnswers(venusBranch(), {}, [], [mc(2), mcProd(1)])).deep.eq([mcProd(1)]);
  });

  it('a chain that flies its own rating keeps every answer; a branch with no scale step keeps every answer', () => {
    const rating: ResourceTransferSpec = {channel: 'stock', resource: RATING_RAIL_KEY, amount: 1};
    expect(withoutScaleStepAnswers(venusBranch(), {}, [rating], [mc(2)])).deep.eq([mc(2)]);
    expect(withoutScaleStepAnswers(trBranch(), {}, [], [mc(2)])).deep.eq([mc(2)]);
  });

  it('the action commit\'s rail plan: TR41\'s price chain carries the heat loss and NO M€ reaction', () => {
    const rail = commitRailPlan(CardName.PLASMA_FANS, venusBranch(), {}, [mc(2)])!;
    expect(rail.reward.cause.map((s) => `${s.channel}:${s.resource}${s.direction === 'loss' ? '-' : '+'}${s.amount}`)).deep.eq(['stock:heat-8']);
    expect(rail.reward.reactions).deep.eq([]);
  });

  it('the play\'s rail half: a scale play with no direct TR hands the M€ answer over and keeps a production answer', () => {
    const branch = venusBranch();
    expect(playRailReward(branch, branch.effects, {}, undefined, [mc(2)]), 'nothing left for the rail').is.undefined;
    const rail = playRailReward(branch, branch.effects, {}, undefined, [mc(2), mcProd(1)])!;
    expect(rail.cause).deep.eq([]);
    expect(rail.reactions).deep.eq([mcProd(1)]);
  });
});

describe('scaleStepRatingBeat — cause before consequence', () => {
  let watchable = true;

  beforeEach(() => {
    resetScaleStepRating();
    resetBoardBeatPark();
    resetScaleMarkerPoses();
    resetPresentationLedger();
    clearPanelRewardHold();
    watchable = true;
    registerBoardWatchableProbe(() => watchable);
    document.body.innerHTML = '';
  });

  afterEach(() => {
    resetScaleStepRating();
    resetBoardBeatPark();
    resetScaleMarkerPoses();
    resetPresentationLedger();
    clearPanelRewardHold();
    registerBoardWatchableProbe(undefined);
    document.body.innerHTML = '';
  });

  function mountMarker(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'scale-marker';
    el.dataset.scaleMarker = 'venus';
    el.getBoundingClientRect = () => ({left: 400, top: 200, width: 40, height: 40, right: 440, bottom: 240, x: 400, y: 200, toJSON: () => ({})}) as DOMRect;
    document.body.appendChild(el);
    return el;
  }

  it('the seed holds the rating (and the answer) on the panel and the beat waits; nothing is held twice; a reset releases', () => {
    mountMarker();
    watchable = false;
    noteScaleMarkerSettled('venus', 6);
    seedScaleStepRatingHold(view({}, {venusScaleLevel: 6}), view({terraformRating: 21, megacredits: 22}, {venusScaleLevel: 8}));
    expect(heldStock(RATING_RAIL_KEY), 'the rating is held').eq(1);
    expect(heldStock('megacredits'), 'the Greens\' answer is held').eq(2);
    expect(scaleStepRatingBusy()).is.true;
    expect(scaleStepRatingState.phase).eq('waiting');
    // A second seed while the rating is still held (another owner, or this one) holds nothing more.
    seedScaleStepRatingHold(view({}, {venusScaleLevel: 8}), view({terraformRating: 22, megacredits: 24}, {venusScaleLevel: 10}));
    expect(heldStock(RATING_RAIL_KEY)).eq(1);
    resetScaleStepRating();
    expect(heldStock(RATING_RAIL_KEY), 'a reset releases').eq(0);
    expect(heldStock('megacredits')).eq(0);
    expect(scaleStepRatingBusy()).is.false;
  });

  it('a diff that is not a scale step\'s rating seeds nothing', () => {
    mountMarker();
    seedScaleStepRatingHold(view({}, {oceans: 0}), view({terraformRating: 21}, {oceans: 1}));
    expect(heldStock(RATING_RAIL_KEY)).eq(0);
    expect(scaleStepRatingBusy()).is.false;
  });

  it('the stage: the board watchable, the park\'s value released and the marker ARRIVED — the beat stays waiting until all three', async () => {
    mountMarker();
    watchable = false;
    boardBeatParkState.heldParams = {temperature: -30, oxygenLevel: 0, oceans: 0, venusScaleLevel: 6};
    noteScaleMarkerMoving('venus', 8);
    seedScaleStepRatingHold(view({}, {venusScaleLevel: 6}), view({terraformRating: 21, megacredits: 22}, {venusScaleLevel: 8}));
    expect(scaleStepRatingState.phase).eq('waiting');
    watchable = true;
    scaleStepRatingState.nudge++;
    await Promise.resolve();
    expect(scaleStepRatingState.phase, 'the park still holds the value').eq('waiting');
    boardBeatParkState.heldParams = undefined;
    scaleStepRatingState.nudge++;
    await Promise.resolve();
    expect(scaleStepRatingState.phase, 'the marker has not arrived').eq('waiting');
    expect(heldStock(RATING_RAIL_KEY), 'still held').eq(1);
  });
});
