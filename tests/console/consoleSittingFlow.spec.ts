import {expect} from 'chai';
import {Color} from '../../src/common/Color';
import {Phase} from '../../src/common/Phase';
import {ParliamentModel, ParliamentPhaseModel} from '../../src/common/models/ParliamentModel';
import {PlayerInputModel} from '../../src/common/models/PlayerInputModel';
import {PlayerViewModel} from '../../src/common/models/PlayerModel';
import {
  parliamentSittingFlowBeat, parliamentSittingLive, SITTING_SUBJECT_KEY, sittingAskOf, sittingAtLastPage, sittingPagesOf, sittingPositionOf,
  sittingPrimaryKey, sittingRewardComing, sittingStageAt, sittingStageKey, sittingStartPage, sittingWorkspacePhase,
} from '../../src/client/console/parliament/consoleSittingFlow';
import {backVerbFor} from '../../src/client/console/consoleWorkspaceFlow';

/*
 * THE SITTING FLOW — pure (docs/TURMOIL_REDUX_PARLIAMENT_SITTING.md § Э3):
 * the server's step → the pages the viewer walks → the crumb's tail → B's
 * verb → the ONE flow beat per generation. No DOM, no Vue: the server runner.
 */
const BLUE = 'blue' as Color;
const RED = 'red' as Color;

function phase(over: Partial<ParliamentPhaseModel>): ParliamentPhaseModel {
  return {generation: 3, final: false, step: 'assembly', ...over};
}

function model(p: ParliamentPhaseModel | undefined, participants: ReadonlyArray<Color> = [BLUE, RED]): ParliamentModel {
  return {
    slots: [], rulingParty: 'greens', popularSupport: {}, deckSize: 0, discardSize: 0, neutralSupply: 0, botMode: 'none',
    players: participants.map((color) => ({
      color, participates: true, lobby: true, reserve: 5, onResolutions: 0, chairman: false, agenda: 0, influence: 1,
      access: [], partyActionUses: {}, resolutionActionUses: 0,
    })),
    phase: p,
  } as unknown as ParliamentModel;
}

const gate = (stage: 'assembly' | 'adjourn', awaiting: ReadonlyArray<Color> = [BLUE, RED]): PlayerInputModel =>
  ({type: 'option', title: 'gate', buttonLabel: 'Continue', parliamentPhasePrompt: {stage, generation: 3, final: false, seq: 1, awaiting}} as unknown as PlayerInputModel);
const pick = (): PlayerInputModel =>
  ({type: 'card', title: 'pick', buttonLabel: 'Select', cards: [], choiceContext: {source: {kind: 'resolution', resolution: 'RDX_X'}}} as unknown as PlayerInputModel);
const take = (): PlayerInputModel =>
  ({type: 'card', title: 'take', buttonLabel: 'Take', cards: [], choiceContext: {source: {kind: 'resolution', resolution: 'RDX_X'}},
    externalDrawPrompt: {intakeId: 1, count: 2, remaining: 2, cause: {kind: 'resolution', resolution: 'RDX_X'}}} as unknown as PlayerInputModel);
const tile = (): PlayerInputModel =>
  ({type: 'space', title: 'ocean', buttonLabel: 'Select', spaces: [], placementContext: {source: {kind: 'resolution', resolution: 'RDX_X'}}} as unknown as PlayerInputModel);

