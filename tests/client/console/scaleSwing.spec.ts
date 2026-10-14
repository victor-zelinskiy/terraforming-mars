/*
 * «ОБРАТНЫЙ ХОД» (Turmoil Redux TR47 Ecological Experiment) — the director of
 * a PARAMETER SWING's scene, and the two shared pieces it stands on:
 *
 *  1. SEED — a fresh server record presents the scene's START on the board
 *     and the status strip (`boardBeatParkState.swingParams`) in the apply
 *     block; the raise's rating the scene flies itself is held on the panel
 *     (the mover's own view only, checked against the views); an echo frame
 *     claims nothing twice; a reset lets everything go.
 *  2. STAGE — the scene waits for a board the player can see and plays only
 *     once the park is done with its scales; the first raise moves the
 *     presented value on the scene's own clock.
 *  3. THE DISPLAY MERGE — the park's held values stand OVER the swing's (a
 *     raise the park still holds is the drain's story).
 *  4. PL-330 — the scale-step rating beat subtracts what THIS response's other
 *     owners hold (an ocean's TR) instead of falling silent; an older hold
 *     still stands as «never held twice».
 */
import {expect} from 'chai';
import {Phase} from '@/common/Phase';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParameterSwingModel} from '@/common/models/ParameterSwingModel';
import {
  resetScaleSwing, scaleSwingBusy, scaleSwingState, seedParameterSwings,
} from '@/client/console/scaleSwing/scaleSwingDirector';
import {
  boardBeatDisplayHeld, boardBeatDisplayParams, boardBeatParkState, registerBoardWatchableProbe, resetBoardBeatPark, setBoardSwingDisplay,
} from '@/client/console/boardBeatPark';
import {resetScaleStepRating, scaleStepRatingPlan, scaleStepRatingState, seedScaleStepRatingHold} from '@/client/console/scaleStepReward/scaleStepRatingBeat';
import {resetScaleMarkerPoses} from '@/client/components/board/scaleMarkerArrival';
import {beginPanelRewardHold, clearPanelRewardHold, heldStock} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {RATING_RAIL_KEY} from '@/client/console/resourceTransfer/resourceTransferModel';
import {resetPresentationLedger} from '@/client/console/presentationLedger';

type Seat = {terraformRating?: number, megacredits?: number, color?: string};
type Planet = {temperature?: number, oxygenLevel?: number, oceans?: number, parameterSwings?: Array<ParameterSwingModel>};

function view(seat: Seat, planet: Planet): PlayerViewModel {
  return {
    id: 'p-' + (seat.color ?? 'blue'),
    thisPlayer: {color: 'blue', terraformRating: 20, megacredits: 20, ...seat},
    game: {phase: Phase.ACTION, temperature: -12, oxygenLevel: 4, oceans: 3, venusScaleLevel: 0, scaleBonusClaims: {}, ...planet},
  } as unknown as PlayerViewModel;
}

/** The raise and the fall in ONE response (the oceans at their maximum — no removal is asked). */
const ONE_RESPONSE = {
  seq: 501, source: {card: 'Ecological Experiment'}, player: 'blue', rating: 22,
  up: [
    {parameter: 'temperature', before: -12, after: -10, tr: 1, claimed: []},
    {parameter: 'oxygen', before: 4, after: 5, tr: 1, claimed: []},
  ],
  down: [
    {parameter: 'oceans', atMax: true, at: 9},
    {parameter: 'temperature', before: -10, after: -12},
    {parameter: 'oxygen', before: 5, after: 4},
  ],
} as unknown as ParameterSwingModel;

/** The fall of a swing whose raise the PLAY already showed (the removal answered). */
const AFTER_REMOVAL = {
  seq: 502, source: {card: 'Ecological Experiment'}, player: 'blue', rating: 23,
  up: [
    {parameter: 'temperature', before: -12, after: -10, tr: 1, claimed: []},
    {parameter: 'oxygen', before: 4, after: 5, tr: 1, claimed: []},
    {parameter: 'oceans', before: 3, after: 4, tr: 1, claimed: []},
  ],
  down: [
    {parameter: 'oceans', before: 4, after: 3},
    {parameter: 'temperature', before: -10, after: -12},
    {parameter: 'oxygen', before: 5, after: 4},
  ],
  removed: {space: '07', tile: 1},
} as unknown as ParameterSwingModel;

