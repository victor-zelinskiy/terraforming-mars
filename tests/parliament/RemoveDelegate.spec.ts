import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  DELEGATE_GONE_REASON, EXCHANGE_DELEGATE_TITLE, NO_DELEGATE_IN_RESERVE_REASON, NO_DELEGATE_ON_TABLE_REASON, NO_NEUTRAL_ON_RESOLUTION_REASON,
  REMOVE_DELEGATE_TITLE, RemoveDelegate,
} from '../../src/server/parliament/RemoveDelegate';
import {SelectPartyDelegate} from '../../src/server/inputs/SelectPartyDelegate';
import {Server} from '../../src/server/models/ServerModel';
import {ChoiceContextSource, DelegateTargetProjection, SelectPartyModel} from '../../src/common/models/PlayerInputModel';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {DELEGATE_EXCHANGE_LABEL, DELEGATE_REMOVAL_LABEL, PARLIAMENT_DELEGATES_PER_PLAYER, REDUX_PARTIES} from '../../src/common/parliament/ParliamentTypes';
import {cast} from '../../src/common/utils/utils';
import {fakeCard, runAllActions} from '../TestingUtils';
import {quietResolutionOf, seatResolution} from './parliamentArrange';

/**
 * THE SHARED STEP «REMOVE ANY DELEGATE FROM A RESOLUTION OR POPULAR SUPPORT AREA» (Turmoil Redux TR72 Banned
 * Delegate:redux): the two ledger operations it stands on (`removeVote`, `removePopularSupport`), every figure
 * on the marker with the server's forecast, the read-only twin, the answer and what it moves, the named skip
 * when the figure is gone, and what the step never does (the sitting's hook).
 */
const G = PartyName.GREENS;
const M = PartyName.MARS;
const I = PartyName.INDUSTRIALISTS;
const CARD = 'A card that bans a delegate' as CardName;
const GIVER: ChoiceContextSource = {kind: 'card', card: CARD};

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament};

/**
 * Three resolutions up for a vote — Greens, Mars First, Industrialists (Greens rule: nothing enacted) — and:
 *  · Greens:          p1, p2, p2   (p2 leads 2–1 and the card wins the sitting 3 votes to 2);
 *  · Mars First:      neutral, neutral;
 *  · Industrialists:  p1, p1        (p1 holds the Industrialists' effect by their own two delegates);
 *  · Mars First's support area holds 2.
 */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  ([G, M, I] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  for (const party of REDUX_PARTIES) {
    parliament.popularSupport.set(party, 0);
  }
  parliament.lobby.clear();
  const [green, mars, industry] = parliament.slots;
  parliament.placeVote(p1, green, 'reserve');
  parliament.placeVote(p2, green, 'reserve');
  parliament.placeVote(p2, green, 'reserve');
  parliament.addNeutralVote(mars);
  parliament.addNeutralVote(mars);
  parliament.placeVote(p1, industry, 'reserve');
  parliament.placeVote(p1, industry, 'reserve');
  parliament.popularSupport.set(M, 2);
  return {game, p1, p2, parliament};
}

function ask(t: Table): SelectPartyDelegate {
  t.game.defer(new RemoveDelegate(t.p1, GIVER));
  runAllActions(t.game);
  return cast(t.p1.getWaitingFor(), SelectPartyDelegate);
}

function row(targets: ReadonlyArray<DelegateTargetProjection>, party: PartyName, place: 'resolution' | 'support', owner: string): DelegateTargetProjection {
  const found = targets.find((r) => r.party === party && r.place === place && r.owner === owner);
  expect(found, `${place} ${party} ${owner}`).is.not.undefined;
  return found!;
}