describe('consoleSittingFlow — the political phase as ONE flow', () => {
  describe('the pages of a server step', () => {
    it('the ASSEMBLY reads the verdict, the enactment and the reward before its gate', () => {
      expect(sittingPagesOf('assembly', false)).deep.eq(['verdict', 'enact', 'reward']);
      // …and every step before the gate (the driver never parks there) reads the same.
      for (const step of ['winner', 'agenda', 'support', 'enact'] as const) {
        expect(sittingPagesOf(step, false), step).deep.eq(['verdict', 'enact', 'reward']);
      }
    });
    it('the EFFECTS are the reward; the ADJOURN reads the renewal and closes — the FINAL phase closes at once', () => {
      expect(sittingPagesOf('effects', false)).deep.eq(['reward']);
      expect(sittingPagesOf('refresh', false)).deep.eq(['renewal']);
      expect(sittingPagesOf('lobby', false)).deep.eq(['renewal']);
      expect(sittingPagesOf('adjourn', false)).deep.eq(['renewal', 'closing']);
      expect(sittingPagesOf('adjourn', true)).deep.eq(['closing']);
      expect(sittingPagesOf('done', false)).deep.eq(['closing']);
    });
    it('a walk starts on its first page — on the wait pose once the seat has answered the step\'s gate (a reload re-asks nothing answered)', () => {
      expect(sittingStartPage(sittingPositionOf(model(phase({step: 'assembly'})), gate('assembly'), BLUE)!)).eq(0);
      expect(sittingStartPage(sittingPositionOf(model(phase({step: 'assembly', awaiting: [RED]})), undefined, BLUE)!)).eq(2);
      expect(sittingStartPage(sittingPositionOf(model(phase({step: 'effects'})), undefined, BLUE)!)).eq(0);
      expect(sittingStartPage(sittingPositionOf(model(phase({step: 'adjourn'})), gate('adjourn'), BLUE)!)).eq(0);
      expect(sittingStartPage(sittingPositionOf(model(phase({step: 'adjourn', awaiting: [RED]})), undefined, BLUE)!)).eq(1);
    });
    it('the cursor is clamped — a shorter step never reads past its end', () => {
      const p = sittingPositionOf(model(phase({step: 'effects'})), undefined, BLUE)!;
      expect(sittingStageAt(p, 5)).eq('reward');
      expect(sittingAtLastPage(p, 0)).is.true;
      const a = sittingPositionOf(model(phase({step: 'assembly'})), gate('assembly'), BLUE)!;
      expect(sittingStageAt(a, 0)).eq('verdict');
      expect(sittingStageAt(a, 1)).eq('enact');
      expect(sittingAtLastPage(a, 1)).is.false;
      expect(sittingAtLastPage(a, 2)).is.true;
    });
  });

  describe('sittingPositionOf — where the sitting stands, read off the server', () => {
    it('is undefined outside a live phase, for a seat outside the parliament and for no viewer', () => {
      expect(sittingPositionOf(model(undefined), undefined, BLUE)).is.undefined;
      expect(sittingPositionOf(model(phase({})), undefined, 'green' as Color)).is.undefined;
      expect(sittingPositionOf(model(phase({})), undefined, undefined)).is.undefined;
      expect(sittingPositionOf(undefined, undefined, BLUE)).is.undefined;
    });
    it('the assembly gate STANDING: the reward page reads what is coming; ANSWERED: the wait pose names who is awaited', () => {
      const standing = sittingPositionOf(model(phase({step: 'assembly', awaiting: [BLUE, RED]})), gate('assembly'), BLUE)!;
      expect(standing.gate).eq('assembly');
      expect(standing.gateStanding).is.true;
      expect(standing.rewardStep).eq('reading');
      const answered = sittingPositionOf(model(phase({step: 'assembly', awaiting: [RED]})), undefined, BLUE)!;
      expect(answered.gateStanding).is.false;
      expect(answered.rewardStep).eq('gate');
      expect(answered.awaiting).deep.eq([RED]);
    });
    it('the effects: the viewer\'s OWN ask by its structural marker — a pick, a take, a tile; never a title', () => {
      expect(sittingAskOf(pick())).eq('choice');
      expect(sittingAskOf(take())).eq('intake');
      expect(sittingAskOf(tile())).eq('placement');
      expect(sittingAskOf({type: 'card', title: 'Select a card to keep', buttonLabel: 'Keep', cards: []} as unknown as PlayerInputModel), 'no resolution source').is.undefined;
      expect(sittingAskOf(undefined)).is.undefined;
      const p = sittingPositionOf(model(phase({step: 'effects', pending: {player: BLUE, key: 'k', input: 'card'}})), pick(), BLUE)!;
      expect(p.rewardStep).eq('choice');
      expect(p.waitingFor).is.undefined;
    });
    it('the effects asking ANOTHER seat: the honest wait names who and what kind of answer', () => {
      const p = sittingPositionOf(model(phase({step: 'effects', pending: {player: RED, key: 'k', input: 'space'}})), undefined, BLUE)!;
      expect(p.rewardStep).eq('waiting');
      expect(p.waitingFor).deep.eq({player: RED, input: 'space'});
    });
    it('the effects with the viewer\'s record in: the reward is RECEIVED (a skip included — the plate names it)', () => {
      const paid = sittingPositionOf(model(phase({step: 'effects', outcomes: [{player: BLUE, step: 'grant', kind: 'stock', amount: 2}]})), undefined, BLUE)!;
      expect(paid.rewardStep).eq('received');
      const skipped = sittingPositionOf(model(phase({step: 'effects', outcomes: [{player: BLUE, step: 'grant', kind: 'skipped', reason: 'No influence'}]})), undefined, BLUE)!;
      expect(skipped.rewardStep).eq('received');
    });
    it('the adjourn gate: the renewal then the closing; answered → the closing\'s wait pose', () => {
      const standing = sittingPositionOf(model(phase({step: 'adjourn', awaiting: [BLUE]})), gate('adjourn', [BLUE]), BLUE)!;
      expect(standing.pages).deep.eq(['renewal', 'closing']);
      expect(standing.gateStanding).is.true;
      const answered = sittingPositionOf(model(phase({step: 'adjourn', awaiting: [RED]})), undefined, BLUE)!;
      expect(answered.rewardStep).eq('gate');
      expect(answered.awaiting).deep.eq([RED]);
    });
    it('a gate prompt of the OTHER stage does not count as this step\'s (the marker\'s stage is compared, never assumed)', () => {
      const p = sittingPositionOf(model(phase({step: 'adjourn'})), gate('assembly'), BLUE)!;
      expect(p.gateStanding).is.false;
    });
  });

  describe('the crumb, the phase and the verbs', () => {
    it('one key per stage; the reward names the hosted step; «ЗАСЕДАНИЕ» is the subject', () => {
      expect(SITTING_SUBJECT_KEY).eq('Sitting');
      expect(sittingStageKey('verdict', 'reading')).eq('Verdict');
      expect(sittingStageKey('enact', 'reading')).eq('Enactment');
      expect(sittingStageKey('reward', 'reading')).eq('Reward');
      expect(sittingStageKey('reward', 'received')).eq('Reward');
      expect(sittingStageKey('reward', 'gate')).eq('Reward');
      expect(sittingStageKey('reward', 'choice')).eq('Choice');
      expect(sittingStageKey('reward', 'intake')).eq('Intake');
      expect(sittingStageKey('reward', 'placement')).eq('Placement');
      expect(sittingStageKey('renewal', 'gate')).eq('Renewal');
      expect(sittingStageKey('closing', 'gate')).eq('Closing');
    });
    it('every stage up to the closing is COMMITTED (B = collapse); the closing is a terminal VERDICT (B = none); a submit is EXECUTING', () => {
      for (const stage of ['verdict', 'enact', 'reward', 'renewal'] as const) {
        expect(sittingWorkspacePhase(stage, false), stage).eq('committed');
        expect(backVerbFor(sittingWorkspacePhase(stage, false)), stage).eq('collapse');
      }
      expect(sittingWorkspacePhase('closing', false)).eq('verdict');
      expect(backVerbFor(sittingWorkspacePhase('closing', false))).eq('none');
      expect(sittingWorkspacePhase('reward', true)).eq('executing');
      expect(backVerbFor(sittingWorkspacePhase('reward', true))).eq('none');
    });
    it('A turns the page; on the assembly\'s last page it answers the gate — «К награде» when something is coming, else «Продолжить»', () => {
      const p = sittingPositionOf(model(phase({step: 'assembly'})), gate('assembly'), BLUE)!;
      expect(sittingPrimaryKey(p, 0, {rewardComing: true})).eq('Continue');
      expect(sittingPrimaryKey(p, 1, {rewardComing: true})).eq('Continue');
      expect(sittingPrimaryKey(p, 2, {rewardComing: true})).eq('To the reward');
      expect(sittingPrimaryKey(p, 2, {rewardComing: false})).eq('Continue');
    });
    it('on the adjourn\'s last page it CLOSES the sitting; an answered gate and a wait have no A', () => {
      const p = sittingPositionOf(model(phase({step: 'adjourn'})), gate('adjourn'), BLUE)!;
      expect(sittingPrimaryKey(p, 0, {rewardComing: false})).eq('Continue');
      expect(sittingPrimaryKey(p, 1, {rewardComing: false})).eq('Close the sitting');
      const answered = sittingPositionOf(model(phase({step: 'adjourn', awaiting: [RED]})), undefined, BLUE)!;
      expect(sittingPrimaryKey(answered, 1, {rewardComing: false})).is.undefined;
      const waiting = sittingPositionOf(model(phase({step: 'effects', pending: {player: RED, key: 'k'}})), undefined, BLUE)!;
      expect(sittingPrimaryKey(waiting, 0, {rewardComing: false})).is.undefined;
    });
    it('«something is coming» reads the declaration and the recorded winner — never a payout recomputed here', () => {
      const m = model(phase({step: 'assembly', summary: {winner: {player: BLUE}} as never}));
      expect(sittingRewardComing(m, BLUE, {scaled: [{}]})).is.true;
      expect(sittingRewardComing(m, BLUE, {winnerReward: {}})).is.true;
      expect(sittingRewardComing(m, RED, {winnerReward: {}}), 'the tile is the winner\'s').is.false;
      expect(sittingRewardComing(m, BLUE, {})).is.false;
      expect(sittingRewardComing(m, BLUE, undefined)).is.false;
    });
  });

  describe('the ONE flow beat per generation', () => {
    const view = (p: ParliamentPhaseModel | undefined, wf: PlayerInputModel | undefined, gamePhase: Phase = Phase.PARLIAMENT): PlayerViewModel =>
      ({game: {phase: gamePhase, parliament: model(p)}, waitingFor: wf, thisPlayer: {color: BLUE}} as unknown as PlayerViewModel);
    it('keys on the generation and stays the SAME through gate 1, the resolution\'s asks and gate 2', () => {
      const keys = [
        parliamentSittingFlowBeat(view(phase({step: 'assembly'}), gate('assembly'))),
        parliamentSittingFlowBeat(view(phase({step: 'effects'}), pick())),
        parliamentSittingFlowBeat(view(phase({step: 'effects'}), take())),
        parliamentSittingFlowBeat(view(phase({step: 'effects'}), tile())),
        parliamentSittingFlowBeat(view(phase({step: 'effects'}), undefined)),
        parliamentSittingFlowBeat(view(phase({step: 'adjourn'}), gate('adjourn'))),
      ].map((b) => b?.key);
      expect(keys).deep.eq(new Array(6).fill('parliament:gen3'));
      expect(parliamentSittingFlowBeat(view(phase({step: 'assembly'}), gate('assembly')))).deep.eq({key: 'parliament:gen3', taskKind: 'parliamentPhase', flow: 'parliament-phase'});
    });
    it('is gone with the phase — and never exists outside the political game phase or for a non-participant', () => {
      expect(parliamentSittingFlowBeat(view(undefined, undefined))).is.undefined;
      expect(parliamentSittingFlowBeat(view(phase({step: 'done'}), undefined))).is.undefined;
      expect(parliamentSittingFlowBeat(view(phase({step: 'assembly'}), gate('assembly'), Phase.ACTION))).is.undefined;
      expect(parliamentSittingLive(view(phase({step: 'effects'}), undefined))).is.true;
      expect(parliamentSittingLive(view(undefined, undefined))).is.false;
    });
  });
});