async function flush(n = 4): Promise<void> {
  for (let i = 0; i < n; i++) {
    await Promise.resolve();
  }
}

describe('scaleSwingDirector — «ОБРАТНЫЙ ХОД»', () => {
  let watchable = false;

  beforeEach(() => {
    resetScaleSwing();
    resetScaleStepRating();
    resetBoardBeatPark();
    resetScaleMarkerPoses();
    resetPresentationLedger();
    clearPanelRewardHold();
    watchable = false;
    registerBoardWatchableProbe(() => watchable);
    document.body.innerHTML = '';
  });

  afterEach(() => {
    resetScaleSwing();
    resetScaleStepRating();
    resetBoardBeatPark();
    resetScaleMarkerPoses();
    resetPresentationLedger();
    clearPanelRewardHold();
    registerBoardWatchableProbe(undefined);
    document.body.innerHTML = '';
  });

  it('ONE RESPONSE: the start is presented from the seed, the raise\'s two ratings are held, an echo claims nothing, a reset lets go', () => {
    const before = view({}, {temperature: -12, oxygenLevel: 4, oceans: 9, parameterSwings: []});
    const after = view({terraformRating: 22}, {temperature: -12, oxygenLevel: 4, oceans: 9, parameterSwings: [ONE_RESPONSE]});
    seedParameterSwings(before, after);
    expect(boardBeatParkState.swingParams, 'what was seen, until each leg\'s turn').deep.eq({temperature: -12, oxygenLevel: 4});
    expect(heldStock(RATING_RAIL_KEY), 'the two raises\' rating — the scene flies it').eq(2);
    expect(scaleSwingBusy()).is.true;
    expect(scaleSwingState.phase, 'the board is covered — it waits').eq('waiting');
    seedParameterSwings(before, after);
    expect(heldStock(RATING_RAIL_KEY), 'an echo frame claims nothing twice').eq(2);
    resetScaleSwing();
    expect(boardBeatParkState.swingParams).is.undefined;
    expect(heldStock(RATING_RAIL_KEY), 'a reset releases the rating — the cell ticks').eq(0);
    expect(scaleSwingBusy()).is.false;
  });

  it('a RIVAL watches the same scene and holds no rating of the mover\'s; a first view (a reload) seeds nothing', () => {
    const rival = (planet: Planet) => ({...view({color: 'red'}, planet), thisPlayer: {color: 'red', terraformRating: 20, megacredits: 20}} as unknown as PlayerViewModel);
    seedParameterSwings(rival({oceans: 9, parameterSwings: []}), rival({oceans: 9, parameterSwings: [ONE_RESPONSE]}));
    expect(boardBeatParkState.swingParams).deep.eq({temperature: -12, oxygenLevel: 4});
    expect(heldStock(RATING_RAIL_KEY)).eq(0);
    resetScaleSwing();
    seedParameterSwings(undefined, view({}, {oceans: 9, parameterSwings: [ONE_RESPONSE]}));
    expect(scaleSwingBusy(), 'nothing replays').is.false;
  });

  it('AFTER THE REMOVAL: the fall alone — the display stands on the peak, no rating is held (the play showed the raise)', () => {
    seedParameterSwings(
      view({terraformRating: 23}, {temperature: -10, oxygenLevel: 5, oceans: 4, parameterSwings: []}),
      view({terraformRating: 23}, {temperature: -12, oxygenLevel: 4, oceans: 3, parameterSwings: [AFTER_REMOVAL]}));
    expect(boardBeatParkState.swingParams).deep.eq({oceans: 4, temperature: -10, oxygenLevel: 5});
    expect(heldStock(RATING_RAIL_KEY)).eq(0);
  });

  it('THE STAGE: waits for the board and for the park to let its scales go; then the first raise moves the presented value', async () => {
    boardBeatParkState.heldParams = {temperature: -12, oxygenLevel: 4, oceans: 9, venusScaleLevel: 0};
    seedParameterSwings(
      view({}, {oceans: 9, parameterSwings: []}),
      view({terraformRating: 22}, {oceans: 9, parameterSwings: [ONE_RESPONSE]}));
    watchable = true;
    scaleSwingState.nudge++;
    await flush();
    expect(scaleSwingState.phase, 'the park still holds these scales').eq('waiting');
    boardBeatParkState.heldParams = undefined;
    scaleSwingState.nudge++;
    await flush();
    expect(scaleSwingState.phase).eq('playing');
    expect(scaleSwingState.leg).eq('up:temperature');
    expect(boardBeatParkState.swingParams?.temperature, 'the raise is presented — the marker glides').eq(-10);
    expect(boardBeatParkState.swingParams?.oxygenLevel, 'the next raise waits its turn').eq(4);
  });
});