describe('RemoveDelegate — one delegate leaves the table', () => {
  describe('the ledger operations', () => {
    it('removeVote takes the owner\'s LATEST cube — any seat\'s or the neutral player\'s — and the ledger re-derives', () => {
      const {p2, parliament} = table();
      const green = parliament.slots[0];
      const reserveBefore = parliament.reserve(p2);
      const [earliest, latest] = green.votes.filter((v) => v.owner === p2.id);
      expect(parliament.removeVote(green, p2.id)).deep.eq(latest);
      expect(green.votes.filter((v) => v.owner === p2.id)).deep.eq([earliest]);
      expect(parliament.reserve(p2)).eq(reserveBefore + 1);

      const mars = parliament.slots[1];
      const supply = parliament.neutralSupply();
      expect(parliament.removeVote(mars, 'NEUTRAL')?.owner).eq('NEUTRAL');
      expect(parliament.neutralSupply()).eq(supply + 1);
      expect(parliament.removeVote(parliament.slots[2], 'NEUTRAL'), 'nobody\'s cube there').is.undefined;
    });

    it('removeLatestVote is removeVote for the seat — the chairman\'s own road, unchanged', () => {
      const {p1, parliament} = table();
      const industry = parliament.slots[2];
      const seqs = industry.votes.map((v) => v.seq);
      expect(parliament.removeLatestVote(p1, industry)?.seq).eq(seqs[1]);
      expect(industry.votes.map((v) => v.seq)).deep.eq([seqs[0]]);
    });

    it('removePopularSupport returns ONE neutral cube (never below zero) to the supply', () => {
      const {parliament} = table();
      const supply = parliament.neutralSupply();
      expect(parliament.removePopularSupport(M, 1)).eq(1);
      expect(parliament.popularSupportOf(M)).eq(1);
      expect(parliament.neutralSupply()).eq(supply + 1);
      expect(parliament.removePopularSupport(G, 1), 'an empty area gives nothing').eq(0);
      expect(parliament.popularSupportOf(G)).eq(0);
    });

    it('withoutDelegate is a throwaway table — the live one is untouched', () => {
      const {p2, parliament} = table();
      const before = JSON.stringify(parliament.serialize());
      const copy = parliament.withoutDelegate(G, 'resolution', p2.id);
      expect(copy.votesOf(p2, copy.slots[0])).eq(1);
      expect(parliament.votesOf(p2, parliament.slots[0])).eq(2);
      parliament.withoutDelegate(M, 'support', 'NEUTRAL');
      expect(JSON.stringify(parliament.serialize())).eq(before);
    });
  });

  describe('the figures and their forecast', () => {
    it('one row per owner per resolution (the ledger\'s order), then each non-empty support area', () => {
      const t = table();
      const targets = RemoveDelegate.targetsOf(t.game, t.parliament);
      expect(targets.map((r) => [r.place, r.party, r.owner, r.count])).deep.eq([
        ['resolution', G, t.p1.color, 1],
        ['resolution', G, t.p2.color, 2],
        ['resolution', M, 'neutral', 2],
        ['resolution', I, t.p1.color, 2],
        ['support', M, 'neutral', 2],
      ]);
      expect(targets.map((r) => r.returnsTo)).deep.eq(['reserve', 'reserve', 'supply', 'reserve', 'supply']);
    });

    it('the leader\'s cube is a target (no «non-leader» clause): the forecast names the new leader and the new winner', () => {
      const t = table();
      const green = row(RemoveDelegate.targetsOf(t.game, t.parliament), G, 'resolution', t.p2.color);
      expect(green.total).deep.eq({current: 3, resulting: 2});
      // 1–1: the EARLIER first delegate leads — p1's.
      expect(green.leader).deep.eq({current: t.p2.color, resulting: t.p1.color});
      // Greens 3 → 2 ties the other two cards: the sitting's winner moves.
      expect(green.winner?.current).deep.eq({party: G, owner: t.p2.color});
      expect(green.winner?.resulting).is.not.undefined;
      expect(green.winner?.resulting).not.deep.eq(green.winner?.current);
    });

    it('a field of the forecast is present only when the answer changes it', () => {
      const t = table();
      const targets = RemoveDelegate.targetsOf(t.game, t.parliament);
      const p1Green = row(targets, G, 'resolution', t.p1.color);
      expect(p1Green.leader, 'p2 still leads').is.undefined;
      const support = row(targets, M, 'support', 'neutral');
      expect(support.total).deep.eq({current: 2, resulting: 1});
      expect(support.leader).is.undefined;
      expect(support.winner).is.undefined;
      expect(support.effectsLost).is.undefined;
    });

    it('the owner\'s party effect lost by the answer is named (their own delegates\' road)', () => {
      const t = table();
      expect(t.parliament.access(t.p1, I).byDelegates).is.true;
      const industry = row(RemoveDelegate.targetsOf(t.game, t.parliament), I, 'resolution', t.p1.color);
      expect(industry.effectsLost).deep.eq([I]);
      // 2 → 1 on the only card: the leader stays p1.
      expect(industry.leader).is.undefined;
    });

    it('a neutral cube on a resolution is a target; it goes to the supply and moves no access', () => {
      const t = table();
      const mars = row(RemoveDelegate.targetsOf(t.game, t.parliament), M, 'resolution', 'neutral');
      expect(mars.returnsTo).eq('supply');
      expect(mars.effectsLost).is.undefined;
    });

    it('the enacted card, the chair and the lobby are no places', () => {
      const t = table();
      t.parliament.chairman = t.p2.id;
      t.parliament.lobby.add(t.p1.id);
      const targets = RemoveDelegate.targetsOf(t.game, t.parliament);
      expect(targets).has.lengthOf(5);
    });
  });

  describe('the prompt', () => {
    it('a party prompt marked `delegatePrompt`, with the giver as an attack', () => {
      const t = table();
      const prompt = ask(t);
      expect(prompt.type).eq('party');
      expect(prompt.title).eq(REMOVE_DELEGATE_TITLE);
      const model = Server.getWaitingFor(t.p1, prompt) as SelectPartyModel;
      expect(model.delegatePrompt?.source).eq('remove');
      expect(model.delegatePrompt?.targets).deep.eq(RemoveDelegate.targetsOf(t.game, t.parliament));
      expect(model.parties).deep.eq([G, M, I]);
      expect(model.choiceContext).deep.eq({source: GIVER, mode: 'attack'});
    });

    it('PREVIEW = EXECUTION: the read-only twin is the live model, and asking it changes nothing', () => {
      const t = table();
      const before = JSON.stringify(t.parliament.serialize());
      const twin = new RemoveDelegate(t.p1, GIVER).previewSelectParty();
      expect(JSON.stringify(t.parliament.serialize())).eq(before);
      const live = Server.getWaitingFor(t.p1, ask(t)) as SelectPartyModel;
      expect(twin?.delegatePrompt).deep.eq(live.delegatePrompt);
      expect(twin?.parties).deep.eq(live.parties);
      expect(twin?.title).eq(live.title);
      expect(twin?.choiceContext).deep.eq(live.choiceContext);
    });

    it('an empty table asks nothing — the twin is undefined and the live step names the skip', () => {
      const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      for (const party of REDUX_PARTIES) {
        parliament.popularSupport.set(party, 0);
      }
      expect(RemoveDelegate.targetsOf(game, parliament)).deep.eq([]);
      expect(new RemoveDelegate(p1, GIVER).previewSelectParty()).is.undefined;
      game.defer(new RemoveDelegate(p1, GIVER));
      runAllActions(game);
      expect(p1.getWaitingFor()).is.undefined;
      const skipped = game.events.events.find((e) => e.type === 'effect-skipped');
      expect(skipped?.impact.skipped).deep.eq({label: DELEGATE_REMOVAL_LABEL, reason: NO_DELEGATE_ON_TABLE_REASON});
    });

    it('refuses an answer with no delegate, or naming a figure that is not on offer', () => {
      const t = table();
      ask(t);
      expect(() => t.p1.process({type: 'party', partyName: G})).to.throw(/No delegate selected/);
      expect(() => t.p1.process({type: 'party', partyName: G, delegate: {place: 'resolution', owner: 'neutral'}})).to.throw(/Invalid delegate/);
      expect(() => t.p1.process({type: 'party', partyName: G, delegate: {place: 'support', owner: 'neutral'}})).to.throw(/Invalid delegate/);
    });
  });

  describe('the answer', () => {
    it('an opponent\'s cube: their latest leaves for their reserve; the line, the event with the victim, the record', () => {
      const t = table();
      ask(t);
      const seqs = t.parliament.slots[0].votes.filter((v) => v.owner === t.p2.id).map((v) => v.seq);
      const reserve = t.parliament.reserve(t.p2);
      t.p1.process({type: 'party', partyName: G, delegate: {place: 'resolution', owner: t.p2.color}});
      runAllActions(t.game);
      expect(t.parliament.slots[0].votes.filter((v) => v.owner === t.p2.id).map((v) => v.seq)).deep.eq([seqs[0]]);
      expect(t.parliament.reserve(t.p2)).eq(reserve + 1);
      expect(t.parliament.reserve(t.p2)).lte(PARLIAMENT_DELEGATES_PER_PLAYER);
      expect(t.parliament.leaderOf(t.parliament.slots[0])?.owner).eq(t.p1.id);
      const event = t.game.events.events.find((e) => e.type === 'delegate-removed');
      expect(event?.player).eq(t.p1.color);
      expect(event?.target).deep.eq({player: t.p2.color});
      expect(event?.impact.delegateRemoved).deep.include({place: 'resolution', party: G, owner: t.p2.color, returnsTo: 'reserve', total: 2});
      const log = t.game.gameLog.find((l) => l.message === '${0} removed a delegate of ${1} from ${2}');
      expect(log).is.not.undefined;
      expect(t.parliament.lastRemoval).deep.include({player: t.p1.id, card: CARD, place: 'resolution', party: G, owner: t.p2.color, vote: seqs[1], returnsTo: 'reserve', total: 2});
      t.parliament.assertLedger(t.game);
    });

    it('the player\'s own cube: no victim — and the lost effect is announced by the access diff', () => {
      const t = table();
      ask(t);
      t.p1.process({type: 'party', partyName: I, delegate: {place: 'resolution', owner: t.p1.color}});
      runAllActions(t.game);
      const event = t.game.events.events.find((e) => e.type === 'delegate-removed');
      expect(event?.target).is.undefined;
      expect(t.game.gameLog.some((l) => l.message === '${0} removed their own delegate from ${1}')).is.true;
      expect(t.parliament.access(t.p1, I).byDelegates).is.false;
    });

    it('a neutral cube on a resolution goes to the supply; a support cube leaves its area', () => {
      const t = table();
      const supply = t.parliament.neutralSupply();
      ask(t);
      t.p1.process({type: 'party', partyName: M, delegate: {place: 'resolution', owner: 'neutral'}});
      runAllActions(t.game);
      expect(t.parliament.neutralVotes(t.parliament.slots[1])).eq(1);
      expect(t.parliament.neutralSupply()).eq(supply + 1);
      expect(t.game.events.events.find((e) => e.type === 'delegate-removed')?.target).is.undefined;

      ask(t);
      t.p1.process({type: 'party', partyName: M, delegate: {place: 'support', owner: 'neutral'}});
      runAllActions(t.game);
      expect(t.parliament.popularSupportOf(M)).eq(1);
      expect(t.parliament.neutralSupply()).eq(supply + 2);
      expect(t.parliament.lastRemoval).deep.include({place: 'support', party: M, owner: 'neutral', returnsTo: 'supply', total: 1});
      expect(t.parliament.lastRemoval?.vote).is.undefined;
    });

    it('a figure gone between the pick and the answer is the named skip, never a silent nothing', () => {
      const t = table();
      ask(t);
      t.parliament.popularSupport.set(M, 0);
      t.p1.process({type: 'party', partyName: M, delegate: {place: 'support', owner: 'neutral'}});
      runAllActions(t.game);
      const skipped = t.game.events.events.find((e) => e.type === 'effect-skipped');
      expect(skipped?.impact.skipped).deep.eq({label: DELEGATE_REMOVAL_LABEL, reason: DELEGATE_GONE_REASON});
      expect(t.game.events.events.some((e) => e.type === 'delegate-removed')).is.false;
    });

    it('never calls the sitting\'s `onDelegatesDiscarded`', () => {
      const t = table();
      let calls = 0;
      t.p2.playedCards.push(fakeCard({onDelegatesDiscarded: () => {
        calls++;
      }}));
      ask(t);
      t.p1.process({type: 'party', partyName: G, delegate: {place: 'resolution', owner: t.p2.color}});
      runAllActions(t.game);
      expect(calls).eq(0);
    });

    it('MarsBot never gets the prompt: the first figure of the table\'s order goes', () => {
      const t = table();
      const bot = t.p2 as unknown as {isMarsBot: boolean};
      Object.defineProperty(bot, 'isMarsBot', {value: true});
      t.game.defer(new RemoveDelegate(t.p2, GIVER));
      runAllActions(t.game);
      expect(t.p2.getWaitingFor()).is.undefined;
      expect(t.parliament.votesOf(t.p1, t.parliament.slots[0])).eq(0);
    });
  });
});

