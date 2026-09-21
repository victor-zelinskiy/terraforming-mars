import {expect} from 'chai';
import {Color} from '../../src/common/Color';
import {Phase} from '../../src/common/Phase';
import {ParliamentModel, ParliamentPhaseModel} from '../../src/common/models/ParliamentModel';
import {PlayerInputModel} from '../../src/common/models/PlayerInputModel';
import {PlayerViewModel} from '../../src/common/models/PlayerModel';
import {
  parliamentSittingFlowBeat, parliamentSittingLive, quietRewardPoseOf, SITTING_SUBJECT_KEY, sittingAskOf, sittingAtLastPage, sittingPageAuto,
  sittingBodyOf, sittingPagesOf, sittingPositionOf, sittingPrimaryKey, sittingRewardSettled, sittingStageAt, sittingStageKey, sittingStartPage,
  sittingWorkspacePhase, verdictStandsAt,
} from '../../src/client/console/parliament/consoleSittingFlow';
import {backVerbFor} from '../../src/client/console/consoleWorkspaceFlow';
import {AQUIFER_CONTEST_ID} from '../../src/server/parliament/resolutions/greens/AquiferContest';
import {
  DEV_ACTION_RESOLUTION_ID, DEV_COMPOUND_RESOLUTION_ID, DEV_IMMEDIATE_RESOLUTION_ID, DEV_PASSIVE_RESOLUTION_ID, REDUX_RESOLUTION_CATALOG,
} from '../../src/server/parliament/resolutions/ResolutionCatalog';