describe('the board-beat display merge — the park over the swing', () => {
  afterEach(() => resetBoardBeatPark());

  it('a held value stands over the swing\'s; the swing\'s over the live one; the ONE gate reads both', () => {
    const live = {temperature: -12, oxygenLevel: 4, oceans: 3, venusScaleLevel: 0};
    expect(boardBeatDisplayHeld()).is.false;
    setBoardSwingDisplay({temperature: -10});
    expect(boardBeatDisplayHeld()).is.true;
    expect(boardBeatDisplayParams(live).temperature).eq(-10);
    boardBeatParkState.heldParams = {temperature: -14};
    expect(boardBeatDisplayParams(live).temperature, 'the drain\'s story first').eq(-14);
    boardBeatParkState.heldParams = undefined;
    setBoardSwingDisplay(undefined);
    expect(boardBeatDisplayParams(live)).deep.eq(live);
    expect(boardBeatDisplayHeld()).is.false;
  });
});

describe('PL-330 — the scales\' steps fly beside an ocean\'s TR', () => {
  beforeEach(() => {
    resetScaleStepRating();
    resetBoardBeatPark();
    clearPanelRewardHold();
    registerBoardWatchableProbe(() => false);
  });
  afterEach(() => {
    resetScaleStepRating();
    resetBoardBeatPark();
    clearPanelRewardHold();
    registerBoardWatchableProbe(undefined);
  });

  const before = view({}, {temperature: -12, oxygenLevel: 4, oceans: 3});
  const after = view({terraformRating: 23, megacredits: 2}, {temperature: -10, oxygenLevel: 5, oceans: 4});

  it('the plan subtracts what another owner of the response holds: +3 with the ocean\'s 1 held is the scales\' 2 (and no guessed answer)', () => {
    expect(scaleStepRatingPlan(before, after), 'alone, +3 for two steps reads as nobody\'s').is.undefined;
    const plan = scaleStepRatingPlan(before, after, 1);
    expect(plan?.rating).eq(2);
    expect(plan?.moves.map((m) => m.accent)).deep.eq(['temperature', 'oxygen']);
    expect(plan?.reaction).is.undefined;
  });

  it('the seed holds the scales\' 2 beside the ocean\'s 1 held in the same block; an OLDER hold still means «never twice»', () => {
    beginPanelRewardHold([{channel: 'stock', resource: RATING_RAIL_KEY, amount: 1}]);
    seedScaleStepRatingHold(before, after, 1);
    expect(heldStock(RATING_RAIL_KEY), 'the ocean\'s 1 + the scales\' 2').eq(3);
    expect(scaleStepRatingState.phase).eq('waiting');
    resetScaleStepRating();
    clearPanelRewardHold();
    beginPanelRewardHold([{channel: 'stock', resource: RATING_RAIL_KEY, amount: 1}]);
    seedScaleStepRatingHold(before, after, 0);
    expect(heldStock(RATING_RAIL_KEY), 'an older hold stands — nothing more').eq(1);
  });
});