/**
 * THE EXCHANGE (`{source: 'exchange'}` — Turmoil Redux TR74 Recruitment:redux): the same pick narrowed to the NEUTRAL
 * figures on the bills, and a second move — the player's own delegate from the reserve onto the same bill.
 */
describe('RemoveDelegate — the exchange (a neutral delegate for one of your own)', () => {
  const EXCHANGE = {source: 'exchange'} as const;

  function askExchange(t: Table): SelectPartyDelegate {
    t.game.defer(new RemoveDelegate(t.p1, GIVER, EXCHANGE));
    runAllActions(t.game);
    return cast(t.p1.getWaitingFor(), SelectPartyDelegate);
  }

  describe('the figures', () => {
    it('ONLY the neutral cubes on the bills — never a seat\'s, never a support area', () => {
      const t = table();
      t.parliament.addNeutralVote(t.parliament.slots[0]);
      const targets = RemoveDelegate.exchangeTargetsOf(t.p1, t.parliament);
      expect(targets.map((r) => [r.place, r.party, r.owner, r.count, r.returnsTo])).deep.eq([
        ['resolution', G, 'neutral', 1, 'supply'],
        ['resolution', M, 'neutral', 2, 'supply'],
      ]);
    });

    it('the forecast reads the table after BOTH moves: the votes stay, my delegates 0 → 1, the neutral lead passes to me', () => {
      const t = table();
      const mars = row(RemoveDelegate.exchangeTargetsOf(t.p1, t.parliament), M, 'resolution', 'neutral');
      expect(mars.total).deep.eq({current: 2, resulting: 2});
      expect(mars.arrives).deep.eq({owner: t.p1.color, count: {current: 0, resulting: 1}});
      // A bill of neutral cubes alone is led by the neutral player; after the exchange p1 is its only seat.
      expect(mars.leader).deep.eq({current: 'neutral', resulting: t.p1.color});
      expect(mars.effectsGained).is.undefined;
      expect(mars.effectsLost).is.undefined;
    });

    it('a SECOND delegate of mine opens the party\'s effect — the forecast names it', () => {
      const t = table();
      t.parliament.placeVote(t.p1, t.parliament.slots[1], 'reserve');
      const mars = row(RemoveDelegate.exchangeTargetsOf(t.p1, t.parliament), M, 'resolution', 'neutral');
      expect(mars.arrives?.count).deep.eq({current: 1, resulting: 2});
      expect(mars.effectsGained).deep.eq([M]);
      expect(mars.leader, 'p1 led it already').is.undefined;
    });

    it('the exchange is free of the «non-leader» clause, and a tie it makes goes to the EARLIER first delegate', () => {
      const t = table();
      const mars = t.parliament.slots[1];
      t.parliament.removeVote(mars, 'NEUTRAL');
      t.parliament.placeVote(t.p2, mars, 'reserve'); // Mars First: neutral, p2 — p2 leads.
      const target = row(RemoveDelegate.exchangeTargetsOf(t.p1, t.parliament), M, 'resolution', 'neutral');
      expect(target.leader, 'p1 lands LAST: 1–1 stays p2\'s').is.undefined;
      askExchange(t);
      t.p1.process({type: 'party', partyName: M, delegate: {place: 'resolution', owner: 'neutral'}});
      runAllActions(t.game);
      expect(t.parliament.leaderOf(mars)?.owner).eq(t.p2.id);
      expect(mars.votes.map((v) => v.owner)).deep.eq([t.p2.id, t.p1.id]);
    });
  });

  describe('the prompt', () => {
    it('a party prompt marked `delegatePrompt {source: exchange}`, the giver as a reward', () => {
      const t = table();
      const prompt = askExchange(t);
      expect(prompt.title).eq(EXCHANGE_DELEGATE_TITLE);
      const model = Server.getWaitingFor(t.p1, prompt) as SelectPartyModel;
      expect(model.delegatePrompt?.source).eq('exchange');
      expect(model.delegatePrompt?.targets).deep.eq(RemoveDelegate.exchangeTargetsOf(t.p1, t.parliament));
      expect(model.parties).deep.eq([M]);
      expect(model.choiceContext).deep.eq({source: GIVER, mode: 'reward'});
    });

    it('PREVIEW = EXECUTION, and asking the twin changes nothing', () => {
      const t = table();
      const before = JSON.stringify(t.parliament.serialize());
      const twin = new RemoveDelegate(t.p1, GIVER, EXCHANGE).previewSelectParty();
      expect(JSON.stringify(t.parliament.serialize())).eq(before);
      const live = Server.getWaitingFor(t.p1, askExchange(t)) as SelectPartyModel;
      expect(twin?.delegatePrompt).deep.eq(live.delegatePrompt);
      expect(twin?.title).eq(live.title);
      expect(twin?.choiceContext).deep.eq(live.choiceContext);
    });

    it('refuses a seat\'s cube and a support cube — they are not on offer', () => {
      const t = table();
      t.parliament.popularSupport.set(G, 1);
      askExchange(t);
      expect(() => t.p1.process({type: 'party', partyName: G, delegate: {place: 'resolution', owner: t.p2.color}})).to.throw(/Invalid delegate/);
      expect(() => t.p1.process({type: 'party', partyName: M, delegate: {place: 'support', owner: 'neutral'}})).to.throw(/Invalid delegate/);
    });

    it('two named blockers, the table\'s first: no neutral on a bill, then an empty reserve', () => {
      const t = table();
      const exchange = new RemoveDelegate(t.p1, GIVER, EXCHANGE);
      expect(exchange.previewSkip()).is.undefined;
      while (t.parliament.reserve(t.p1) > 0) {
        t.parliament.placeVote(t.p1, t.parliament.slots[2], 'reserve');
      }
      expect(exchange.previewSkip()).deep.eq({reason: NO_DELEGATE_IN_RESERVE_REASON, skipped: {label: DELEGATE_EXCHANGE_LABEL}});
      t.parliament.slots[1].votes.length = 0;
      expect(exchange.previewSkip()?.reason, 'the table speaks first').eq(NO_NEUTRAL_ON_RESOLUTION_REASON);
      expect(exchange.previewSelectParty()).is.undefined;
      t.game.defer(exchange);
      runAllActions(t.game);
      expect(t.p1.getWaitingFor()).is.undefined;
      const skipped = t.game.events.events.find((e) => e.type === 'effect-skipped');
      expect(skipped?.impact.skipped).deep.eq({label: DELEGATE_EXCHANGE_LABEL, reason: NO_NEUTRAL_ON_RESOLUTION_REASON});
    });
  });

  describe('the answer', () => {
    it('ONE operation: the latest neutral cube to the supply, mine from the reserve onto the same bill LAST', () => {
      const t = table();
      const mars = t.parliament.slots[1];
      const neutralSeqs = mars.votes.map((v) => v.seq);
      const supply = t.parliament.neutralSupply();
      const reserve = t.parliament.reserve(t.p1);
      const lobby = t.parliament.lobby.has(t.p1.id);
      const mc = t.p1.megaCredits;
      askExchange(t);
      t.p1.process({type: 'party', partyName: M, delegate: {place: 'resolution', owner: 'neutral'}});
      runAllActions(t.game);
      expect(mars.votes.map((v) => v.owner)).deep.eq(['NEUTRAL', t.p1.id]);
      expect(mars.votes[0].seq, 'the EARLIER neutral cube stays').eq(neutralSeqs[0]);
      expect(mars.votes[1].seq).gt(Math.max(...neutralSeqs));
      expect(t.parliament.neutralSupply()).eq(supply + 1);
      expect(t.parliament.reserve(t.p1)).eq(reserve - 1);
      expect(t.parliament.lobby.has(t.p1.id), 'the lobby is never spent').eq(lobby);
      expect(t.p1.megaCredits, 'free — a grant, never a vote').eq(mc);
      t.parliament.assertLedger(t.game);
    });

    it('one journal line, two typed facts (nobody\'s loss · my delegate placed), the record carrying both figures', () => {
      const t = table();
      const mars = t.parliament.slots[1];
      const latestNeutral = mars.votes[mars.votes.length - 1].seq;
      askExchange(t);
      t.p1.process({type: 'party', partyName: M, delegate: {place: 'resolution', owner: 'neutral'}});
      runAllActions(t.game);
      expect(t.game.gameLog.filter((l) => l.message === '${0} exchanged a neutral delegate on ${1} for one of their own')).has.lengthOf(1);
      const removed = t.game.events.events.find((e) => e.type === 'delegate-removed');
      expect(removed?.target, 'a neutral cube is nobody\'s loss').is.undefined;
      expect(removed?.impact.delegateRemoved).deep.include({place: 'resolution', party: M, owner: 'neutral', returnsTo: 'supply', total: 2});
      const placed = t.game.events.events.find((e) => e.type === 'delegates-placed');
      expect(placed?.player).eq(t.p1.color);
      expect(placed?.impact.delegates?.count).eq(1);
      const mine = mars.votes.find((v) => v.owner === t.p1.id)!;
      expect(t.parliament.lastRemoval).deep.include({
        player: t.p1.id, card: CARD, place: 'resolution', party: M, owner: 'neutral', returnsTo: 'supply', total: 2,
        vote: latestNeutral, exchange: {vote: mine.seq},
      });
    });

    it('a second delegate there: the party\'s effect is mine, and the access diff announces it', () => {
      const t = table();
      t.parliament.placeVote(t.p1, t.parliament.slots[1], 'reserve');
      askExchange(t);
      t.p1.process({type: 'party', partyName: M, delegate: {place: 'resolution', owner: 'neutral'}});
      runAllActions(t.game);
      expect(t.parliament.access(t.p1, M).byDelegates).is.true;
    });

    it('an empty reserve at the answer, or the neutral cube gone: the named skip, and NOTHING moves', () => {
      const t = table();
      askExchange(t);
      while (t.parliament.reserve(t.p1) > 0) {
        t.parliament.placeVote(t.p1, t.parliament.slots[2], 'reserve');
      }
      const before = t.parliament.slots[1].votes.map((v) => v.seq);
      t.p1.process({type: 'party', partyName: M, delegate: {place: 'resolution', owner: 'neutral'}});
      runAllActions(t.game);
      expect(t.parliament.slots[1].votes.map((v) => v.seq), 'never half an exchange').deep.eq(before);
      expect(t.game.events.events.find((e) => e.type === 'effect-skipped')?.impact.skipped)
        .deep.eq({label: DELEGATE_EXCHANGE_LABEL, reason: NO_DELEGATE_IN_RESERVE_REASON});

      const u = table();
      askExchange(u);
      u.parliament.slots[1].votes.length = 0;
      const reserve = u.parliament.reserve(u.p1);
      u.p1.process({type: 'party', partyName: M, delegate: {place: 'resolution', owner: 'neutral'}});
      runAllActions(u.game);
      expect(u.parliament.reserve(u.p1)).eq(reserve);
      expect(u.game.events.events.find((e) => e.type === 'effect-skipped')?.impact.skipped)
        .deep.eq({label: DELEGATE_EXCHANGE_LABEL, reason: DELEGATE_GONE_REASON});
    });

    it('never calls the sitting\'s `onDelegatesDiscarded`', () => {
      const t = table();
      let calls = 0;
      t.p1.playedCards.push(fakeCard({onDelegatesDiscarded: () => {
        calls++;
      }}));
      askExchange(t);
      t.p1.process({type: 'party', partyName: M, delegate: {place: 'resolution', owner: 'neutral'}});
      runAllActions(t.game);
      expect(calls).eq(0);
    });
  });
});
