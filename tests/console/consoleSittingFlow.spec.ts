import {expect} from 'chai';
import {Color} from '../../src/common/Color';
import {ParliamentModel, ParliamentPhaseModel} from '../../src/common/models/ParliamentModel';
import {PlayerInputModel} from '../../src/common/models/PlayerInputModel';
import {PlayerViewModel} from '../../src/common/models/PlayerModel';
import {
  parliamentSittingFlowBeat, parliamentSittingLive, presentedGeneration, quietRewardPoseOf, SITTING_HOSTED_STEPS, SITTING_SUBJECT_KEY, sittingAskOf, sittingAtLastPage,
  sittingBodyOf, sittingFieldOf, sittingPageAuto, sittingPagesOf, sittingPositionOf, sittingPrimaryKey, sittingRewardSettled, sittingStageAt,
  sittingStageKey, sittingStartPage, sittingStepTakesStage, sittingTailPlacementOf, sittingWorkspacePhase, verdictStandsAt,
} from '../../src/client/console/parliament/consoleSittingFlow';
import {backVerbFor} from '../../src/client/console/consoleWorkspaceFlow';
import {AQUIFER_CONTEST_ID} from '../../src/server/parliament/resolutions/greens/AquiferContest';
import {
  DEV_ACTION_RESOLUTION_ID, DEV_COMPOUND_RESOLUTION_ID, DEV_IMMEDIATE_RESOLUTION_ID, DEV_PASSIVE_RESOLUTION_ID, REDUX_RESOLUTION_CATALOG,
} from '../../src/server/parliament/resolutions/ResolutionCatalog';

/*
 * THE SITTING FLOW — pure (docs/TURMOIL_REDUX_PARLIAMENT_SITTING_V2.md; the soft
 * gates — docs/claude/console/parliament-soft-gates.md): the server's step →
 * the pages the viewer walks (and which the director turns by itself) → the
 * crumb's tail → B's verb → the A verb → the ONE flow beat per sitting. No DOM,
 * no Vue: the server runner.
 */
const BLUE = 'blue' as Color;
const RED = 'red' as Color;

