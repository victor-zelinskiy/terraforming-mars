import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentModel, ParliamentRallyModel} from '@/common/models/ParliamentModel';
import {
  detectNeutralRally, dropNeutralRallyPromise, neutralRallyFlow, neutralRallyHostFor, neutralRallyLiveIn, neutralRallyOwedTo, promiseNeutralRally,
  rallyCounted, rallyCountedPlaces, rallyCubeLifted, rallyMarked, rallyPlaceKey, rallyPoolHeld, rallySupportIncoming, rallySupportLanded, rallySupportRead,
  rallySupportReading, rallyVoteKey, rallyVoteLanded, rallyWinnerShown, releaseNeutralRallyHolds, resetNeutralRallyFlow, seedNeutralRallyHolds,
  NEUTRAL_RALLY_RAIL_KEY,
} from '@/client/console/parliament/neutralRally';
import {
  RALLY_COUNT_LEAD_MS, RALLY_COUNT_TICK_MS, RALLY_CUBE_GAP_MS, RALLY_READ_MS, RallyBeatScheduler, neutralRallyBudgetMs, neutralRallyHoldMs, rallyCountOrder,
  runNeutralRally,
} from '@/client/console/parliament/neutralRallyDirector';
import {dropHostedStepPromises, hostedStepLiveBeat, hostedStepLiveIn, hostedStepOwedTo, hostedStepToEnter} from '@/client/console/parliament/hostedParliamentStep';
import {agendaWalkFlow, resetAgendaWalkFlow} from '@/client/console/parliament/agendaWalk';
import {parliamentHolds, resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {railRewardPending, railRewardState, releaseRailReward} from '@/client/console/resourceTransfer/railReward';
import {NEUTRAL_RALLY_STAGE_KEY, parliamentCrumbCommitted, parliamentCrumbStage, parliamentFlow, resetParliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {winningShownOf} from '@/client/console/parliament/parliamentVoteView';
import {parliamentBandLine, RALLY_COUNT_CHIP_ID} from '@/client/console/parliament/parliamentBand';
import {descendWorkspaceFrame, enterWorkspace, resetWorkspaceStack} from '@/client/console/consoleWorkspaceStack';
import {heroRewardEffectsOf, playCommitVerb, playDoorOf} from '@/client/console/consolePlayCardComposer';
import {NEUTRAL_RALLY_STEP_STAGE} from '@/client/console/consoleTaskRouter';
import {ActionPreviewBranch, NeutralRallyModel} from '@/common/models/ActionPreviewModel';
import {ParliamentSlotVm} from '@/client/console/parliament/consoleParliamentModel';
import {SUPPORT_CUBE_STAGGER_MS} from '@/client/console/parliament/consoleParliamentModel';

/*
 * «ДЕЛЕГАТЫ» — a card's RALLY of neutral delegates (TR31 Nationalist Movement),
 * the PURE half: the answer's record is detected by its SERIAL (never a title),
 * its holds are seeded only when somebody is there to play them (the cubes
 * hidden, the plaques and the pool at their old counts, the winning marker where
 * it stood, the M€ row held with the price known), each touchdown releases
 * exactly its own hold, the conclusion reads the rally as an owed step and then
 * as a live outcome — and the director's PHRASE goes votes → support → the
 * recount (a task per tick) → the coin → the read, in the record's order.
 */
const BLUE = 'blue' as Color;
const RED = 'red' as Color;
const HC = 'RDX_REDS_HEAT_CAPTURE#0';
const AA = 'RDX_MARS_ARCHITECTURE_AWARD#0';
const AC = 'RDX_GREENS_AQUIFER_CONTEST#0';
const CARD = CardName.NATIONALIST_MOVEMENT;
const R = PartyName.REDS;
const M = PartyName.MARS;
const U = PartyName.UNITY;

/** The e2e fixture's table: HC 3 (blue 2 + 1 neutral), AA 3 (red 1 + 2 neutral), AC 4 (red 2 + 2 neutral) — the winner before. */
function model(over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {
    slots: [
      {instance: HC, resolution: 'RDX_REDS_HEAT_CAPTURE', party: R, votes: [{owner: BLUE, seq: 1}, {owner: BLUE, seq: 2}, {owner: 'neutral', seq: 3}], totalVotes: 3, isWinning: false, tiePriority: 1, viewerVotes: 2},
      {instance: AA, resolution: 'RDX_MARS_ARCHITECTURE_AWARD', party: M, votes: [{owner: RED, seq: 4}, {owner: 'neutral', seq: 5}, {owner: 'neutral', seq: 6}], totalVotes: 3, isWinning: false, tiePriority: 2, viewerVotes: 0},
      {instance: AC, resolution: 'RDX_GREENS_AQUIFER_CONTEST', party: PartyName.GREENS, votes: [{owner: RED, seq: 7}, {owner: RED, seq: 8}, {owner: 'neutral', seq: 9}, {owner: 'neutral', seq: 10}], totalVotes: 4, isWinning: true, tiePriority: 3, viewerVotes: 0},
    ],
    rulingParty: PartyName.INDUSTRIALISTS, popularSupport: {[R]: 1, [M]: 3, [U]: 2}, deckSize: 10, discardSize: 0, neutralSupply: 3, botMode: 'none',
    players: [BLUE, RED].map((color) => ({
      color, participates: true, lobby: false, reserve: 5, onResolutions: 2,
      chairman: false, agenda: 0, influence: 0, access: [], partyActionUses: {}, resolutionActionUses: 0,
    })),
    ...over,
  } as unknown as ParliamentModel;
}

function view(parliament: ParliamentModel, megacredits = 10, generation = 3): PlayerViewModel {
  return {
    id: 'p-blue',
    thisPlayer: {color: BLUE, megacredits, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0, terraformRating: 20, tableau: []},
    players: [{color: BLUE, name: 'Blue'}, {color: RED, name: 'Red'}],
    game: {generation, parliament},
  } as unknown as PlayerViewModel;
}

/** The record TR31 writes on that table: HC 3 → 4 (becomes the winner on the tie), AA 3 → 4, the Reds 1 → 2, Mars First +0 (full), in use 11 → 14. */
const RALLY: ParliamentRallyModel = {
  seq: 42, player: BLUE, card: CARD, winnerBefore: AC,
  votes: [
    {instance: HC, resolution: 'RDX_REDS_HEAT_CAPTURE', party: R, seq: 11, votes: 4, winnerAfter: HC, tieNote: 'slot-priority'},
    {instance: AA, resolution: 'RDX_MARS_ARCHITECTURE_AWARD', party: M, seq: 12, votes: 4, winnerAfter: HC},
  ],
  missing: [], votesCut: [],
  support: [{party: R, current: 1, gained: 1, resulting: 2, printed: 1}, {party: M, current: 3, gained: 0, resulting: 3, printed: 1, limit: 'area'}],
  counted: {votes: [{instance: HC, seqs: [3, 11]}, {instance: AA, seqs: [5, 6, 12]}, {instance: AC, seqs: [9, 10]}], support: [{party: M, count: 3}, {party: R, count: 2}, {party: U, count: 2}]},
  inUse: {before: 11, after: 14}, megacredits: 14, generation: 3,
};

/** The two views of the play's answer: the price (2) paid and the recount (14) gained in ONE response. */
function pair(after: Partial<ParliamentRallyModel> = {}) {
  const before = view(model(), 12);
  const landed = view(model({lastRally: {...RALLY, ...after}, neutralSupply: 0} as never), 12 - 2 + 14);
  return {before, after: landed};
}

const PRICE = {'stock:megacredits': -2};

function resetAll(): void {
  resetNeutralRallyFlow();
  resetAgendaWalkFlow();
  resetParliamentHolds();
  resetParliamentFlow();
  resetWorkspaceStack();
  releaseRailReward(NEUTRAL_RALLY_RAIL_KEY, 'reset');
}

/** The hand the card was played from, with its descent standing (the composer's home). */
function handDescended(): void {
  enterWorkspace('hand', {anchor: {type: 'always'}});
  descendWorkspaceFrame('hand', CARD, 'Playing', {type: 'always'});
}

describe('«ДЕЛЕГАТЫ» — a card\'s rally of neutral delegates (the pure half)', () => {
  beforeEach(resetAll);
  after(resetAll);

  describe('DETECT — the record, never a title', () => {
    it('the viewer\'s own record whose serial GREW; never an echo, a first view or a rival\'s', () => {
      const {before, after} = pair();
      expect(detectNeutralRally(before, after)).deep.include({seq: 42, player: BLUE, card: CARD});
      expect(detectNeutralRally(after, after), 'the same record twice (an echo frame)').is.undefined;
      expect(detectNeutralRally(undefined, after), 'a first view — a reload has nothing to move from').is.undefined;
      expect(detectNeutralRally(before, pair({player: RED}).after), 'a rival\'s rally is the rival module\'s').is.undefined;
      const older = view(model({lastRally: {...RALLY, seq: 50}} as never));
      expect(detectNeutralRally(older, after), 'a serial that did not grow').is.undefined;
    });
  });

  describe('SEED — only when somebody is there to play it', () => {
    it('the HAND with its descent standing hosts it: the new cubes hidden, the plaque and the pool at their old counts, the winner where it stood, the M€ row held with the price known', () => {
      handDescended();
      promiseNeutralRally(CARD, 'hand', PRICE);
      expect(neutralRallyHostFor()).eq('hand');
      const {before, after} = pair();
      seedNeutralRallyHolds(before, after);
      expect(neutralRallyFlow.owed).deep.include({seq: 42, player: BLUE, card: CARD, host: 'hand'});
      expect(neutralRallyFlow.promised, 'the record IS the answer').is.undefined;
      expect(parliamentHolds.hiddenCubes.has(`${HC}#11`), 'the Reds\' new cube hidden').is.true;
      expect(parliamentHolds.hiddenCubes.has(`${AA}#12`), 'Mars First\'s new cube hidden').is.true;
      expect(parliamentHolds.hiddenCubes.has(`${HC}#3`), 'a cube that stood before is not held').is.false;
      expect(rallySupportIncoming(R), 'the Reds\' plaque does not draw its new cube yet').eq(1);
      expect(rallySupportIncoming(M), 'Mars First took nothing — nothing to hold').eq(0);
      expect(rallyPoolHeld(), 'the pool still paints the three cubes the answer took').eq(3);
      expect(rallyWinnerShown()).deep.eq({instance: AC});
      expect(railRewardPending(NEUTRAL_RALLY_RAIL_KEY), 'the M€ row is held for the recount').is.true;
      expect(railRewardState.degraded, 'the price known, the diff verified').is.undefined;
      // An echo frame seeds nothing twice.
      seedNeutralRallyHolds(after, after);
      expect(rallyPoolHeld()).eq(3);
    });

    it('a Parliament standing ON ITS OWN hosts it', () => {
      enterWorkspace('parliament', {anchor: {type: 'always'}});
      expect(neutralRallyHostFor()).eq('parliament');
      const {before, after} = pair();
      seedNeutralRallyHolds(before, after);
      expect(neutralRallyFlow.owed?.host).eq('parliament');
      expect(rallyPoolHeld()).eq(3);
    });

    it('NOBODY there: no hold is seeded (a hold nobody would consume freezes the table), the promise is dropped, the state just updates', () => {
      promiseNeutralRally(CARD, 'hand', PRICE);
      expect(neutralRallyHostFor()).is.undefined;
      const {before, after} = pair();
      seedNeutralRallyHolds(before, after);
      expect(neutralRallyFlow.owed).is.undefined;
      expect(neutralRallyFlow.promised).is.undefined;
      expect(parliamentHolds.hiddenCubes.size).eq(0);
      expect(rallyPoolHeld()).eq(0);
      expect(rallyWinnerShown()).is.undefined;
      expect(railRewardPending(NEUTRAL_RALLY_RAIL_KEY)).is.false;
    });

    it('a rally that paid NO M€ holds no rail row; one whose price is not known holds none either (a mismatch is named, never a wrong hold)', () => {
      handDescended();
      const {before, after} = pair({megacredits: 0, inUse: {before: 14, after: 14}});
      seedNeutralRallyHolds(before, after);
      expect(railRewardPending(NEUTRAL_RALLY_RAIL_KEY)).is.false;
      resetAll();
      handDescended();
      promiseNeutralRally(CARD, 'hand', {});
      const second = pair();
      seedNeutralRallyHolds(second.before, second.after);
      expect(railRewardPending(NEUTRAL_RALLY_RAIL_KEY), 'the row moved by the price too — the promise did not say so').is.false;
      expect(railRewardState.degraded?.why).eq('mismatch');
    });
  });

  describe('THE TOUCHDOWNS release exactly their own hold', () => {
    function seeded() {
      handDescended();
      promiseNeutralRally(CARD, 'hand', PRICE);
      const {before, after} = pair();
      seedNeutralRallyHolds(before, after);
      neutralRallyFlow.live = true;
    }

    it('a lift-off takes one cube off the pool; a vote\'s touchdown shows its cube, grows the band and moves the winner only when THAT cube moved it', () => {
      seeded();
      rallyCubeLifted();
      expect(rallyPoolHeld()).eq(2);
      rallyVoteLanded(RALLY.votes[0]);
      expect(parliamentHolds.hiddenCubes.has(`${HC}#11`)).is.false;
      expect(rallyWinnerShown(), 'the Reds\' cube made HC the winner — the marker moves on ITS touchdown').deep.eq({instance: HC});
      expect(neutralRallyFlow.landedVotes.map((v) => v.instance)).deep.eq([HC]);
      rallyVoteLanded(RALLY.votes[1]);
      expect(rallyWinnerShown(), 'Mars First\'s cube changed nothing').deep.eq({instance: HC});
      expect(neutralRallyFlow.landedVotes).has.lengthOf(2);
    });

    it('a support cube\'s touchdown lets the plaque draw it; a named zero is READ without a cube; both are the plaque\'s reading', () => {
      seeded();
      expect(rallySupportReading(R), 'not reached yet — nothing read').is.undefined;
      rallySupportLanded(RALLY.support[0]);
      expect(rallySupportIncoming(R)).eq(0);
      expect(rallySupportReading(R)).deep.eq({current: 1, resulting: 2, available: true});
      rallySupportRead(RALLY.support[1]);
      expect(rallySupportReading(M)).deep.eq({current: 3, resulting: 3, available: false, reason: '+0 · the area is full'});
      expect(rallySupportReading(U), 'a party the rally does not name reads nothing').is.undefined;
      expect(neutralRallyFlow.readSupport.map((s) => s.party)).deep.eq([R, M]);
    });

    it('the recount marks one key per tick — the number is the SIZE of the marks, never a sum the client computed', () => {
      seeded();
      rallyCounted(rallyVoteKey(HC, 3));
      rallyCounted(rallyVoteKey(HC, 3));
      rallyCounted(rallyPlaceKey(M, 1));
      rallyCounted(rallyPlaceKey(M, 2));
      expect(neutralRallyFlow.counted).eq(3);
      expect(rallyMarked(rallyVoteKey(HC, 3))).is.true;
      expect(rallyMarked(rallyVoteKey(HC, 11))).is.false;
      expect(rallyCountedPlaces(M)).eq(2);
      expect(rallyCountedPlaces(R)).eq(0);
    });

    it('the winning marker as SHOWN follows the hold — the live model is not read while a rally stands', () => {
      seeded();
      const hc = {instance: HC, isWinning: true} as unknown as ParliamentSlotVm;
      const ac = {instance: AC, isWinning: false} as unknown as ParliamentSlotVm;
      expect(winningShownOf(hc), 'the model says HC wins — the hold says not yet').is.false;
      expect(winningShownOf(ac)).is.true;
      rallyVoteLanded(RALLY.votes[0]);
      expect(winningShownOf(hc)).is.true;
      expect(winningShownOf(ac)).is.false;
      releaseNeutralRallyHolds('done');
      expect(winningShownOf(hc), 'no rally — the model answers').is.true;
    });
  });

  describe('THE CONCLUSION reads the rally — owed, then live — through the hosted step\'s one pair', () => {
    it('promised → owed; seeded → owed until the pose opens; live → a live outcome; done → nothing', () => {
      promiseNeutralRally(CARD, 'hand', PRICE);
      expect(neutralRallyOwedTo('hand')).is.true;
      expect(hostedStepOwedTo('hand')).is.true;
      expect(neutralRallyOwedTo('parliament')).is.false;
      handDescended();
      const {before, after} = pair();
      seedNeutralRallyHolds(before, after);
      expect(neutralRallyOwedTo('hand'), 'arrived, the pose not opened yet').is.true;
      expect(hostedStepToEnter(), 'the landing scene\'s closing enters the rally').eq('rally');
      neutralRallyFlow.live = true;
      neutralRallyFlow.beat = 'votes';
      expect(neutralRallyOwedTo('hand')).is.false;
      expect(neutralRallyLiveIn('hand')).is.true;
      expect(hostedStepLiveIn('hand')).is.true;
      expect(hostedStepLiveBeat('hand')).eq('rally-live:votes');
      expect(hostedStepToEnter(), 'already live').is.undefined;
      neutralRallyFlow.beat = 'read';
      expect(neutralRallyLiveIn('hand')).is.true;
      neutralRallyFlow.beat = 'done';
      expect(neutralRallyLiveIn('hand')).is.false;
      expect(neutralRallyOwedTo('hand')).is.false;
    });

    it('a WALK owed to the hand is entered first — a card walks OR rallies, and the two never share one answer today', () => {
      handDescended();
      agendaWalkFlow.owed = {player: BLUE, from: 1, to: 2, steps: [{to: 2}], seq: 1, card: CARD, generation: 3, host: 'hand'};
      const {before, after} = pair();
      seedNeutralRallyHolds(before, after);
      expect(hostedStepToEnter()).eq('walk');
    });

    it('a refused play drops every promise; RELEASE lets every hold go and forgets the rally', () => {
      promiseNeutralRally(CARD, 'hand', PRICE);
      dropHostedStepPromises();
      expect(neutralRallyOwedTo('hand')).is.false;
      dropNeutralRallyPromise();
      handDescended();
      promiseNeutralRally(CARD, 'hand', PRICE);
      const {before, after} = pair();
      seedNeutralRallyHolds(before, after);
      neutralRallyFlow.live = true;
      releaseNeutralRallyHolds('unmount');
      expect(parliamentHolds.hiddenCubes.size).eq(0);
      expect(rallyPoolHeld()).eq(0);
      expect(rallySupportIncoming(R)).eq(0);
      expect(rallyWinnerShown()).is.undefined;
      expect(railRewardPending(NEUTRAL_RALLY_RAIL_KEY)).is.false;
      expect(neutralRallyFlow.owed).is.undefined;
      expect(neutralRallyFlow.live).is.false;
    });
  });

  describe('THE PHRASE — votes → support → the recount → the coin → the read, in the record\'s order', () => {
    it('the recount\'s order is the record\'s: the ribbons by slot, then the areas\' places — and the list IS the number', () => {
      const order = rallyCountOrder(RALLY);
      expect(order.map((item) => item.key)).deep.eq([
        rallyVoteKey(HC, 3), rallyVoteKey(HC, 11), rallyVoteKey(AA, 5), rallyVoteKey(AA, 6), rallyVoteKey(AA, 12), rallyVoteKey(AC, 9), rallyVoteKey(AC, 10),
        rallyPlaceKey(M, 1), rallyPlaceKey(M, 2), rallyPlaceKey(M, 3), rallyPlaceKey(R, 1), rallyPlaceKey(R, 2), rallyPlaceKey(U, 1), rallyPlaceKey(U, 2),
      ]);
      expect(order).has.lengthOf(RALLY.inUse.after);
    });

    it('fourteen marks fit the budget: ≈ 1.7 s of ticks (decision 5), one task per tick', () => {
      expect(RALLY_COUNT_TICK_MS * 14).to.be.lessThan(2000);
      const budget = neutralRallyBudgetMs(RALLY, 480);
      expect(budget).eq(2 * (480 + RALLY_CUBE_GAP_MS) + (480 + RALLY_CUBE_GAP_MS) + SUPPORT_CUBE_STAGGER_MS + RALLY_COUNT_LEAD_MS + 14 * RALLY_COUNT_TICK_MS);
      expect(neutralRallyHoldMs(RALLY)).to.be.greaterThan(budget + RALLY_READ_MS);
    });

    it('THE ORDER: a cube lifts, lands, the next one waits a gap; an area that takes none is READ for a beat; the recount ticks each key on the clock; the coin is born on the kicker; the read ends it', () => {
      const trail: Array<string> = [];
      const asked: Array<number> = [];
      const beat: RallyBeatScheduler = (ms, fire) => {
        asked.push(ms);
        fire();
        return {kill: () => undefined};
      };
      let coinResolve: (() => void) | undefined;
      const handle = runNeutralRally(RALLY, {
        beat,
        pool: () => ({left: 0, top: 0, width: 10, height: 10}),
        votePlace: (vote) => ({left: 100, top: vote.seq, width: 10, height: 10}),
        supportPlace: (_party, place) => ({left: 200, top: place, width: 10, height: 10}),
        fly: (_from, to, onLanded, onLifted) => {
          trail.push(`fly:${to?.left}:${to?.top}`);
          onLifted();
          onLanded();
          return `f${trail.length}`;
        },
        coinOrigin: () => ({x: 5, y: 5}),
        coin: () => new Promise<void>((resolve) => {
          trail.push('coin');
          coinResolve = resolve;
        }),
        onBeat: (b) => trail.push(`beat:${b}`),
        onLifted: () => trail.push('lift'),
        onVoteLanded: (vote) => trail.push(`vote:${vote.instance}`),
        onSupportLanded: (entry) => trail.push(`support:${entry.party}`),
        onSupportRead: (entry) => trail.push(`read:${entry.party}`),
        onCounted: (item) => trail.push(`count:${item.key}`),
        onDegraded: (why) => trail.push(`degraded:${why}`),
        onDone: () => trail.push('done'),
      });
      expect(trail.slice(0, 9)).deep.eq([
        'beat:votes', 'fly:100:11', 'lift', `vote:${HC}`, 'fly:100:12', 'lift', `vote:${AA}`,
        'beat:support', 'fly:200:2',
      ]);
      expect(trail.slice(9, 13)).deep.eq(['lift', `support:${R}`, `read:${M}`, 'beat:count']);
      const counts = trail.filter((t) => t.startsWith('count:'));
      expect(counts).has.lengthOf(14);
      expect(counts[0]).eq(`count:${rallyVoteKey(HC, 3)}`);
      expect(counts[13]).eq(`count:${rallyPlaceKey(U, 2)}`);
      expect(trail[trail.length - 2], 'the coin is asked once the recount is over').eq('beat:coin');
      expect(trail[trail.length - 1]).eq('coin');
      expect(asked.filter((ms) => ms === RALLY_COUNT_TICK_MS), 'one beat per mark — a task per tick').has.lengthOf(14);
      expect(asked).includes(SUPPORT_CUBE_STAGGER_MS);
      expect(asked).includes(RALLY_COUNT_LEAD_MS);
      expect(handle.active(), 'the coin is in the air').is.true;
      expect(handle.flights).has.lengthOf(3);
      coinResolve?.();
      return new Promise<void>((resolve) => setTimeout(resolve, 0)).then(() => {
        expect(trail.slice(-2)).deep.eq(['beat:read', 'done']);
        expect(asked[asked.length - 1]).eq(RALLY_READ_MS);
        expect(handle.active()).is.false;
      });
    });

    it('a place that cannot be measured is NAMED, never silent — and the cube still lands', () => {
      const trail: Array<string> = [];
      runNeutralRally({...RALLY, support: [], counted: {votes: [], support: []}, megacredits: 0}, {
        beat: (_ms, fire) => {
          fire();
          return {kill: () => undefined};
        },
        pool: () => undefined,
        votePlace: () => ({left: 1, top: 1, width: 1, height: 1}),
        supportPlace: () => undefined,
        fly: (_from, _to, onLanded, onLifted) => {
          onLifted();
          onLanded();
          return undefined;
        },
        coinOrigin: () => undefined,
        coin: () => Promise.resolve(),
        onBeat: () => undefined,
        onLifted: () => undefined,
        onVoteLanded: (vote) => trail.push(`vote:${vote.instance}`),
        onSupportLanded: () => undefined,
        onSupportRead: () => undefined,
        onCounted: () => undefined,
        onDegraded: (why) => trail.push(`degraded:${why}`),
        onDone: () => undefined,
      });
      expect(trail[0]).match(/^degraded:vote RDX_REDS_HEAT_CAPTURE: the neutral supply has no measurable place/);
      expect(trail).includes(`vote:${HC}`);
    });

    it('SKIP tears the pending beats down: nothing fires after it', () => {
      const trail: Array<string> = [];
      let fire: (() => void) | undefined;
      const handle = runNeutralRally(RALLY, {
        beat: (_ms, f) => {
          fire = f;
          return {kill: () => {
            fire = undefined;
          }};
        },
        pool: () => undefined,
        votePlace: () => undefined,
        supportPlace: () => undefined,
        fly: (_from, _to, onLanded) => {
          onLanded();
          return undefined;
        },
        coinOrigin: () => undefined,
        coin: () => Promise.resolve(),
        onBeat: (b) => trail.push(b),
        onLifted: () => undefined,
        onVoteLanded: (vote) => trail.push(`vote:${vote.instance}`),
        onSupportLanded: () => undefined,
        onSupportRead: () => undefined,
        onCounted: () => undefined,
        onDegraded: () => undefined,
        onDone: () => trail.push('done'),
      });
      expect(trail).deep.eq(['votes', `vote:${HC}`]);
      handle.skip();
      handle.skip();
      expect(fire, 'the pending gap was killed').is.undefined;
      expect(handle.active()).is.false;
      expect(trail).deep.eq(['votes', `vote:${HC}`]);
    });
  });

  describe('THE CRUMB, THE BAND and THE COMPOSER', () => {
    it('the rally\'s stage is one word, past the commit — the same key the hosted frame is pushed with', () => {
      parliamentFlow.stage = 'rally';
      expect(parliamentCrumbStage('', '')).eq('Delegates');
      expect(parliamentCrumbStage('', '')).eq(NEUTRAL_RALLY_STAGE_KEY);
      expect(NEUTRAL_RALLY_STEP_STAGE).eq(NEUTRAL_RALLY_STAGE_KEY);
      expect(parliamentCrumbCommitted()).is.true;
    });

    it('the band reads the beats as they land: the neutral cube, a resolution chip per landed vote, a party chip per read area (its named zero in the quiet register), the count once the recount has begun — its key never ticking with the count', () => {
      const none = parliamentBandLine({standing: {votes: 0}, rally: {votes: [], support: [], counted: undefined}});
      expect(none.kicker).eq('Neutral delegates');
      expect(none.chips).deep.eq([{kind: 'player', player: 'neutral'}]);
      expect(none.committed).is.true;
      const one = parliamentBandLine({standing: {votes: 0}, rally: {votes: [{resolution: 'RDX_REDS_HEAT_CAPTURE', party: R}], support: [], counted: undefined}});
      expect(one.chips[1]).deep.eq({kind: 'resolution', resolution: 'RDX_REDS_HEAT_CAPTURE', party: R});
      expect(one.key).not.eq(none.key);
      const read = parliamentBandLine({standing: {votes: 0}, rally: {votes: [], support: [{party: R, gained: 1}, {party: M, gained: 0, limit: 'area'}], counted: undefined}});
      expect(read.chips.slice(1)).deep.eq([{kind: 'party', party: R}, {kind: 'party', party: M}, {kind: 'label', key: 'area is full', tone: 'quiet'}]);
      const counting = parliamentBandLine({standing: {votes: 0}, rally: {votes: [], support: [], counted: 3}});
      const counted = parliamentBandLine({standing: {votes: 0}, rally: {votes: [], support: [], counted: 9}});
      expect(counting.chips[1]).deep.eq({kind: 'count', key: 'in use', amount: 3, id: RALLY_COUNT_CHIP_ID});
      expect(counted.key, 'the number ticks in place — the line does not crossfade per mark').eq(counting.key);
      expect(counted.key).not.eq(none.key);
    });

    it('the SHOW step is not a door: the CTA stays «Play card», the play submits as any other', () => {
      const rally = {parties: [R, M], votes: [], missing: [R, M], support: [], supply: {before: 3, after: 1}, inUse: {before: 11, after: 13}, megacredits: 13} as NeutralRallyModel;
      const branch = {index: -1, title: '', available: true, renderKeys: [], effects: [], steps: [{kind: 'neutralRally', rally}]} as unknown as ActionPreviewBranch;
      expect(playDoorOf(branch)).is.undefined;
      expect(playCommitVerb(playDoorOf(branch))).eq('Play card');
    });

    it('the landing scene delivers NONE of the rally\'s chips — the neutral delegates are the Parliament\'s cubes, the M€ the recount\'s coin; the walk keeps its own law', () => {
      const rally = {parties: [R, M], votes: [], missing: [], support: [], supply: {before: 3, after: 0}, inUse: {before: 11, after: 14}, megacredits: 14} as NeutralRallyModel;
      const effects = [
        {direction: 'gain', icon: 'neutral-delegate', amount: 2, note: 'on resolutions'},
        {direction: 'gain', icon: 'neutral-delegate', amount: 1, note: 'to Popular Support'},
        {direction: 'gain', icon: 'megacredits', amount: 14, current: 10, resulting: 24},
        {direction: 'gain', icon: 'tr', amount: 1, current: 20, resulting: 21},
      ];
      const withRally = {index: -1, title: '', available: true, renderKeys: [], effects, steps: [{kind: 'neutralRally', rally}]} as unknown as ActionPreviewBranch;
      expect(heroRewardEffectsOf(withRally).map((e) => `${e.direction}:${e.icon}`)).deep.eq(['gain:tr']);
      const plain = {...withRally, steps: []} as unknown as ActionPreviewBranch;
      expect(heroRewardEffectsOf(plain)).deep.eq(effects);
    });
  });
});
