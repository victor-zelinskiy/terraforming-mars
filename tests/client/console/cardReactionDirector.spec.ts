import {expect} from 'chai';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {Resource} from '@/common/Resource';
import {CardReactionRecord} from '@/common/models/CardReactionModel';
import {RailAnswerFlight} from '@/client/console/resourceTransfer/railReward';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  beginPanelRewardHold, clearPanelRewardHold, declareHeldAnswers, heldProduction, heldStock, releasePanelRewardHold,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {
  cardReactionAnswerFlight, cardReactionHurried, cardReactionPending, composeAnswerFlights, cutCardReactions, hurryCardReactions, markReactionCause,
  resetCardReactions, rivalReactionPending, rivalSpecsOf, seedCardReactionHolds, snapshotRailHolds,
} from '@/client/console/cardReaction/cardReactionDirector';
import {reactionGroupOf} from '@/client/console/cardReaction/cardReactionModel';
import {cardReactionState} from '@/client/console/cardReaction/cardReactionStage';
import {reduceMotionOverrideState} from '@/client/utils/reducedMotion';

/*
 * «СРАБАТЫВАНИЕ КАРТЫ — ОДИН ФРЕЙМВОРК» — the director's two shapes without a stage: a record whose rows a host
 * holds is ATTACHED (the host's flight asks for the reactor; the tokens are the record's shares; a missing face
 * degrades by name, nothing hangs); a record nobody holds is STANDALONE (held here, released by the chain — or at
 * once by A / B); a record is claimed once; reduced motion holds nothing.
 */
const BLUE = 'blue';

function record(seq: number, over: Partial<CardReactionRecord> = {}): CardReactionRecord {
  return {
    seq, root: {}, owner: BLUE, kind: 'corporation', card: CardName.HARTLAN_HEATING, channel: 'card-played',
    impacts: [{kind: 'stock', resource: Resource.HEAT, amount: 6, to: BLUE}, {kind: 'production', resource: Resource.MEGACREDITS, amount: 1, to: BLUE}],
    ...over,
  };
}

function view(reactions: ReadonlyArray<CardReactionRecord>, id = 'p-viewer'): PlayerViewModel {
  return {
    id,
    thisPlayer: {color: BLUE, tableau: []},
    game: {cardReactions: reactions},
  } as unknown as PlayerViewModel;
}

