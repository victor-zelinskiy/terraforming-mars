import {expect} from 'chai';
import {
  COUNCIL_SEAT_EFFECT_DELEGATES, COUNCIL_SEAT_HOLDS_LINE, COUNCIL_SEAT_NOTHING_NOTE, COUNCIL_SEAT_OPENS_NOTE, CouncilSeat, councilSeatOpenings,
} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {RedsNewsOutlet} from '../../../src/server/cards/turmoilRedux/RedsNewsOutlet';
import {Tardigrades} from '../../../src/server/cards/base/Tardigrades';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {ParliamentHandler} from '../../../src/server/parliament/ParliamentHandler';
import {getParliamentModel} from '../../../src/server/parliament/ParliamentModel';
import {ColoniesHandler} from '../../../src/server/colonies/ColoniesHandler';
import {AndOptions} from '../../../src/server/inputs/AndOptions';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {PARTY_EFFECT_DELEGATES, ReduxParty} from '../../../src/common/parliament/ParliamentTypes';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {CardRenderSymbolType} from '../../../src/common/cards/render/CardRenderSymbolType';
import {LogMessageDataType} from '../../../src/common/logs/LogMessageDataType';
import {Message} from '../../../src/common/logs/Message';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {fakeCard, runAllActions} from '../../TestingUtils';

/**
 * TR36 — COUNCIL SEAT: the set's first card that changes THE LAW OF ACCESS.
 * Every rule reading of the card file's header is pinned here on the REAL
 * card and on the one Parliament function that judges access
 * (`Parliament.access` ← `effectDelegatesOf`): the threshold of the party
 * EFFECT becomes 1 for the owner, for every party at once, live, never
 * stored — and the card REQUIREMENT stays 2 on every surface (FAQ p.19).
 */
const R = PartyName.REDS;
const M = PartyName.MARS;
const S = PartyName.SCIENTISTS;
const U = PartyName.UNITY;
const G = PartyName.GREENS;
const SEAT = CardName.COUNCIL_SEAT;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: CouncilSeat};

/** A two-seat Redux table with three QUIET real resolutions (Scientists · Mars First · Reds) — the Greens rule by the starting rule. */
function table(parties: ReadonlyArray<ReduxParty> = [S, M, R]): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  parties.forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  const card = new CouncilSeat();
  return {game, p1, p2, parliament, card};
}

/** The same table with the card on p1's table. */
function owned(parties?: ReadonlyArray<ReduxParty>): Table {
  const t = table(parties);
  t.p1.playedCards.push(t.card);
  return t;
}

/** `n` of `player`'s own cubes on the slot of `party` (the lobby's free one first, the rest from the reserve). */
function cubes(t: Table, player: TestPlayer, party: ReduxParty, n: number): void {
  const slot = t.parliament.slotOf(party)!;
  for (let i = 0; i < n; i++) {
    t.parliament.placeVote(player, slot, t.parliament.lobby.has(player.id) ? 'lobby' : 'reserve');
  }
}

function accessOf(t: Table, player: TestPlayer, party: ReduxParty) {
  return getParliamentModel(t.game, player)!.players.find((p) => p.color === player.color)!.access.find((a) => a.party === party)!;
}

function projectionOf(t: Table, player: TestPlayer, party: ReduxParty) {
  const slot = t.parliament.slotOf(party)!;
  return getParliamentModel(t.game, player)!.viewer!.vote.projections.find((p) => p.instance === slot.instance)!;
}

const holdsLines = (t: Table) => t.game.gameLog.filter((entry) => entry.message === COUNCIL_SEAT_HOLDS_LINE);