/*
 * THE SITTING FLOW — pure (docs/TURMOIL_REDUX_PARLIAMENT_SITTING_V2.md): the
 * server's step → the pages the viewer walks (and which the director turns by
 * itself) → the crumb's tail → B's verb → the A verb → the ONE flow beat per
 * generation. No DOM, no Vue: the server runner.
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

describe('consoleSittingFlow — the political phase as ONE flow (v2)', () => {
  describe('the pages of a server step', () => {
    it('the ASSEMBLY gate (before anything changes) is the VERDICT alone', () => {
      expect(sittingPagesOf('assembly', false)).deep.eq(['verdict']);
      expect(sittingPagesOf('winner', false)).deep.eq(['verdict']);
      expect(verdictStandsAt('assembly')).is.true;
      expect(verdictStandsAt('effects')).is.false;
    });
    it('the chain after the barrier is ONE page of beats; the EFFECTS read it and the reward; the ADJOURN (and the final phase) adds the RESULTS', () => {
      for (const step of ['agenda', 'support', 'enact'] as const) {
        expect(sittingPagesOf(step, false), step).deep.eq(['enact']);
      }
      expect(sittingPagesOf('effects', false)).deep.eq(['enact', 'reward']);
      expect(sittingPagesOf('refresh', false)).deep.eq(['enact', 'reward', 'results']);
      expect(sittingPagesOf('lobby', false)).deep.eq(['enact', 'reward', 'results']);
      expect(sittingPagesOf('adjourn', false)).deep.eq(['enact', 'reward', 'results']);
      expect(sittingPagesOf('adjourn', true), 'the final phase closes on the same results page').deep.eq(['enact', 'reward', 'results']);
      expect(sittingPagesOf('done', false)).deep.eq(['enact', 'reward', 'results']);
    });
    it('the enactment and the reward are turned by the DIRECTOR; the verdict and the results are STOPS (A answers a gate)', () => {
      expect(sittingPageAuto('enact')).is.true;
      expect(sittingPageAuto('reward')).is.true;
      expect(sittingPageAuto('verdict')).is.false;
      expect(sittingPageAuto('results')).is.false;
    });
    it('a walk starts on the first page NOT yet played this session; on the wait pose once the seat has answered the step\'s gate; on the last page when everything played', () => {
      const played = (...stages: Array<string>) => (stage: string) => stages.includes(stage);
      expect(sittingStartPage(sittingPositionOf(model(phase({step: 'assembly'})), gate('assembly'), BLUE)!)).eq(0);
      expect(sittingStartPage(sittingPositionOf(model(phase({step: 'assembly', awaiting: [RED]})), undefined, BLUE)!), 'answered: the wait pose').eq(0);
      const effects = sittingPositionOf(model(phase({step: 'effects'})), undefined, BLUE)!;
      expect(sittingStartPage(effects), 'nothing played: the enactment first').eq(0);
      expect(sittingStartPage(effects, played('enact')), 'the enactment played: the reward').eq(1);
      expect(sittingStartPage(effects, played('enact', 'reward')), 'everything played: the last page').eq(1);
      const adjourn = sittingPositionOf(model(phase({step: 'adjourn'})), gate('adjourn'), BLUE)!;
      expect(sittingStartPage(adjourn, played('enact', 'reward')), 'the results after a played enactment and reward').eq(2);
      expect(sittingStartPage(adjourn), 'a step that arrives with everything unplayed walks from the enactment').eq(0);
      expect(sittingStartPage(sittingPositionOf(model(phase({step: 'adjourn', awaiting: [RED]})), undefined, BLUE)!), 'gate 2 answered: the results\' wait pose').eq(2);
      // The tile's RECEIPT (the frame is back from the board): the reward page is read first, though it played.
      expect(sittingStartPage(adjourn, played('enact', 'reward'), true), 'a receipt owed: back on the reward page').eq(1);
      expect(sittingStartPage(sittingPositionOf(model(phase({step: 'adjourn', awaiting: [RED]})), undefined, BLUE)!, played('enact', 'reward'), true), 'gate 2 answered: the receipt yields to the wait pose').eq(2);
      expect(sittingStartPage(sittingPositionOf(model(phase({step: 'assembly'})), gate('assembly'), BLUE)!, () => false, true), 'a step with no reward page ignores the receipt').eq(0);
    });
    it('the cursor is clamped — a shorter step never reads past its end', () => {
      const p = sittingPositionOf(model(phase({step: 'effects'})), undefined, BLUE)!;
      expect(sittingStageAt(p, 5)).eq('reward');
      expect(sittingAtLastPage(p, 1)).is.true;
      const a = sittingPositionOf(model(phase({step: 'assembly'})), gate('assembly'), BLUE)!;
      expect(sittingStageAt(a, 0)).eq('verdict');
      expect(sittingStageAt(a, 3)).eq('verdict');
      expect(sittingAtLastPage(a, 0)).is.true;
    });
  });

  describe('sittingPositionOf — where the sitting stands, read off the server', () => {
    it('is undefined outside a live phase, for a seat outside the parliament and for no viewer', () => {
      expect(sittingPositionOf(model(undefined), undefined, BLUE)).is.undefined;
      expect(sittingPositionOf(model(phase({})), undefined, 'green' as Color)).is.undefined;
      expect(sittingPositionOf(model(phase({})), undefined, undefined)).is.undefined;
      expect(sittingPositionOf(undefined, undefined, BLUE)).is.undefined;
    });
    it('the assembly gate STANDING: the verdict page, the reward reads what is coming; ANSWERED: the wait pose names who is awaited', () => {
      const standing = sittingPositionOf(model(phase({step: 'assembly', awaiting: [BLUE, RED]})), gate('assembly'), BLUE)!;
      expect(standing.gate).eq('assembly');
      expect(standing.gateStanding).is.true;
      expect(standing.pages).deep.eq(['verdict']);
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
      expect(sittingRewardSettled(p), 'an own ask keeps the reward page').is.false;
    });
    it('the effects asking ANOTHER seat: the honest wait names who and what kind of answer — and keeps the page', () => {
      const p = sittingPositionOf(model(phase({step: 'effects', pending: {player: RED, key: 'k', input: 'space'}})), undefined, BLUE)!;
      expect(p.rewardStep).eq('waiting');
      expect(p.waitingFor).deep.eq({player: RED, input: 'space'});
      expect(sittingRewardSettled(p)).is.false;
    });
    it('the effects with the viewer\'s record in: the reward is RECEIVED (a skip included — the plate names it) and the page may be left', () => {
      const paid = sittingPositionOf(model(phase({step: 'effects', outcomes: [{player: BLUE, step: 'grant', kind: 'stock', amount: 2}]})), undefined, BLUE)!;
      expect(paid.rewardStep).eq('received');
      expect(sittingRewardSettled(paid)).is.true;
      const skipped = sittingPositionOf(model(phase({step: 'effects', outcomes: [{player: BLUE, step: 'grant', kind: 'skipped', reason: 'No influence'}]})), undefined, BLUE)!;
      expect(skipped.rewardStep).eq('received');
    });
    it('the adjourn gate: the enactment, the reward and the RESULTS; answered → the results\' wait pose', () => {
      const standing = sittingPositionOf(model(phase({step: 'adjourn', awaiting: [BLUE]})), gate('adjourn', [BLUE]), BLUE)!;
      expect(standing.pages).deep.eq(['enact', 'reward', 'results']);
      expect(standing.gateStanding).is.true;
      expect(standing.rewardStep, 'the reward is settled at the adjourn').eq('received');
      const answered = sittingPositionOf(model(phase({step: 'adjourn', awaiting: [RED]})), undefined, BLUE)!;
      expect(answered.rewardStep).eq('gate');
      expect(answered.awaiting).deep.eq([RED]);
      expect(sittingRewardSettled(answered)).is.true;
    });
    it('a gate prompt of the OTHER stage does not count as this step\'s (the marker\'s stage is compared, never assumed)', () => {
      const p = sittingPositionOf(model(phase({step: 'adjourn'})), gate('assembly'), BLUE)!;
      expect(p.gateStanding).is.false;
    });
  });

  describe('the crumb, the phase and the verbs', () => {
    it('one key per stage; the reward names the hosted step; «ЗАСЕДАНИЕ» is the subject; the results are ONE word', () => {
      expect(SITTING_SUBJECT_KEY).eq('Sitting');
      expect(sittingStageKey('verdict', 'reading')).eq('Verdict');
      expect(sittingStageKey('enact', 'reading')).eq('Enactment');
      expect(sittingStageKey('reward', 'reading')).eq('Reward');
      expect(sittingStageKey('reward', 'received')).eq('Reward');
      expect(sittingStageKey('reward', 'gate')).eq('Reward');
      expect(sittingStageKey('reward', 'choice')).eq('Choice');
      expect(sittingStageKey('reward', 'intake')).eq('Intake');
      expect(sittingStageKey('reward', 'placement')).eq('Placement');
      expect(sittingStageKey('results', 'gate')).eq('Results');
      expect(sittingStageKey('results', 'received')).eq('Results');
    });
    it('every stage up to the results is COMMITTED (B = collapse); the results are a terminal VERDICT (B = none); a submit is EXECUTING', () => {
      for (const stage of ['verdict', 'enact', 'reward'] as const) {
        expect(sittingWorkspacePhase(stage, false), stage).eq('committed');
        expect(backVerbFor(sittingWorkspacePhase(stage, false)), stage).eq('collapse');
      }
      expect(sittingWorkspacePhase('results', false)).eq('verdict');
      expect(backVerbFor(sittingWorkspacePhase('results', false))).eq('none');
      expect(sittingWorkspacePhase('verdict', true)).eq('executing');
      expect(backVerbFor(sittingWorkspacePhase('verdict', true))).eq('none');
    });
    it('A on the VERDICT answers gate 1 («Продолжить»); the director\'s pages advertise nothing; A on the RESULTS closes the sitting', () => {
      const verdict = sittingPositionOf(model(phase({step: 'assembly'})), gate('assembly'), BLUE)!;
      expect(sittingPrimaryKey(verdict, 0)).eq('Continue');
      const answered = sittingPositionOf(model(phase({step: 'assembly', awaiting: [RED]})), undefined, BLUE)!;
      expect(sittingPrimaryKey(answered, 0), 'answered: nothing to press').is.undefined;
      const effects = sittingPositionOf(model(phase({step: 'effects', outcomes: [{player: BLUE, step: 'grant', kind: 'stock', amount: 2}]})), undefined, BLUE)!;
      expect(sittingPrimaryKey(effects, 0), 'the enactment is the director\'s').is.undefined;
      expect(sittingPrimaryKey(effects, 1), 'a received reward has no verb').is.undefined;
      const adjourn = sittingPositionOf(model(phase({step: 'adjourn'})), gate('adjourn'), BLUE)!;
      expect(sittingPrimaryKey(adjourn, 2)).eq('Close the sitting');
      expect(sittingPrimaryKey(adjourn, 1), 'the reward page of the adjourn is the director\'s').is.undefined;
      const closed = sittingPositionOf(model(phase({step: 'adjourn', awaiting: [RED]})), undefined, BLUE)!;
      expect(sittingPrimaryKey(closed, 2)).is.undefined;
      const waiting = sittingPositionOf(model(phase({step: 'effects', pending: {player: RED, key: 'k'}})), undefined, BLUE)!;
      expect(sittingPrimaryKey(waiting, 1)).is.undefined;
    });
    it('the winner\'s tile is placed ONLY by the player\'s press: the placement step offers «К полю» and nothing turns the page by itself', () => {
      const placement = sittingPositionOf(model(phase({step: 'effects', pending: {player: BLUE, key: 'k', input: 'space'}})), tile(), BLUE)!;
      expect(placement.rewardStep).eq('placement');
      expect(sittingPrimaryKey(placement, 1)).eq('Onto the board');
      expect(sittingRewardSettled(placement)).is.false;
      expect(sittingStageKey('reward', placement.rewardStep)).eq('Placement');
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

describe('the quiet reward (final polish D) — a passive / an action resolution gives the REWARD stage an honest pose', () => {
  const byId = (id: string) => {
    const d = REDUX_RESOLUTION_CATALOG.all().find((x) => x.id === id);
    if (d === undefined) {
      throw new Error('missing ' + id);
    }
    return d;
  };
  it('the DEV passive reads its effect, the DEV action names its address, an immediate-only resolution has no quiet pose', () => {
    const passive = quietRewardPoseOf(byId(DEV_PASSIVE_RESOLUTION_ID));
    expect(passive?.kind).to.eq('passive');
    expect(passive?.text).to.eq(byId(DEV_PASSIVE_RESOLUTION_ID).text.passive);
    const action = quietRewardPoseOf(byId(DEV_ACTION_RESOLUTION_ID));
    expect(action?.kind).to.eq('action');
    expect(action?.text).to.eq(byId(DEV_ACTION_RESOLUTION_ID).text.action);
    expect(quietRewardPoseOf(byId(DEV_IMMEDIATE_RESOLUTION_ID))).to.eq(undefined);
    expect(quietRewardPoseOf(byId(AQUIFER_CONTEST_ID))).to.eq(undefined);
    expect(quietRewardPoseOf(undefined)).to.eq(undefined);
  });
  it('a compound resolution (immediate steps + a winner part, nothing that outlives the payout) has no quiet pose — its stage is the wave', () => {
    expect(quietRewardPoseOf(byId(DEV_COMPOUND_RESOLUTION_ID))).to.eq(undefined);
  });
  it('every catalogued passive / action resolution has a pose, an immediate-only one has none (the client half of contract § 9)', () => {
    for (const d of REDUX_RESOLUTION_CATALOG.all()) {
      const withSeam = d.passive !== undefined || d.action !== undefined;
      expect(quietRewardPoseOf(d) !== undefined, d.id + ' has a quiet pose').to.eq(withSeam);
    }
  });

  describe('ЛЕНТА и ТЕЛО (v5) — the body has exactly three states, and the row is the default', () => {
    it('every beat that MOVES an object keeps the row: the verdict, the enactment, the reward, the renewal', () => {
      expect(sittingBodyOf('verdict', false, false)).eq('parties');
      expect(sittingBodyOf('enact', false, false)).eq('parties');
      expect(sittingBodyOf('reward', false, false), 'the payout\'s formula is read in the BAND, the chips fly to the rail').eq('parties');
      expect(sittingBodyOf('results', true, false), 'the renewal\'s beats play over the row').eq('parties');
    });
    it('a hosted STEP of this seat is the one body the player works in — whatever page it arrived on', () => {
      expect(sittingBodyOf('reward', false, true)).eq('step');
      expect(sittingBodyOf('results', false, true), 'a step outranks the results panel: it is the live decision').eq('step');
      expect(sittingBodyOf('enact', false, true)).eq('step');
    });
    it('the RESULTS panel is the sitting\'s last reading — only once the renewal\'s beats have played', () => {
      expect(sittingBodyOf('results', false, false)).eq('results');
      expect(sittingBodyOf('results', true, false), 'hidden = the beats still play over the row').eq('parties');
    });
  });
});