describe('cardReactionDirector — attached to a host, or standalone', () => {
  afterEach(() => {
    reduceMotionOverrideState.enabled = false;
    resetCardReactions();
    clearPanelRewardHold();
  });

  it('a record nobody holds is held HERE (the rows keep their pre-reaction value) and a CUT releases it at once', () => {
    const before = snapshotRailHolds();
    seedCardReactionHolds(view([]), view([record(1)]), before);
    expect(heldStock('heat'), 'the heat row is held for the chain').eq(6);
    expect(heldProduction('megacredits')).eq(1);
    expect(cardReactionPending()).is.true;
    cutCardReactions();
    expect(heldStock('heat')).eq(0);
    expect(heldProduction('megacredits')).eq(0);
    expect(cardReactionPending()).is.false;
  });

  it('a HURRY is a pace, never a cut (the owner, 2026-10-27): the first press keeps every hold and the chain; the same gesture reported twice is one hurry; a LATER second press completes at once', () => {
    const before = snapshotRailHolds();
    seedCardReactionHolds(view([]), view([record(60)]), before);
    expect(heldStock('heat')).eq(6);
    hurryCardReactions('press');
    expect(cardReactionHurried(), 'hurried').is.true;
    expect(cardReactionState.hurried).is.true;
    expect(heldStock('heat'), 'nothing released — the chain still plays, at the hurry pace').eq(6);
    expect(cardReactionPending()).is.true;
    // A press that opens a sheet reports as a press AND a navigation — within the window it is ONE gesture.
    hurryCardReactions('navigation');
    expect(heldStock('heat'), 'still held').eq(6);
    expect(cardReactionPending()).is.true;
    // A later press is the SECOND hurry: the cut.
    const realNow = performance.now;
    performance.now = () => realNow.call(performance) + 5000;
    try {
      hurryCardReactions('press');
    } finally {
      performance.now = realNow;
    }
    expect(heldStock('heat'), 'released at once').eq(0);
    expect(cardReactionPending()).is.false;
    expect(cardReactionHurried(), 'the hurry is forgotten with the chain').is.false;
  });

  it('a hurry with nothing playing is nothing', () => {
    hurryCardReactions('press');
    expect(cardReactionHurried()).is.false;
    expect(cardReactionState.hurried).is.false;
  });

  it('a record whose rows a host holds AS A PROMISED ANSWER is ATTACHED — nothing held here; the host\'s flight takes it, with the record\'s own tokens', async () => {
    const before = snapshotRailHolds();
    // The host (the play's rail half) seeded its answer in this very block — and DECLARED it as the table's answer.
    const answer: Array<ResourceTransferSpec> = [{channel: 'stock', resource: 'heat', amount: 6}, {channel: 'production', resource: 'megacredits', amount: 1}];
    beginPanelRewardHold(answer);
    declareHeldAnswers(answer);
    seedCardReactionHolds(view([]), view([record(2)]), before);
    expect(heldStock('heat'), 'held by the host, not twice').eq(6);
    expect(cardReactionPending(), 'nothing of ours stands').is.false;
    const flight = cardReactionAnswerFlight({rows: ['stock:heat', 'production:megacredits']});
    expect(flight, 'the host gets a flight').is.not.undefined;
    await flight?.prepare?.();
    // No stage in this bundle: the reactor cannot be painted — the group degrades BY NAME and the tokens tick.
    expect(cardReactionState.degraded).to.include(CardName.HARTLAN_HEATING);
    const tokens = flight?.tokensOf?.({channel: 'stock', resource: 'heat', amount: 6}) ?? [];
    expect(tokens.map((t) => t.amount), 'a wave of six off the printed heat').deep.eq([1, 1, 1, 1, 1, 1]);
    expect(flight?.originOf(tokens[0]), 'no face → no birth place (the row ticks)').is.undefined;
    flight?.onDone?.();
    // A second ask finds nothing — the record was claimed by the first flight.
    expect(cardReactionAnswerFlight({rows: ['stock:heat']})).is.undefined;
  });

  it('a host\'s OWN promise on the row (undeclared — a standard project\'s production step) never absorbs the reaction: it is standalone, held HERE on top', () => {
    const before = snapshotRailHolds();
    // The placement scene holds the city's own +1 M€ production; Tharsis' +1 on the same row is the RECORD's.
    beginPanelRewardHold([{channel: 'production', resource: 'megacredits', amount: 1}]);
    seedCardReactionHolds(view([]), view([record(30, {card: CardName.THARSIS_REPUBLIC, impacts: [
      {kind: 'production', resource: Resource.MEGACREDITS, amount: 1, to: BLUE}, {kind: 'stock', resource: Resource.MEGACREDITS, amount: 3, to: BLUE},
    ]})]), before);
    expect(heldProduction('megacredits'), 'the host\'s own step AND the reaction\'s share').eq(2);
    expect(heldStock('megacredits')).eq(3);
    expect(cardReactionPending(), 'the chain owns the share').is.true;
    expect(cardReactionAnswerFlight({rows: ['production:megacredits']}), 'nothing attached for a host to ask for').is.undefined;
    cutCardReactions();
    expect(heldProduction('megacredits'), 'the host\'s own hold stands untouched').eq(1);
  });

  it('a foreign scene\'s belt-and-braces clear (a tile scene\'s «safety» at its end) keeps the chain\'s holds — released only by its own touchdowns, A / B or the ceiling', () => {
    const before = snapshotRailHolds();
    seedCardReactionHolds(view([]), view([record(41)]), before);
    expect(heldStock('heat')).eq(6);
    clearPanelRewardHold();
    expect(heldStock('heat'), 'kept across the clear').eq(6);
    expect(heldProduction('megacredits'), 'kept across the clear').eq(1);
    cutCardReactions();
    clearPanelRewardHold();
    expect(heldStock('heat'), 'nothing kept once released').eq(0);
  });

  it('a foreign owner\'s LATE release after the clear takes nothing from the keeper (the staged seal\'s +3 production landing after the tile scene\'s safety)', () => {
    const before = snapshotRailHolds();
    seedCardReactionHolds(view([]), view([record(42)]), before); // heat 6 + 1 M€ production held here
    beginPanelRewardHold([{channel: 'production', resource: 'megacredits', amount: 3}]); // the seal's own
    expect(heldProduction('megacredits')).eq(4);
    clearPanelRewardHold(); // the tile scene's safety: the seal's 3 dropped, the keeper's 1 re-seeded
    expect(heldProduction('megacredits')).eq(1);
    releasePanelRewardHold({channel: 'production', resource: 'megacredits', amount: 3}); // the seal's token lands late
    expect(heldProduction('megacredits'), 'the keeper\'s row survives a foreign over-release').eq(1);
    cutCardReactions();
    expect(heldProduction('megacredits'), 'the keeper lets go on its own hurry').eq(0);
  });

  it('a declaration never outlives its block — an answer declared for one response does not attribute the next one\'s record', () => {
    const before = snapshotRailHolds();
    declareHeldAnswers([{channel: 'stock', resource: 'heat', amount: 6}]);
    seedCardReactionHolds(view([]), view([]), before); // the block with the declaration — no record
    seedCardReactionHolds(view([]), view([record(31)]), before); // the next block — the record stands alone
    expect(heldStock('heat'), 'held here, not attributed to a stale declaration').eq(6);
    expect(cardReactionPending()).is.true;
  });

  it('a held answer the reactors do not fully cover keeps the rest as one ticking token', () => {
    const before = snapshotRailHolds();
    const answer: Array<ResourceTransferSpec> = [{channel: 'stock', resource: 'megacredits', amount: 5}];
    beginPanelRewardHold(answer);
    declareHeldAnswers(answer);
    seedCardReactionHolds(view([]), view([record(3, {impacts: [{kind: 'stock', resource: Resource.MEGACREDITS, amount: 3, to: BLUE}]})]), before);
    const flight = cardReactionAnswerFlight();
    const tokens = flight?.tokensOf?.({channel: 'stock', resource: 'megacredits', amount: 5}) ?? [];
    expect(tokens.reduce((s, t) => s + t.amount, 0)).eq(5);
    expect(tokens[tokens.length - 1].amount, 'the party\'s 2 M€ the record does not name').eq(2);
  });

  it('a record is claimed ONCE — an echo frame seeds nothing; a rival\'s record is not the viewer\'s', () => {
    const before = snapshotRailHolds();
    const r = record(4);
    seedCardReactionHolds(view([]), view([r]), before);
    cutCardReactions();
    seedCardReactionHolds(view([]), view([r]), before);
    expect(heldStock('heat'), 'the echo held nothing').eq(0);
    seedCardReactionHolds(view([]), view([record(5, {owner: 'red'})]), before);
    expect(cardReactionPending()).is.false;
  });

  it('a RIVAL\'s record (PL-1057): nothing of the viewer\'s is held, its compact rise beside the seat chip is OWED — the gains addressed to that seat as its tokens; A / B lets it go', () => {
    const before = snapshotRailHolds();
    const rival = record(50, {owner: 'red', card: CardName.THARSIS_REPUBLIC, impacts: [
      {kind: 'production', resource: Resource.MEGACREDITS, amount: 1, to: 'red'}, {kind: 'stock', resource: Resource.MEGACREDITS, amount: 3, to: 'red'},
      {kind: 'draw', amount: 1, to: 'red'},
    ]});
    expect(rivalSpecsOf(reactionGroupOf(rival, BLUE)), 'the rival\'s stock and production — never a draw').deep.eq([
      {channel: 'production', resource: 'megacredits', amount: 1}, {channel: 'stock', resource: 'megacredits', amount: 3},
    ]);
    seedCardReactionHolds(view([]), view([rival]), before);
    expect(heldStock('megacredits'), 'nothing of the viewer\'s held').eq(0);
    expect(heldProduction('megacredits')).eq(0);
    expect(rivalReactionPending(), 'the rival\'s rise is owed').is.true;
    expect(cardReactionPending()).is.true;
    cutCardReactions();
    expect(rivalReactionPending()).is.false;
    expect(cardReactionPending()).is.false;
  });

  it('reduced motion claims the record and holds nothing', () => {
    reduceMotionOverrideState.enabled = true;
    const before = snapshotRailHolds();
    seedCardReactionHolds(view([]), view([record(6)]), before);
    expect(heldStock('heat')).eq(0);
    expect(cardReactionPending()).is.false;
    expect(cardReactionAnswerFlight()).is.undefined;
  });

  it('the first view of a seat is not a reaction (a reload), and a draw-only record has nothing for the rail', () => {
    const before = snapshotRailHolds();
    seedCardReactionHolds(undefined, view([record(7)]), before);
    expect(cardReactionPending()).is.false;
    seedCardReactionHolds(view([]), view([record(8, {impacts: [{kind: 'draw', amount: 1, to: BLUE}]})]), before);
    expect(cardReactionPending()).is.false;
  });

  describe('composeAnswerFlights — the reactor first, the cause\'s own birth as the fallback', () => {
    const point = {x: 1, y: 2};
    const flight = (origin: boolean, log: Array<string>, name: string): RailAnswerFlight => ({
      originOf: () => (origin ? point : undefined),
      onLeft: () => log.push(`${name}:left`),
      prepare: async () => {
        log.push(`${name}:prepare`);
      },
      onDone: () => log.push(`${name}:done`),
    });

    it('the primary answers; the fallback takes what it declines; prepare / onLeft / onDone reach both', async () => {
      const log: Array<string> = [];
      const both = composeAnswerFlights(flight(false, log, 'reactor'), flight(true, log, 'tag'));
      expect(both?.originOf({channel: 'stock', resource: 'heat', amount: 1})).eq(point);
      await both?.prepare?.();
      both?.onLeft();
      both?.onDone?.();
      expect(log).deep.eq(['reactor:prepare', 'tag:prepare', 'reactor:left', 'tag:left', 'reactor:done', 'tag:done']);
    });

    it('one side alone is itself; neither is nothing', () => {
      const log: Array<string> = [];
      const only = flight(true, log, 'x');
      expect(composeAnswerFlights(only, undefined)).eq(only);
      expect(composeAnswerFlights(undefined, only)).eq(only);
      expect(composeAnswerFlights(undefined, undefined)).is.undefined;
    });
  });

  it('markReactionCause — a one-shot attribute on the cause, never on nothing', () => {
    const el = document.createElement('span');
    markReactionCause(el);
    expect(el.getAttribute('data-reaction-cause')).eq('1');
    markReactionCause(undefined);
    markReactionCause(null);
  });
});