describe('CouncilSeat', () => {
  it('registers with source-backed metadata (the scan: 6 · Mars · blue · the Reds\' plate · no VP · nothing on play)', () => {
    const card = new CouncilSeat();
    expect(card.name).eq(SEAT);
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(6);
    expect(card.tags).deep.eq([Tag.MARS]);
    expect(card.metadata.cardNumber).eq('TR36');
    expect(requiredPartyOf(card), 'the MIN plate holds the Reds\' emblem — a requirement, not a tag').eq(R);
    expect(card.requirements).has.length(1);
    expect(card.victoryPoints, 'no VP badge').is.undefined;
    expect(card.behavior, 'the play puts nothing on the table').is.undefined;
    expect(card.resourceType, 'no resource of its own').is.undefined;
    expect(card.partyEffectDelegates, 'the one number: «you only need 1 delegate»').eq(1);
    expect(COUNCIL_SEAT_EFFECT_DELEGATES).eq(1);
    expect(card.metadata.description).eq('Requires the Reds to be ruling or that you have 2 delegates there.');
    // The graphic: ONE effect row «[delegate] : [?]*» — a delegate, the wild party pill with the asterisk.
    type Node = {is?: string, type?: string, amount?: number, rows?: Array<Array<Node | string>>};
    const rows = (card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
    expect(rows).has.length(1);
    const box = rows[0][0];
    expect(box.is).eq('effect');
    const cause = (box.rows?.[0] ?? []) as Array<Node>;
    const result = (box.rows?.[2] ?? []) as Array<Node | string>;
    expect(cause[0]).deep.include({type: CardRenderItemType.DELEGATES, amount: 1});
    expect(result[0]).deep.include({type: CardRenderItemType.WILD, amount: 1});
    expect(result[1]).deep.include({type: CardRenderSymbolType.ASTERIX});
    expect(result).deep.include('Effect: You only need 1 delegate on a resolution to gain its party\'s effect.');
  });

  describe('rule 1 — the requirement: the Reds rule, or 2 of your delegates on their resolution — and the card\'s own effect never helps a REQUIREMENT', () => {
    it('neither road: unplayable with the TR15 class\'s NAMED reason «0 of 2»', () => {
      const t = table();
      t.p1.megaCredits = 20;
      t.p1.cardsInHand.push(t.card);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [R, '2'], party: R, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('one delegate: «1 of 2»; two: playable; the Reds ruling: playable with no delegate anywhere', () => {
      const t = table();
      t.p1.megaCredits = 20;
      cubes(t, t.p1, R, 1);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: R, current: 1});
      cubes(t, t.p1, R, 1);
      expect(t.p1.canPlay(t.card)).is.true;

      const ruled = table();
      ruled.p1.megaCredits = 20;
      seatEnacted(ruled.parliament, quietResolutionOf(R));
      expect(ruled.parliament.rulingParty()).eq(R);
      expect(ruled.p1.canPlay(ruled.card)).is.true;
    });

    it('FAQ p.19 — with the card on the table and ONE delegate on the Reds\' resolution: the Reds\' EFFECT is yours, a Reds card in hand still reads «1 of 2»', () => {
      const t = owned();
      t.p1.megaCredits = 20;
      cubes(t, t.p1, R, 1);
      const outlet = new RedsNewsOutlet();
      t.p1.cardsInHand.push(outlet);
      expect(t.parliament.hasPartyEffect(t.p1, R), 'the effect — one is enough').is.true;
      expect(t.parliament.satisfiesPartyRequirement(t.p1, R), 'the requirement — still two').is.false;
      expect(t.p1.canPlay(outlet)).is.false;
      expect(unplayableReasons(t.p1, outlet)[0]).deep.include({party: R, current: 1, params: [R, '2']});
      expect(t.game.politics?.partyRequirementStanding(t.p1, R)).deep.include({delegates: 1, required: PARTY_EFFECT_DELEGATES});
      // The second cube opens the requirement; the effect was open already.
      cubes(t, t.p1, R, 1);
      expect(t.p1.canPlay(outlet)).is.true;
    });

    it('checked at the PLAY only: the threshold works whoever rules once the card is on the table', () => {
      const t = owned();
      expect(t.parliament.rulingParty()).eq(G);
      cubes(t, t.p1, M, 1);
      expect(t.parliament.hasPartyEffect(t.p1, M)).is.true;
    });
  });

  describe('rule 2 — the play puts NOTHING on the table', () => {
    it('no resource, no delegate, no money moves; the card lands; nothing is asked', () => {
      const t = table();
      seatEnacted(t.parliament, quietResolutionOf(R));
      t.p1.megaCredits = 20;
      t.p1.cardsInHand.push(t.card);
      const reserve = t.parliament.reserve(t.p1);
      const lobby = t.parliament.lobby.has(t.p1.id);
      t.p1.playCard(t.card);
      runAllActions(t.game);
      expect(t.p1.getWaitingFor()).is.undefined;
      expect(t.p1.tableau.get(SEAT)).eq(t.card);
      expect(t.p1.megaCredits, 'playCard without a payment charges nothing — and the card gives nothing').eq(20);
      expect(t.parliament.reserve(t.p1)).eq(reserve);
      expect(t.parliament.lobby.has(t.p1.id)).eq(lobby);
      expect(t.parliament.votesOf(t.p1)).eq(0);
      expect(holdsLines(t), 'nothing opened — nothing to say').has.length(0);
      t.parliament.assertLedger(t.game);
    });
  });

  describe('rule 3 — the owner\'s threshold is 1 for EVERY party of the voting area at once; everyone else keeps 2', () => {
    it('three resolutions with one cube each are three effects; the rival with the same cubes holds none', () => {
      const t = owned();
      for (const party of [S, M, R] as const) {
        cubes(t, t.p1, party, 1);
        cubes(t, t.p2, party, 1);
      }
      for (const party of [S, M, R] as const) {
        expect(t.parliament.hasPartyEffect(t.p1, party), `${party} for the owner`).is.true;
        expect(t.parliament.hasPartyEffect(t.p2, party), `${party} for the rival`).is.false;
      }
      expect(t.parliament.effectDelegatesOf(t.p1)).deep.eq({count: 1, source: SEAT});
      expect(t.parliament.effectDelegatesOf(t.p2)).deep.eq({count: PARTY_EFFECT_DELEGATES});
      // …and the WIRE carries the threshold with its source, so no surface decides by a constant.
      expect(accessOf(t, t.p1, S)).deep.include({delegates: 1, effectDelegates: 1, effectDelegatesBy: SEAT, byDelegates: true, hasEffect: true, satisfiesRequirement: false, granted: []});
      expect(accessOf(t, t.p2, S)).deep.include({delegates: 1, effectDelegates: 2, byDelegates: false, hasEffect: false});
      expect(accessOf(t, t.p2, S).effectDelegatesBy, 'no card — no source').is.undefined;
    });

    it('stacks with the ruling party (everyone\'s) — two bases, one effect', () => {
      const t = owned();
      expect(t.parliament.access(t.p1, G)).deep.include({ruling: true, hasEffect: true, effectDelegates: 1});
      expect(t.parliament.access(t.p2, G)).deep.include({ruling: true, hasEffect: true, effectDelegates: 2});
    });
  });

  describe('rule 4 — the REQUIREMENT is untouched on every surface', () => {
    it('`satisfiesPartyRequirement` at one delegate is false, `required` is 2, the vote\'s requirement edge fires at 2', () => {
      const t = owned();
      cubes(t, t.p1, M, 1);
      expect(t.parliament.access(t.p1, M)).deep.include({byDelegates: true, hasEffect: true, satisfiesRequirement: false});
      expect(t.game.politics?.partyRequirementStanding(t.p1, M)?.required).eq(2);
      // The NEXT cube: 1 → 2 satisfies the requirement; the effect was the owner's already.
      expect(projectionOf(t, t.p1, M)).deep.include({unlocksEffect: false, unlocksRequirement: true});
      cubes(t, t.p1, M, 1);
      expect(t.parliament.access(t.p1, M)).deep.include({byDelegates: true, hasEffect: true, satisfiesRequirement: true});
    });
  });

  describe('rule 5 — LIVE, both ways', () => {
    it('played with a cube already standing: the effect at once — the party\'s action is in the menu the same turn, the wild tag counts', () => {
      const t = table();
      seatEnacted(t.parliament, quietResolutionOf(R));
      t.p1.megaCredits = 20;
      t.p1.playedCards.push(new Tardigrades());
      cubes(t, t.p1, S, 1);
      t.p1.cardsInHand.push(t.card);
      expect(t.parliament.hasPartyEffect(t.p1, S), 'before the play: one cube is not enough').is.false;
      expect(t.p1.tags.count(Tag.SCIENCE)).eq(0);
      expect(ParliamentHandler.partyActionOptions(t.p1).some((o) => (o as {partyActionPrompt?: {party: PartyName}}).partyActionPrompt?.party === S)).is.false;
      t.p1.playCard(t.card);
      runAllActions(t.game);
      expect(t.parliament.hasPartyEffect(t.p1, S), 'after the play: the cube that stood opens the effect').is.true;
      expect(t.p1.tags.count(Tag.SCIENCE), 'the Scientists\' wild tag, in the action-time count').eq(1);
      expect(t.p1.tags.count(Tag.SCIENCE, 'award'), '…never for the awards').eq(0);
      expect(ParliamentHandler.partyActionOptions(t.p1).some((o) => (o as {partyActionPrompt?: {party: PartyName}}).partyActionPrompt?.party === S), 'the Scientists\' action is offered').is.true;
    });

    it('the cube gone → the effect gone; the resolution gone → the effect gone; the card gone → the printed two again', () => {
      const t = owned();
      cubes(t, t.p1, M, 1);
      expect(t.parliament.hasPartyEffect(t.p1, M)).is.true;
      // The cube leaves (what a refresh does to a loser's delegates).
      t.parliament.slotOf(M)!.votes.length = 0;
      expect(t.parliament.hasPartyEffect(t.p1, M)).is.false;
      cubes(t, t.p1, M, 1);
      expect(t.parliament.hasPartyEffect(t.p1, M)).is.true;
      // The resolution leaves the voting area (another party's card takes the slot).
      seatResolution(t.parliament, 1, quietResolutionOf(U));
      expect(t.parliament.slotOf(M), 'Mars First is off the vote').is.undefined;
      expect(t.parliament.access(t.p1, M)).deep.include({onVote: false, delegates: 0, hasEffect: false, effectDelegates: 1});
      // The card leaves the tableau: the law is the printed one again (a threshold, never a stored grant).
      // (`seatResolution` keeps the slot's votes — the cube that stood on Mars First's card now stands on Unity's; clear it first.)
      t.parliament.slotOf(U)!.votes.length = 0;
      cubes(t, t.p1, U, 1);
      expect(t.parliament.hasPartyEffect(t.p1, U)).is.true;
      t.p1.playedCards.set();
      expect(t.parliament.effectDelegatesOf(t.p1)).deep.eq({count: 2});
      expect(t.parliament.hasPartyEffect(t.p1, U)).is.false;
    });

    it('Unity\'s free trade with ONE cube on their resolution', () => {
      const t = owned([U, M, R]);
      cubes(t, t.p1, U, 1);
      t.p1.megaCredits = 9;
      const trade = cast(t.p1.colonies.coloniesTradeAction(), AndOptions);
      const howToPay = cast(trade.options[0], OrOptions);
      const unity = howToPay.options.findIndex((o) => (o as SelectOption).metadata?.description?.toString().includes('Unity'));
      expect(unity, 'the Unity path is offered').greaterThan(-1);
      const colony = ColoniesHandler.tradeableColonies(t.game, t.p1)[0];
      trade.process({type: 'and', responses: [
        {type: 'or', index: unity, response: {type: 'option'}},
        {type: 'colony', colonyName: colony.name},
      ]}, t.p1);
      runAllActions(t.game);
      const ask = t.p1.getWaitingFor();
      if (ask !== undefined) {
        cast(ask, OrOptions).options[0].cb(undefined);
        runAllActions(t.game);
      }
      expect(t.p1.megaCredits, 'no fee').greaterThanOrEqual(9);
      expect(colony.visitor).eq(t.p1.id);
      expect(t.parliament.partyActionUsesLeft(t.p1, U), 'rule 9 — a use with one delegate is a use').eq(0);
    });
  });

  describe('rule 6 — NOT A GRANT', () => {
    it('`granted` stays empty, `grantedEffects` is never written, and a reload reads the threshold off the tableau again', () => {
      const t = table();
      seatEnacted(t.parliament, quietResolutionOf(R));
      t.p1.megaCredits = 20;
      cubes(t, t.p1, S, 1);
      t.p1.cardsInHand.push(t.card);
      t.p1.playCard(t.card);
      runAllActions(t.game);
      expect(t.parliament.access(t.p1, S).granted).deep.eq([]);
      expect(t.parliament.grantedEffects.get(t.p1.id) ?? []).deep.eq([]);
      const serialized = t.parliament.serialize();
      expect(JSON.stringify(serialized), 'nothing of the card in the parliament\'s save').not.includes(SEAT);
      const restored = Game.deserialize(structuredClone(t.game.serialize()));
      const again = restored.getPlayerById(t.p1.id);
      expect(restored.parliament!.effectDelegatesOf(again)).deep.eq({count: 1, source: SEAT});
      expect(restored.parliament!.access(again, S)).deep.include({delegates: 1, hasEffect: true, satisfiesRequirement: false, granted: []});
    });
  });

  describe('rule 7 — only the player\'s OWN delegates ON THE RESOLUTION count', () => {
    it('a neutral cube, Popular Support and the chairman\'s seat open nothing; the ENACTED card\'s party rules — the other road', () => {
      const t = owned();
      t.parliament.addNeutralVote(t.parliament.slotOf(M)!);
      t.parliament.addPopularSupport(M, 2);
      t.parliament.chairman = t.p1.id;
      expect(t.parliament.access(t.p1, M)).deep.include({delegates: 0, byDelegates: false, hasEffect: false});
      cubes(t, t.p2, M, 1);
      expect(t.parliament.access(t.p1, M), 'the rival\'s cube is not yours').deep.include({delegates: 0, hasEffect: false});
      seatEnacted(t.parliament, quietResolutionOf(M));
      expect(t.parliament.access(t.p1, M)).deep.include({ruling: true, onVote: false, delegates: 0, byDelegates: false, hasEffect: true});
    });
  });

  describe('rule 8 — the floor and the stacking', () => {
    it('two lowering cards still read 1 (never 0); a card can never RAISE the bar; a grant and the threshold are an OR', () => {
      const t = owned();
      t.p1.playedCards.push(fakeCard({name: 'zero' as CardName, partyEffectDelegates: 0}));
      expect(t.parliament.effectDelegatesOf(t.p1), 'the first card to reach the floor is the source').deep.eq({count: 1, source: SEAT});
      t.p1.playedCards.set(fakeCard({name: 'raise' as CardName, partyEffectDelegates: 5}));
      expect(t.parliament.effectDelegatesOf(t.p1), 'a declared 5 is clamped to the printed two — and the printed two names no source').deep.eq({count: 2});
      t.p1.playedCards.push(fakeCard({name: 'one' as CardName, partyEffectDelegates: 1}));
      expect(t.parliament.effectDelegatesOf(t.p1)).deep.eq({count: 1, source: 'one' as CardName});
      // A grant beside the threshold: either road holds the effect.
      t.p1.playedCards.set(t.card);
      t.parliament.grantPartyEffect(t.p1, S, 'Septem Tribus');
      expect(t.parliament.access(t.p1, S)).deep.include({delegates: 0, byDelegates: false, granted: ['Septem Tribus'], hasEffect: true});
      cubes(t, t.p1, S, 1);
      expect(t.parliament.access(t.p1, S)).deep.include({delegates: 1, byDelegates: true, granted: ['Septem Tribus'], hasEffect: true});
    });
  });

  it('rule 10 — a MarsBot table: the bot\'s seat holds no effect at any threshold, the human\'s threshold is its own', () => {
    const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    ([S, M, R] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    bot.playedCards.push(fakeCard({name: 'bot-seat' as CardName, partyEffectDelegates: 1}));
    human.playedCards.push(new CouncilSeat());
    expect(parliament.effectDelegatesOf(bot), 'outside the party-effects aspect: the printed number, never applied').deep.eq({count: 2});
    expect(parliament.effectDelegatesOf(human)).deep.eq({count: 1, source: SEAT});
    parliament.placeVote(human, parliament.slotOf(M)!, 'lobby');
    expect(parliament.hasPartyEffect(human, M)).is.true;
    expect(parliament.access(bot, M)).deep.include({hasEffect: false, effectDelegates: 2});
    parliament.assertLedger(game);
  });

  describe('rule 11 — the journal: one line per party THIS play opened, under the card\'s effect area', () => {
    it('two parties with one cube each and the Reds with two: two lines (the Reds were held by two already), none for an empty slot', () => {
      const t = table();
      t.p1.megaCredits = 20;
      cubes(t, t.p1, R, 2);
      cubes(t, t.p1, S, 1);
      t.p1.cardsInHand.push(t.card);
      expect(councilSeatOpenings(t.p1, t.parliament)).deep.eq([{party: S, resolution: quietResolutionOf(S)}]);
      t.p1.playCard(t.card);
      runAllActions(t.game);
      const lines = holdsLines(t);
      expect(lines).has.length(1);
      expect(lines[0].data.map((d) => d.type)).deep.eq([LogMessageDataType.PLAYER, LogMessageDataType.PARTY, LogMessageDataType.RESOLUTION, LogMessageDataType.CARD]);
      expect(lines[0].data[1].value).eq(S);
      expect(lines[0].data[2].value).eq(quietResolutionOf(S));
      expect(lines[0].data[3].value).eq(SEAT);
    });

    it('nothing opened — no line (the composer said it in words)', () => {
      const t = table();
      seatEnacted(t.parliament, quietResolutionOf(R));
      t.p1.megaCredits = 20;
      t.p1.cardsInHand.push(t.card);
      t.p1.playCard(t.card);
      runAllActions(t.game);
      expect(holdsLines(t)).has.length(0);
    });
  });

  describe('rule 12 — the owner\'s vote projections', () => {
    it('a slot with 0 cubes: «unlocks the effect» without the requirement; a slot going 1 → 2: the requirement without the effect; the rival: both at 2', () => {
      const t = owned();
      cubes(t, t.p1, M, 1);
      cubes(t, t.p2, M, 1);
      expect(projectionOf(t, t.p1, S), 'the owner, 0 → 1').deep.include({unlocksEffect: true, unlocksRequirement: false});
      expect(projectionOf(t, t.p1, M), 'the owner, 1 → 2').deep.include({unlocksEffect: false, unlocksRequirement: true});
      expect(projectionOf(t, t.p2, M), 'the rival, 1 → 2').deep.include({unlocksEffect: true, unlocksRequirement: true});
      expect(projectionOf(t, t.p2, S), 'the rival, 0 → 1').deep.include({unlocksEffect: false, unlocksRequirement: false});
    });
  });

  describe('the play composer — what opens NOW, by the same reading the play journals', () => {
    it('one note per party that opens (the party and the resolution), the honest «none yet» note otherwise; read-only', () => {
      const t = table();
      t.p1.megaCredits = 20;
      cubes(t, t.p1, R, 2);
      cubes(t, t.p1, S, 1);
      cubes(t, t.p1, M, 1);
      t.p1.cardsInHand.push(t.card);
      const before = JSON.stringify(t.game.serialize());
      const preview = cardPlayPreview(t.p1, t.card);
      expect(JSON.stringify(t.game.serialize()), 'read-only').eq(before);
      expect(preview.kind).eq('bespoke');
      const branch = preview.branches[0];
      expect(branch.effects, 'no chip — the play moves nothing').deep.eq([]);
      const notes = branch.steps.map((s) => s.kind === 'note' ? (s.text as Message) : undefined);
      expect(notes).has.length(2);
      expect(notes.map((n) => n?.message)).deep.eq([COUNCIL_SEAT_OPENS_NOTE, COUNCIL_SEAT_OPENS_NOTE]);
      expect(notes.map((n) => n?.data[0].value)).deep.eq([S, M]);
      expect(notes.map((n) => n?.data[1].value)).deep.eq([quietResolutionOf(S), quietResolutionOf(M)]);
      expect(notes.map((n) => n?.data.map((d) => d.type))[0]).deep.eq([LogMessageDataType.PARTY, LogMessageDataType.RESOLUTION]);

      const none = table();
      seatEnacted(none.parliament, quietResolutionOf(R));
      none.p1.cardsInHand.push(none.card);
      const steps = cardPlayPreview(none.p1, none.card).branches[0].steps;
      expect(steps).has.length(1);
      expect(steps[0]).deep.include({kind: 'note', noteKind: 'generic', text: COUNCIL_SEAT_NOTHING_NOTE});
    });

    it('a party already held by another road is NOT «opened» (two cubes, the ruling party, a grant)', () => {
      const t = table();
      cubes(t, t.p1, R, 2);
      cubes(t, t.p1, S, 1);
      t.parliament.grantPartyEffect(t.p1, S, 'Septem Tribus');
      expect(councilSeatOpenings(t.p1, t.parliament), 'the Reds by two, the Scientists by a grant, Mars First with no cube').deep.eq([]);
    });
  });

  it('save / reload: the reloaded card still lowers the law', () => {
    const t = owned();
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const again = reloaded.getPlayerById(t.p1.id);
    const card = again.tableau.get(SEAT) as CouncilSeat;
    expect(card.partyEffectDelegates).eq(1);
    expect(reloaded.parliament!.effectDelegatesOf(again)).deep.eq({count: 1, source: SEAT});
  });
});
