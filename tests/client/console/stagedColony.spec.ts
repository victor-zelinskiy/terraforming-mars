import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {StagedColonyModel, ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {SelectColonyModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {
  armStagedPlay, clearStagedPlay, stagedColonyOf, stagedHostedTarget, stagedPlacementOf, stagedVoteOf, StagedPlayArm,
} from '@/client/console/stagedPlay';
import {playCommitVerb, playDoorNextStepKey, playDoorOf} from '@/client/console/consolePlayCardComposer';
import {colonyPickIntent} from '@/client/console/consoleColoniesModel';
import {
  clearColonyTrackMove, colonyTrackMoveFlow, promiseColonyTrackMove, registerColonyTrackMoveHost, seedColonyTrackMoveHolds,
} from '@/client/console/colonyTrade/colonyTrackMove';
import {
  colonyTrackWaveState, finishColonyTrackWave, heldColonyTrackPosition, noteColonyTrackWaveTouched, releaseColonyTracks,
  requestColonyTrackWave,
} from '@/client/console/colonyTrade/consoleColonyTrade';
import {
  TRACK_RAIL_BREATH_MS, TRACK_RAIL_READ_MS, TRACK_WAVE_PAUSE_MS, TRACK_WAVE_READ_MS, trackWavePlan,
} from '@/client/console/colonyTrade/colonyTradeModel';

/**
 * THE STAGED COLONY — the staged store's FOURTH target (Turmoil Redux TR07
 * Colony Sponsors: a card that moves a chosen tile's track by being PLAYED).
 *
 * «Выбрать колонию» sends nothing: the batch parks in the ONE store with a
 * colony target, the grid and the stage read the play preview's staged prompt,
 * and the stage's A posts the one batch. After the answer the chosen tile's
 * marker is HELD on its old cell (seeded from the views' diff, only while the
 * stage stands) and moved by the ONE track mechanism in the rail rhythm.
 */
const PROMPT = {
  type: 'colony', title: 'Select a colony track to move to its highest position', buttonLabel: 'Select',
  coloniesModel: [{name: ColonyName.LUNA}, {name: ColonyName.EUROPA}],
  disabledColonies: [{name: ColonyName.CERES, reason: 'The colony marker is already at its highest position'}],
  trackMoves: [{colony: ColonyName.LUNA, before: 2, after: 6}, {colony: ColonyName.EUROPA, before: 1, after: 6}],
  choiceContext: {source: {kind: 'card', card: CardName.COLONY_SPONSORS}, mode: 'effect-choice'},
} as unknown as SelectColonyModel;

const STAGED: StagedColonyModel = {prompt: PROMPT, sourceCard: CardName.COLONY_SPONSORS};

function arm(target: StagedPlayArm['target']): StagedPlayArm {
  return {flow: 'play', cardName: CardName.COLONY_SPONSORS, isEvent: false, batch: [{type: 'projectCard'}], target, draws: 0, deckCheck: false, yieldedStack: false, receipt: {amount: 5, icon: 'megacredits'}};
}

function branch(steps: ActionPreviewBranch['steps']): ActionPreviewBranch {
  return {index: -1, title: '', available: true, renderKeys: [], effects: [], steps} as unknown as ActionPreviewBranch;
}

/** A view where Luna's marker stands at `luna`. */
function view(luna: number): PlayerViewModel {
  return {game: {colonies: [{name: ColonyName.LUNA, trackPosition: luna}, {name: ColonyName.EUROPA, trackPosition: 1}]}} as unknown as PlayerViewModel;
}

describe('stagedPlay — the fourth target: a COLONY', () => {
  afterEach(() => {
    clearStagedPlay();
    clearColonyTrackMove();
    registerColonyTrackMoveHost(undefined);
    finishColonyTrackWave('spec');
    releaseColonyTracks();
  });

  it('ONE store, exactly one target: a staged colony is neither a cell nor a vote, and it is a HOSTED step', () => {
    armStagedPlay(arm({kind: 'colony', pick: STAGED}));
    expect(stagedColonyOf()).deep.eq(STAGED);
    expect(stagedPlacementOf()).is.undefined;
    expect(stagedVoteOf()).is.undefined;
    expect(stagedHostedTarget()).is.true;
    clearStagedPlay();
    expect(stagedColonyOf()).is.undefined;
    expect(stagedHostedTarget()).is.false;
  });

  it('the composer\'s door: «Выбрать колонию», its next-step row, and the staged prompt carried whole', () => {
    const door = playDoorOf(branch([{kind: 'colonyPick', staged: STAGED}]));
    expect(door).deep.eq({kind: 'colonies', staged: STAGED});
    expect(playCommitVerb(door)).eq('Choose the colony');
    expect(playDoorNextStepKey(door)).eq('Colony track — chosen in the Colonies');
  });

  it('no tile to move: the branch carries the named warning and NO door — the CTA is the ordinary play', () => {
    const door = playDoorOf(branch([{kind: 'note', noteKind: 'warning', text: 'Every colony track is at its highest position', skipped: {label: 'Colony track'}}]));
    expect(door).is.undefined;
    expect(playCommitVerb(door)).eq('Play card');
  });

  it('the act of a pick: a track-moving pick is `track`, a build `build`, anything else `pick`', () => {
    expect(colonyPickIntent({buttonLabel: 'Select', trackMoves: []})).eq('track');
    expect(colonyPickIntent({buttonLabel: 'Build'})).eq('build');
    expect(colonyPickIntent({buttonLabel: 'Select'})).eq('pick');
  });

  describe('the move — promised at A, seeded from the diff in the apply block, played on the stage', () => {
    it('the answer moved the promised tile and the stage stands: HELD on its old cell, the move OWED', () => {
      registerColonyTrackMoveHost((colony) => colony === ColonyName.LUNA);
      promiseColonyTrackMove({colony: ColonyName.LUNA, card: CardName.COLONY_SPONSORS, before: 2, after: 6});
      seedColonyTrackMoveHolds(view(2), view(6));
      expect(heldColonyTrackPosition(ColonyName.LUNA), 'the marker stays on 3 until the glide moves it').eq(2);
      expect(colonyTrackMoveFlow.owed).deep.eq({colony: ColonyName.LUNA, before: 2, after: 6});
      expect(colonyTrackMoveFlow.promised).is.undefined;
    });

    it('nobody stands to play it: NO hold (a hold nobody releases freezes the track) — the server position shows', () => {
      registerColonyTrackMoveHost(() => false);
      promiseColonyTrackMove({colony: ColonyName.LUNA, card: CardName.COLONY_SPONSORS, before: 2, after: 6});
      seedColonyTrackMoveHolds(view(2), view(6));
      expect(heldColonyTrackPosition(ColonyName.LUNA)).is.undefined;
      expect(colonyTrackMoveFlow.owed).is.undefined;
    });

    it('an answer that did not move the tile (a PARKED tail) keeps the promise and holds nothing', () => {
      registerColonyTrackMoveHost(() => true);
      promiseColonyTrackMove({colony: ColonyName.LUNA, card: CardName.COLONY_SPONSORS, before: 2, after: 6});
      seedColonyTrackMoveHolds(view(2), view(2));
      expect(colonyTrackMoveFlow.promised).is.not.undefined;
      expect(heldColonyTrackPosition(ColonyName.LUNA)).is.undefined;
    });

    it('a view nobody promised anything for seeds nothing', () => {
      registerColonyTrackMoveHost(() => true);
      seedColonyTrackMoveHolds(view(2), view(6));
      expect(heldColonyTrackPosition(ColonyName.LUNA)).is.undefined;
      expect(colonyTrackMoveFlow.owed).is.undefined;
    });

    it('the flow that promised it ends: its hold is released, nothing is owed', () => {
      registerColonyTrackMoveHost(() => true);
      promiseColonyTrackMove({colony: ColonyName.LUNA, before: 2, after: 6});
      seedColonyTrackMoveHolds(view(2), view(6));
      clearColonyTrackMove();
      expect(heldColonyTrackPosition(ColonyName.LUNA)).is.undefined;
      expect(colonyTrackMoveFlow.owed).is.undefined;
    });

    it('the ONE mechanism: the move plays on the STAGE (anchors), in the RAIL rhythm; the touch is recorded per tile', () => {
      void requestColonyTrackWave([{colony: ColonyName.LUNA, before: 2, after: 6}], {anchors: 'stage', rhythm: 'rail', reduced: false});
      expect(colonyTrackWaveState.active).is.true;
      expect(colonyTrackWaveState.anchors).eq('stage');
      expect(colonyTrackWaveState.rhythm).eq('rail');
      noteColonyTrackWaveTouched(ColonyName.LUNA, 4);
      expect(colonyTrackWaveState.touched[ColonyName.LUNA]).eq(4);
      finishColonyTrackWave('spec');
      expect(colonyTrackWaveState.touched).deep.eq({});
    });

    it('a law\'s wave (RX29) keeps its own anchors — the tiles, never a stage', () => {
      void requestColonyTrackWave([{colony: ColonyName.LUNA, before: 2, after: 4}], {reduced: false});
      expect(colonyTrackWaveState.anchors).eq('tile');
      expect(colonyTrackWaveState.rhythm).eq('wave');
    });
  });

  describe('the rail rhythm (pure plan)', () => {
    it('one move: a short breath, the trade\'s even beat, no rests, the stage\'s read', () => {
      const plan = trackWavePlan([{colony: ColonyName.LUNA, before: 2, after: 6}], {reduced: false, rhythm: 'rail'});
      expect(plan.legs).has.lengthOf(1);
      const leg = plan.legs[0];
      expect(leg.path).deep.eq([3, 4, 5, 6]);
      expect(leg.startAtMs).eq(TRACK_RAIL_BREATH_MS);
      expect(leg.pauseMs, 'one move, never steps with rests').eq(0);
      expect(leg.perCellMs).within(95, 170);
      expect(plan.readMs).eq(TRACK_RAIL_READ_MS);
    });

    it('the wave keeps its own numbers (RX29 unchanged)', () => {
      const plan = trackWavePlan([{colony: ColonyName.LUNA, before: 2, after: 4}], {reduced: false});
      expect(plan.legs[0].pauseMs).eq(TRACK_WAVE_PAUSE_MS);
      expect(plan.readMs).eq(TRACK_WAVE_READ_MS);
    });
  });
});