function phase(over: Partial<ParliamentPhaseModel>): ParliamentPhaseModel {
  return {generation: 3, final: false, step: 'effects', ...over};
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

/** THE CONFIRMATION — «Закрыть заседание», the seat's own close of its sitting (the only prompt of the sitting's own). */
const close = (): PlayerInputModel =>
  ({type: 'option', title: 'close', buttonLabel: 'Close the sitting', parliamentPhasePrompt: {stage: 'close', generation: 3, final: false, seq: 1}} as unknown as PlayerInputModel);
const pick = (): PlayerInputModel =>
  ({type: 'card', title: 'pick', buttonLabel: 'Select', cards: [], choiceContext: {source: {kind: 'resolution', resolution: 'RDX_X'}}} as unknown as PlayerInputModel);
const take = (): PlayerInputModel =>
  ({type: 'card', title: 'take', buttonLabel: 'Take', cards: [], choiceContext: {source: {kind: 'resolution', resolution: 'RDX_X'}},
    externalDrawPrompt: {intakeId: 1, count: 2, remaining: 2, cause: {kind: 'resolution', resolution: 'RDX_X'}}} as unknown as PlayerInputModel);
const tile = (): PlayerInputModel =>
  ({type: 'space', title: 'ocean', buttonLabel: 'Select', spaces: [], placementContext: {source: {kind: 'resolution', resolution: 'RDX_X'}}} as unknown as PlayerInputModel);
/** The shared discard's marker with the resolution as its source (Colonial Affairs repeating Pluto's second half). */
const discard = (): PlayerInputModel =>
  ({type: 'card', title: 'Discard 1 card', buttonLabel: 'Discard', cards: [], min: 1, max: 1,
    discardPrompt: {min: 1, max: 1, source: {kind: 'resolution', resolution: 'RDX_X'}, colonyRepeat: {colonyName: 'Pluto', index: 1, total: 2}}} as unknown as PlayerInputModel);

describe('consoleSittingFlow — the political phase as ONE flow (v2)', () => {
  describe('the pages of a server step', () => {
    it('every walk STARTS ON THE VERDICT: the whole chain rides one response, the verdict is read from the summary (the legacy steps map in)', () => {
      expect(sittingPagesOf('winner', false)).deep.eq(['verdict']);
      expect(sittingPagesOf('assembly', false), 'a legacy step: never on the wire any more').deep.eq(['verdict']);
      for (const step of ['agenda', 'support', 'enact'] as const) {
        expect(sittingPagesOf(step, false), step).deep.eq(['verdict', 'enact']);
      }
      expect(verdictStandsAt('assembly')).is.true;
      expect(verdictStandsAt('effects')).is.false;
      expect(verdictStandsAt('done')).is.false;
    });
    it('the EFFECTS (a law asking) read the verdict, the enactment and the reward; `done` (a seat still to close its sitting) adds the RENEWAL and the RESULTS — the final phase has NO renewal page', () => {
      expect(sittingPagesOf('effects', false)).deep.eq(['verdict', 'enact', 'reward']);
      expect(sittingPagesOf('done', false)).deep.eq(['verdict', 'enact', 'reward', 'renewal', 'results']);
      expect(sittingPagesOf('done', true), 'the final phase renews nothing: no page for it, neither a tact nor a line').deep.eq(['verdict', 'enact', 'reward', 'results']);
      for (const step of ['refresh', 'lobby', 'adjourn'] as const) {
        expect(sittingPagesOf(step, false), step).deep.eq(['verdict', 'enact', 'reward', 'renewal', 'results']);
      }
    });
    it('every page up to the results is turned by the DIRECTOR — the verdict included (decision Р1); the RESULTS are the one STOP', () => {
      expect(sittingPageAuto('verdict'), 'read, then the walk goes on — never a press').is.true;
      expect(sittingPageAuto('enact')).is.true;
      expect(sittingPageAuto('reward')).is.true;
      expect(sittingPageAuto('renewal'), 'A during the tact is «дожать», never a stop').is.true;
      expect(sittingPageAuto('results')).is.false;
    });
    it('a walk starts on the first page NOT yet played this session; on the results when the confirmation does not stand at the end; on the last page when everything played', () => {
      const played = (...stages: Array<string>) => (stage: string) => stages.includes(stage);
      const effects = sittingPositionOf(model(phase({step: 'effects'})), undefined, BLUE)!;
      expect(sittingStartPage(effects), 'nothing played: the verdict first').eq(0);
      expect(sittingStartPage(effects, played('verdict')), 'the verdict read: the enactment').eq(1);
      expect(sittingStartPage(effects, played('verdict', 'enact')), 'the enactment played: the reward').eq(2);
      expect(sittingStartPage(effects, played('verdict', 'enact', 'reward')), 'everything played: the last page').eq(2);
      const done = sittingPositionOf(model(phase({step: 'done'})), close(), BLUE)!;
      expect(sittingStartPage(done, played('verdict', 'enact', 'reward')), 'the RENEWAL after a played reward — its tact is owed before the results').eq(3);
      expect(sittingStartPage(done, played('verdict', 'enact', 'reward', 'renewal')), 'the results once the tact played').eq(4);
      expect(sittingStartPage(done), 'a sitting that arrives with everything unplayed walks from the verdict').eq(0);
      expect(sittingStartPage(sittingPositionOf(model(phase({step: 'done'})), undefined, BLUE)!), 'no confirmation standing (a foreign prompt holds the slot): the results').eq(4);
      // The tile's RECEIPT (the frame is back from the board): the reward page is read first, though it played.
      expect(sittingStartPage(done, played('verdict', 'enact', 'reward', 'renewal'), true), 'a receipt owed: back on the reward page').eq(2);
      expect(sittingStartPage(sittingPositionOf(model(phase({step: 'winner'})), undefined, BLUE)!, () => false, true), 'a step with no reward page ignores the receipt').eq(0);
    });
    it('the cursor is clamped — a shorter step never reads past its end', () => {
      const p = sittingPositionOf(model(phase({step: 'effects'})), undefined, BLUE)!;
      expect(sittingStageAt(p, 5)).eq('reward');
      expect(sittingAtLastPage(p, 2)).is.true;
      const w = sittingPositionOf(model(phase({step: 'winner'})), undefined, BLUE)!;
      expect(sittingStageAt(w, 0)).eq('verdict');
      expect(sittingStageAt(w, 3)).eq('verdict');
      expect(sittingAtLastPage(w, 0)).is.true;
    });
  });

  describe('sittingPositionOf — where the sitting stands, read off the server', () => {
    it('is undefined outside a live phase, for a seat outside the parliament and for no viewer', () => {
      expect(sittingPositionOf(model(undefined), undefined, BLUE)).is.undefined;
      expect(sittingPositionOf(model(phase({})), undefined, 'green' as Color)).is.undefined;
      expect(sittingPositionOf(model(phase({})), undefined, undefined)).is.undefined;
      expect(sittingPositionOf(undefined, undefined, BLUE)).is.undefined;
    });
    it('the sitting at its END for a seat that has not closed it: the whole walk, the confirmation STANDING, the reward received — no wait on anybody', () => {
      const standing = sittingPositionOf(model(phase({step: 'done'})), close(), BLUE)!;
      expect(standing.gate).eq('close');
      expect(standing.gateStanding).is.true;
      expect(standing.pages).deep.eq(['verdict', 'enact', 'reward', 'renewal', 'results']);
      expect(standing.rewardStep).eq('received');
      expect(standing.waitingFor).is.undefined;
      expect(sittingRewardSettled(standing)).is.true;
      expect(Object.keys(standing), 'nobody is «awaited» since the soft gates').not.includes('awaiting');
      const live = sittingPositionOf(model(phase({step: 'effects'})), undefined, BLUE)!;
      expect(live.gate, 'no confirmation while the law still asks').is.undefined;
    });
    it('the effects: the viewer\'s OWN ask by its structural marker — a pick, a take, a tile; never a title', () => {
      expect(sittingAskOf(pick())).eq('choice');
      expect(sittingAskOf(take())).eq('intake');
      expect(sittingAskOf(tile())).eq('placement');
      // The shared distribution step's marked `and` is a LAYOUT — its own hosted step, its own one-word tail.
      const spread = {type: 'and', title: 'lay', buttonLabel: 'Confirm', options: [], choiceContext: {source: {kind: 'resolution', resolution: 'RDX_X'}},
        cardResourceDistributionPrompt: {amount: 3, cardResource: 'floater', cards: []}} as unknown as PlayerInputModel;
      expect(sittingAskOf(spread)).eq('distribution');
      expect(sittingStageKey('reward', 'distribution')).eq('Distribution');
      expect(sittingStageKey('reward', 'choice')).eq('Choice');
      // The board door's tail says what the board step DOES: a tile placed, or a tile TAKEN OFF (Water Export).
      expect(sittingStageKey('reward', 'placement')).eq('Placement');
      expect(sittingStageKey('reward', 'placement', true)).eq('Removal');
      expect(sittingStageKey('reward', 'choice', true), 'the removal flag names only the board step').eq('Choice');
      expect(sittingAskOf({type: 'card', title: 'Select a card to keep', buttonLabel: 'Keep', cards: []} as unknown as PlayerInputModel), 'no resolution source').is.undefined;
      expect(sittingAskOf(undefined)).is.undefined;
      const p = sittingPositionOf(model(phase({step: 'effects', pending: {player: BLUE, key: 'k', input: 'card'}})), pick(), BLUE)!;
      expect(p.rewardStep).eq('choice');
      expect(p.waitingFor).is.undefined;
      expect(sittingRewardSettled(p), 'an own ask keeps the reward page').is.false;
    });
    /* Colonial Affairs (RX07): the second half of Pluto's «draw 1, then discard 1» is the shared DISCARD from
     * hand, marked with the resolution as its source — the HAND is the hosted step, in its discard mode. */
    it('a resolution-sourced DISCARD is the seat\'s own ask too — a hosted step of its own («СБРОС»), by the discard marker, never a title', () => {
      expect(sittingAskOf(discard())).eq('discard');
      expect(SITTING_HOSTED_STEPS.has('discard'), 'the hand stands in the zone like the picker and the take').is.true;
      expect(sittingStageKey('reward', 'discard')).eq('Discarding');
      // A card's own forced discard is nobody's step of the sitting.
      const cardDiscard = {type: 'card', title: 'Discard 1 card', buttonLabel: 'Discard', cards: [], min: 1, max: 1,
        discardPrompt: {min: 1, max: 1, source: {kind: 'card', card: 'Mars University'}}} as unknown as PlayerInputModel;
      expect(sittingAskOf(cardDiscard)).is.undefined;
      const p = sittingPositionOf(model(phase({step: 'effects', pending: {player: BLUE, key: 'k', input: 'card'}})), discard(), BLUE)!;
      expect(p.rewardStep).eq('discard');
      expect(sittingRewardSettled(p)).is.false;
    });
    /* Colony Contest (RX09): the winner's free colony is a `SelectColony` the resolution raised — the COLONIES
     * SCREEN is the hosted step (a workspace frame in the Parliament's slot, like the hand's discard), under one
     * word, «КОЛОНИИ»; never the task host's picker, never a title. */
    it('a resolution-sourced COLONY pick is the seat\'s own ask — the colonies frame as a hosted step («КОЛОНИИ»), by the placement marker\'s source', () => {
      const colony = {type: 'colony', title: 'Select where to build the free colony', buttonLabel: 'Build', coloniesModel: [],
        placementContext: {cancellable: false, reason: 'r', source: {kind: 'resolution', resolution: 'RDX_X'}}} as unknown as PlayerInputModel;
      expect(sittingAskOf(colony)).eq('colony');
      expect(SITTING_HOSTED_STEPS.has('colony'), 'the door publishes the slot the colonies frame teleports into').is.true;
      expect(sittingStageKey('reward', 'colony')).eq('Colonies');
      // A colony pick a CARD raised (Trading Colony, the standard project) is nobody's step of the sitting.
      const cardPick = {type: 'colony', title: 'Select where to build a colony', buttonLabel: 'Build', coloniesModel: [],
        placementContext: {cancellable: true}} as unknown as PlayerInputModel;
      expect(sittingAskOf(cardPick)).is.undefined;
      const p = sittingPositionOf(model(phase({step: 'effects', pending: {player: BLUE, key: 'colony', input: 'colony'}})), colony, BLUE)!;
      expect(p.rewardStep).eq('colony');
      expect(sittingRewardSettled(p), 'the page holds while the pick stands').is.false;
      expect(sittingPrimaryKey(p, 2), 'the colonies frame owns the bar — A is theirs, not the sitting\'s').is.undefined;
      expect(backVerbFor(sittingWorkspacePhase('reward', false)), 'B past the commit: collapse, never a close').eq('collapse');
      // The frame outlives the pick: once answered, the position reads «received» while the colonies still stand
      // (the cube's flight, the tile's own bonus) — the field and the door stay open for the frame (`hosting`).
      expect(sittingFieldOf('reward', 'colony', false, false), 'the pick stands: the field and the door').deep.eq({pose: true, stepOpen: true});
      expect(sittingFieldOf('reward', 'colony', true, false), 'the titanium wave first').deep.eq({pose: false, stepOpen: false});
      expect(sittingFieldOf('reward', 'received', false, false, true), 'answered, the frame still inside: open for it').deep.eq({pose: true, stepOpen: true});
      expect(sittingFieldOf('reward', 'colony', true, false, true), 'the frame is pushed the moment the prompt is admitted — the wave STILL comes first').deep.eq({pose: false, stepOpen: false});
      expect(sittingFieldOf('reward', 'received', false, false, false), 'the frame left: the row of parties returns').deep.eq({pose: false, stepOpen: false});
      expect(sittingFieldOf('results', 'received', false, false, true), 'never on another page — the walk holds the reward page instead').deep.eq({pose: false, stepOpen: false});
    });
    /* THE FIELD AND THE STEP'S DOOR are two facts: a hosted step opens both once the wave that arrived with it
     * has flown; a LEDGER body (the colony bonuses) takes the field for the whole reward page — its rows are
     * the wave's sources — while the door stays shut until the wave has landed. */
    it('sittingFieldOf: a hosted step takes the field and opens the door after the wave; a ledger takes the field at once and keeps the door shut while a wave flies', () => {
      expect(sittingFieldOf('enact', 'intake', false, false), 'not the reward page').deep.eq({pose: false, stepOpen: false});
      expect(sittingFieldOf('reward', 'intake', true, false), 'the wave first').deep.eq({pose: false, stepOpen: false});
      expect(sittingFieldOf('reward', 'intake', false, false), 'then the take deals').deep.eq({pose: true, stepOpen: true});
      expect(sittingFieldOf('reward', 'discard', false, false), 'the discard is hosted like the take').deep.eq({pose: true, stepOpen: true});
      expect(sittingFieldOf('reward', 'received', false, false), 'a plain payout keeps the row of parties').deep.eq({pose: false, stepOpen: false});
      expect(sittingFieldOf('reward', 'reading', false, true), 'the ledger reads before anything flies').deep.eq({pose: true, stepOpen: false});
      expect(sittingFieldOf('reward', 'intake', true, true), 'the ledger stands under its own wave; the door waits').deep.eq({pose: true, stepOpen: false});
      expect(sittingFieldOf('reward', 'intake', false, true), 'the wave landed: the step takes the zone, the ledger yields').deep.eq({pose: true, stepOpen: true});
      expect(sittingFieldOf('reward', 'received', false, true), 'everything paid: the ledger reads «получено»').deep.eq({pose: true, stepOpen: false});
      expect(sittingFieldOf('results', 'received', false, true), 'the results page is the panel, never the ledger').deep.eq({pose: false, stepOpen: false});
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
    it('a confirmation of ANOTHER sitting\'s stage never counts as this step\'s (the marker\'s stage is compared, never assumed)', () => {
      const p = sittingPositionOf(model(phase({step: 'effects'})), close(), BLUE)!;
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
      expect(sittingStageKey('reward', 'choice')).eq('Choice');
      expect(sittingStageKey('reward', 'intake')).eq('Intake');
      expect(sittingStageKey('reward', 'discard')).eq('Discarding');
      expect(sittingStageKey('reward', 'placement')).eq('Placement');
      expect(sittingStageKey('renewal', 'received'), 'ОБНОВЛЕНИЕ — one word, the tact\'s own').eq('Renewal');
      expect(sittingStageKey('results', 'received')).eq('Results');
    });
    it('every stage up to the results is COMMITTED (B = collapse); the results are a terminal VERDICT (B = none); a submit is EXECUTING', () => {
      for (const stage of ['verdict', 'enact', 'reward', 'renewal'] as const) {
        expect(sittingWorkspacePhase(stage, false), stage).eq('committed');
        expect(backVerbFor(sittingWorkspacePhase(stage, false)), stage).eq('collapse');
      }
      expect(sittingWorkspacePhase('results', false)).eq('verdict');
      expect(backVerbFor(sittingWorkspacePhase('results', false))).eq('none');
      expect(sittingWorkspacePhase('verdict', true)).eq('executing');
      expect(backVerbFor(sittingWorkspacePhase('verdict', true))).eq('none');
    });
    it('the VERDICT advertises nothing (a page of the director); the director\'s pages advertise nothing; A on the RESULTS closes the sitting', () => {
      const effects = sittingPositionOf(model(phase({step: 'effects', outcomes: [{player: BLUE, step: 'grant', kind: 'stock', amount: 2}]})), undefined, BLUE)!;
      expect(sittingPrimaryKey(effects, 0), 'the verdict is read, never answered').is.undefined;
      expect(sittingPrimaryKey(effects, 1), 'the enactment is the director\'s').is.undefined;
      expect(sittingPrimaryKey(effects, 2), 'a received reward has no verb').is.undefined;
      const done = sittingPositionOf(model(phase({step: 'done'})), close(), BLUE)!;
      expect(sittingPrimaryKey(done, 0)).is.undefined;
      expect(sittingPrimaryKey(done, 4)).eq('Close the sitting');
      expect(sittingPrimaryKey(done, 2), 'the reward page of the end is the director\'s').is.undefined;
      expect(sittingPrimaryKey(done, 3), 'the renewal page advertises nothing: A there is «дожать»').is.undefined;
      const foreign = sittingPositionOf(model(phase({step: 'done'})), undefined, BLUE)!;
      expect(sittingPrimaryKey(foreign, 4), 'no confirmation standing: nothing to press').is.undefined;
      const waiting = sittingPositionOf(model(phase({step: 'effects', pending: {player: RED, key: 'k'}})), undefined, BLUE)!;
      expect(sittingPrimaryKey(waiting, 2)).is.undefined;
    });
    it('the winner\'s tile is placed ONLY by the player\'s press: the placement step offers «К полю» and nothing turns the page by itself', () => {
      const placement = sittingPositionOf(model(phase({step: 'effects', pending: {player: BLUE, key: 'k', input: 'space'}})), tile(), BLUE)!;
      expect(placement.rewardStep).eq('placement');
      expect(placement.tail).is.undefined;
      expect(sittingPrimaryKey(placement, 2)).eq('Onto the board');
      expect(sittingRewardSettled(placement)).is.false;
      expect(sittingStageKey('reward', placement.rewardStep)).eq('Placement');
    });

    /* Mohole Contest (RX23): the winner's temperature step reaches 0 °C and the ENGINE asks the winner for the
     * ocean — a placement with no resolution source, which the server's position names as the step's own ask. */
    it('the engine\'s TAIL of the seat\'s own step (the 0 °C ocean) is the seat\'s placement too — by the server\'s position and the prompt\'s type, never a title — with NO door: it holds the page and offers nothing to press', () => {
      const ocean = (): PlayerInputModel =>
        ({type: 'space', title: 'Select space for ocean from temperature increase', buttonLabel: 'Select', spaces: [],
          placementContext: {cancellable: false, source: {kind: 'system', name: 'Temperature bonus step'}}} as unknown as PlayerInputModel);
      expect(sittingAskOf(ocean()), 'no resolution source: not an ask of the resolution\'s').is.undefined;
      expect(sittingTailPlacementOf(ocean(), phase({step: 'effects', pending: {player: BLUE, key: 'temperature', input: 'space'}}), BLUE)).is.true;
      const tail = sittingPositionOf(model(phase({step: 'effects', pending: {player: BLUE, key: 'temperature', input: 'space'}})), ocean(), BLUE)!;
      expect(tail.rewardStep).eq('placement');
      expect(tail.tail).is.true;
      expect(sittingPrimaryKey(tail, 2), 'admitted like any board placement — nothing to press').is.undefined;
      expect(sittingRewardSettled(tail), 'a step is owed until it is placed').is.false;
      expect(sittingStageKey('reward', tail.rewardStep)).eq('Placement');
      // The OTHER seat reads the honest wait on the winner's placement.
      const other = sittingPositionOf(model(phase({step: 'effects', pending: {player: BLUE, key: 'temperature', input: 'space'}})), undefined, RED)!;
      expect(other.rewardStep).eq('waiting');
      expect(other.waitingFor).deep.eq({player: BLUE, input: 'space'});
      // Not a tail: the position names ANOTHER seat, another kind of ask, or another step of the phase.
      expect(sittingTailPlacementOf(ocean(), phase({step: 'effects', pending: {player: RED, key: 'temperature', input: 'space'}}), BLUE)).is.false;
      expect(sittingTailPlacementOf(ocean(), phase({step: 'effects', pending: {player: BLUE, key: 'k', input: 'card'}}), BLUE)).is.false;
      expect(sittingTailPlacementOf(ocean(), phase({step: 'done', pending: {player: BLUE, key: 'temperature', input: 'space'}}), BLUE)).is.false;
      expect(sittingTailPlacementOf(tile(), phase({step: 'effects', pending: {player: BLUE, key: 'ocean', input: 'space'}}), BLUE), 'the resolution\'s own tile is a DOOR, never a tail').is.false;
    });
  });

  describe('the ONE flow beat per sitting', () => {
    const view = (p: ParliamentPhaseModel | undefined, wf: PlayerInputModel | undefined, generation = 3): PlayerViewModel =>
      ({game: {generation, parliament: model(p)}, waitingFor: wf, thisPlayer: {color: BLUE}} as unknown as PlayerViewModel);
    it('keys on the SITTING\'s generation and stays the SAME through the law\'s asks and the confirmation — the next generation running around it included', () => {
      const keys = [
        parliamentSittingFlowBeat(view(phase({step: 'effects'}), pick())),
        parliamentSittingFlowBeat(view(phase({step: 'effects'}), take())),
        parliamentSittingFlowBeat(view(phase({step: 'effects'}), tile())),
        parliamentSittingFlowBeat(view(phase({step: 'effects'}), undefined)),
        parliamentSittingFlowBeat(view(phase({step: 'done'}), close(), 4)),
      ].map((b) => b?.key);
      expect(keys).deep.eq(new Array(5).fill('parliament:gen3'));
      expect(parliamentSittingFlowBeat(view(phase({step: 'done'}), close(), 4))).deep.eq({key: 'parliament:gen3', taskKind: 'parliamentPhase', flow: 'parliament-phase'});
    });
    it('is gone once the seat has closed its sitting (the server reads it no phase) — and never exists for a non-participant', () => {
      expect(parliamentSittingFlowBeat(view(undefined, undefined, 4))).is.undefined;
      expect(parliamentSittingLive(view(phase({step: 'effects'}), undefined))).is.true;
      expect(parliamentSittingLive(view(phase({step: 'done'}), close(), 4)), 'live while the confirmation stands').is.true;
      expect(parliamentSittingLive(view(undefined, undefined))).is.false;
    });
    it('THE EARLY CLOSE: while the law asks another seat, the viewer\'s early close stands — A on the reward page closes; the server says whether its part is still ahead', () => {
      const earlyClose = {...close(), parliamentPhasePrompt: {stage: 'close', generation: 3, final: false, seq: 1, early: true}} as unknown as PlayerInputModel;
      const waiting = phase({step: 'effects', pending: {player: RED, key: 'k', input: 'card'}, ahead: [RED]});
      const position = sittingPositionOf(model(waiting), earlyClose, BLUE)!;
      expect(position.earlyClose).is.true;
      expect(position.gate, 'never the sitting-end confirmation').is.undefined;
      expect(position.rewardStep).eq('waiting');
      expect(position.askedLater, 'its part is done').is.undefined;
      expect(sittingPrimaryKey(position, position.pages.indexOf('reward'))).eq('Close the sitting');
      const ahead = sittingPositionOf(model({...waiting, ahead: [RED, BLUE]}), earlyClose, BLUE)!;
      expect(ahead.askedLater, 'the server reads its part still ahead').is.true;
      // Without the early close (the seat holds nothing yet), A on the reward page offers nothing.
      expect(sittingPrimaryKey(sittingPositionOf(model(waiting), undefined, BLUE)!, 2)).is.undefined;
    });
    it('a seat that CLOSED early is held by nothing — the beat is gone; a question of the law is a FRESH beat of its own key', () => {
      const closed = phase({step: 'effects', pending: {player: RED, key: 'k'}, closed: [BLUE]});
      expect(sittingPositionOf(model(closed), undefined, BLUE), 'nothing asked: the seat stands in no sitting').is.undefined;
      expect(sittingPositionOf(model(closed), pick(), BLUE)?.closed, 'asked: back in it, marked closed').is.true;
      expect(parliamentSittingFlowBeat(view(closed, undefined)), 'nothing asked: no plate, no frame').is.undefined;
      expect(parliamentSittingLive(view(closed, undefined))).is.false;
      expect(parliamentSittingFlowBeat(view(phase({step: 'effects', closed: [BLUE]}), pick()))?.key, 'its own question').eq('parliament:gen3:ask');
      expect(parliamentSittingFlowBeat(view(phase({step: 'effects', closed: [BLUE]}), tile()))?.key).eq('parliament:gen3:ask');
      // Another seat's early close changes nothing for the viewer.
      expect(parliamentSittingFlowBeat(view(phase({step: 'effects', closed: [RED]}), undefined))?.key).eq('parliament:gen3');
    });
    it('the PRESENTED generation is the sitting\'s until the seat closes it — the counter flips at the seat\'s own «Закрыть заседание»', () => {
      expect(presentedGeneration(view(phase({step: 'done'}), close(), 4))).eq(3);
      expect(presentedGeneration(view(undefined, undefined, 4))).eq(4);
      expect(presentedGeneration(view(phase({step: 'effects'}), undefined, 3))).eq(3);
      expect(presentedGeneration(undefined)).eq(0);
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
    it('every beat that MOVES an object keeps the row: the verdict, the enactment, the reward, the RENEWAL', () => {
      expect(sittingBodyOf('verdict', false)).eq('parties');
      expect(sittingBodyOf('enact', false)).eq('parties');
      expect(sittingBodyOf('reward', false), 'the payout\'s formula is read in the BAND, the chips fly to the rail').eq('parties');
      expect(sittingBodyOf('renewal', false), 'the whole tact plays over the row: the plaques\' sockets are its sources').eq('parties');
    });
    it('a hosted STEP of this seat is the one body the player works in — whatever page it arrived on', () => {
      expect(sittingBodyOf('reward', true)).eq('step');
      expect(sittingBodyOf('results', true), 'a step outranks the results panel: it is the live decision').eq('step');
      expect(sittingBodyOf('enact', true)).eq('step');
    });
    it('the RESULTS panel is the sitting\'s last reading — the body from the page\'s first frame (nothing flies under it any more)', () => {
      expect(sittingBodyOf('results', false)).eq('results');
    });
  });
});

describe('sittingStepTakesStage — a WHOLE workspace step takes the stage whole (the owner, 2026-10-29)', () => {
  it('the colonies — by the server\'s step or by the frame standing on the Parliament — are never squeezed beside the card', () => {
    expect(sittingStepTakesStage(true, 'colony', false), 'the winner\'s free colony (Colony Contest)').is.true;
    expect(sittingStepTakesStage(true, 'received', true), 'the colonies frame after the answer (its build scene, its bonus pick)').is.true;
    expect(sittingStepTakesStage(true, 'reading', true), 'a SHOW step of the colony table (Unity Budget)').is.true;
  });
  it('the picker, the take and the hand\'s discard keep their hero column; no field, no whole stage', () => {
    for (const step of ['choice', 'distribution', 'intake', 'discard'] as const) {
      expect(sittingStepTakesStage(true, step, false), step).is.false;
    }
    expect(sittingStepTakesStage(false, 'colony', true), 'no field pose: nothing to take').is.false;
  });
});
