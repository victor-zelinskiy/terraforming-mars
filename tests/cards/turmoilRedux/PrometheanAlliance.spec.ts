import {expect} from 'chai';
import {
  PROMETHEAN_ALLIANCE_NOTHING_NOTE, PROMETHEAN_ALLIANCE_PARTIES, PROMETHEAN_ALLIANCE_PRODUCTION_LINE, PROMETHEAN_ALLIANCE_PRODUCTION_NOTE,
  PrometheanAlliance, prometheanAllianceOpenings,
} from '../../../src/server/cards/turmoilRedux/PrometheanAlliance';
import {ALLIANCE_HOLDS_LINE, ALLIANCE_OPENS_RULING_NOTE} from '../../../src/server/cards/turmoilRedux/partyAllianceCard';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {getParliamentModel} from '../../../src/server/parliament/ParliamentModel';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {Resource} from '../../../src/common/Resource';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {ReduxParty} from '../../../src/common/parliament/ParliamentTypes';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {CardRenderSymbolType} from '../../../src/common/cards/render/CardRenderSymbolType';
import {Message} from '../../../src/common/logs/Message';
import {Payment} from '../../../src/common/inputs/Payment';
import {formatMessage, runAllActions} from '../../TestingUtils';
import {passToParliament, quietResolutionOf, seatEnacted, seatResolution, settleParliamentGates} from '../../parliament/parliamentArrange';

/**
 * TR64 — PROMETHEAN ALLIANCE: the law of access's fourth road (TR62's class) over the last pair [Scientists,
 * Industrialists], and the third answer to a change of power — the owner's M€ PRODUCTION. TR62's spec pins the road's
 * rules on the shared reading; this one pins what TR64 changes: the pair, the face, the +2 M€ production at an enactment
 * (measured into the sitting's `rulingAnswers` as `production`) and its «becomes».
 */
const S = PartyName.SCIENTISTS;
const I = PartyName.INDUSTRIALISTS;
const U = PartyName.UNITY;
const ID = CardName.PROMETHEAN_ALLIANCE;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: PrometheanAlliance};

/** A two-seat Redux table with three QUIET real resolutions (Scientists · Unity · Mars First) — the Greens rule by the starting rule. */
function table(parties: ReadonlyArray<ReduxParty> = [S, U, PartyName.MARS]): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  parties.forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  return {game, p1, p2, parliament, card: new PrometheanAlliance()};
}

function owned(parties?: ReadonlyArray<ReduxParty>): Table {
  const t = table(parties);
  t.p1.playedCards.push(t.card);
  return t;
}

function cubes(t: Table, player: TestPlayer, party: ReduxParty, n: number): void {
  const slot = t.parliament.slotOf(party)!;
  for (let i = 0; i < n; i++) {
    t.parliament.placeVote(player, slot, t.parliament.lobby.has(player.id) ? 'lobby' : 'reserve');
  }
}

const linesOf = (t: Table, key: string) => t.game.gameLog.filter((entry) => entry.message === key);

/** The sitting's measured answers — the live summary while it stands, else the closed one. */
const answersOf = (t: Table) => t.parliament.phase?.summary?.rulingAnswers ?? t.parliament.lastPhase?.rulingAnswers;

const notesOf = (t: Table, player: TestPlayer) => cardPlayPreview(player, t.card).branches[0].steps
  .filter((step) => step.kind === 'note')
  .map((step) => step.text)
  .map((text) => typeof text === 'string' ? text : (text as Message).message);

describe('PrometheanAlliance', () => {
  it('registers with source-backed metadata (the scan: 8 · Power + Science · blue · no requirement · no VP · the pair in this file)', () => {
    const card = new PrometheanAlliance();
    expect(card.name).eq(ID);
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(8);
    expect(card.tags).deep.eq([Tag.POWER, Tag.SCIENCE]);
    expect(card.metadata.cardNumber).eq('TR64');
    expect(card.requirements, 'the MIN plate is empty').deep.eq([]);
    expect(card.victoryPoints, 'no VP badge').is.undefined;
    expect(card.behavior, 'the play puts nothing on the table').is.undefined;
    expect(card.partyAlliance, 'the pair, declared here').deep.eq([S, I]);
    expect(PROMETHEAN_ALLIANCE_PARTIES).deep.eq([S, I]);
    const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
    const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[ID];
    expect(entry, 'in the Redux manifest').is.not.undefined;
    expect(entry.compatibility, 'only the module\'s icon at the bottom left').is.undefined;
    // The graphic: TWO effect rows — «[Scientists] = [Industrialists]» and «[Scientists][Industrialists] RULING : [2 M€ production]».
    type Node = {is?: string, type?: string, amount?: number, party?: PartyName, stacked?: true, innerText?: string, rows?: Array<Array<Node | string>>};
    const rows = (card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
    const boxes = rows.flat().filter((n) => n.is === 'effect');
    expect(boxes).has.length(2);
    const [pair, production] = boxes;
    expect((pair.rows![0] as Array<Node>)[0]).deep.include({type: CardRenderItemType.PARTY_SEAL, party: S});
    expect((pair.rows![1] as Array<Node>)[0]).deep.include({type: CardRenderSymbolType.EQUALS});
    expect((pair.rows![2] as Array<Node>)[0]).deep.include({type: CardRenderItemType.PARTY_SEAL, party: I});
    const cause = production.rows![0] as Array<Node>;
    expect(cause[0]).deep.include({type: CardRenderItemType.PARTY_SEAL, party: S});
    expect(cause[1]).deep.include({type: CardRenderItemType.PARTY_SEAL, party: I, stacked: true, innerText: 'Ruling'});
    const plate = (production.rows![2] as Array<Node>)[0];
    expect(plate.is, 'the M€ sits on the production plate').eq('production-box');
    expect(JSON.stringify(plate)).contains(CardRenderItemType.MEGACREDITS).contains('"amount":2');
    expect(production.rows![2]).deep.include('Effect: Gain 2 M€ production when either of those parties becomes ruling.');
  });

  describe('the fourth road over this pair', () => {
    it('the Scientists rule → the Industrialists\' effect AND requirement are the owner\'s, by the alliance road; and vice versa', () => {
      const t = owned();
      seatEnacted(t.parliament, quietResolutionOf(S));
      expect(t.parliament.access(t.p1, I)).deep.include({hasEffect: true, satisfiesRequirement: true});
      expect(t.parliament.access(t.p1, I).allied).deep.eq([{via: S, source: ID, road: 'ruling'}]);
      expect(t.parliament.access(t.p2, I), 'the rival has no pair').deep.include({hasEffect: false, satisfiesRequirement: false});
      const back = owned([I, U, PartyName.MARS]);
      seatEnacted(back.parliament, quietResolutionOf(I));
      expect(back.parliament.access(back.p1, S).allied).deep.eq([{via: I, source: ID, road: 'ruling'}]);
    });

    it('two own cubes on the Scientists open the Industrialists; one cube under Council Seat does not (the printed road only)', () => {
      const t = owned();
      t.p1.playedCards.push(new CouncilSeat());
      cubes(t, t.p1, S, 1);
      expect(t.parliament.hasPartyEffect(t.p1, S), 'the Scientists\' effect by the lowered threshold').is.true;
      expect(t.parliament.access(t.p1, I).allied).deep.eq([]);
      cubes(t, t.p1, S, 1);
      expect(t.parliament.access(t.p1, I).allied).deep.eq([{via: S, source: ID, road: 'delegates'}]);
    });
  });

  describe('«becomes ruling» → +2 M€ production, at the enactment', () => {
    it('the Scientists enacted: the owner\'s M€ production +2, the journal names the party, the sitting MEASURES it; the rival gains nothing', () => {
      const t = owned();
      cubes(t, t.p2, S, 3);
      const prod = t.p1.production.megacredits;
      const rival = t.p2.production.megacredits;
      passToParliament(t.game);
      settleParliamentGates(t.game);
      expect(t.parliament.rulingParty()).eq(S);
      expect(t.p1.production.megacredits, 'two steps of M€ production').eq(prod + 2);
      expect(t.p2.production.megacredits, 'the rival holds no alliance').eq(rival);
      expect(linesOf(t, PROMETHEAN_ALLIANCE_PRODUCTION_LINE)).has.length(1);
      expect(formatMessage(linesOf(t, PROMETHEAN_ALLIANCE_PRODUCTION_LINE)[0]))
        .match(/gains 2 M€ production: Scientists is the new ruling party \(Promethean Alliance\)/);
      const answer = (answersOf(t) ?? []).find((a) => a.card === ID);
      expect(answer).deep.include({player: t.p1.id, card: ID, party: S});
      expect(answer?.production, 'the production the card raised, measured').deep.eq({megacredits: 2});
      expect(answer?.tr, 'no rating').is.undefined;
    });

    it('the Industrialists enacted: +2 M€ production, and the model carries the record to the client by colour', () => {
      const t = owned([I, U, PartyName.MARS]);
      seatEnacted(t.parliament, quietResolutionOf(S));
      cubes(t, t.p2, I, 3);
      const prod = t.p1.production.get(Resource.MEGACREDITS);
      passToParliament(t.game);
      settleParliamentGates(t.game);
      expect(t.parliament.rulingParty()).eq(I);
      // The enacted Industrialists law (a quiet card that pays M€ production per Power tag) answers this card's own
      // Power tag AFTER the change of power — the card's two steps are what the record measures, the rest is the law's.
      const lawPaid = t.p1.production.get(Resource.MEGACREDITS) - prod - 2;
      expect(lawPaid, 'the card two steps, plus whatever the enacted law paid on its own').gte(0);
      expect(linesOf(t, PROMETHEAN_ALLIANCE_PRODUCTION_LINE)).has.length(1);
      expect((answersOf(t) ?? []).find((a) => a.card === ID)).deep.include({party: I, production: {megacredits: 2}});
      const model = getParliamentModel(t.game, t.p1);
      const modelAnswers = model?.phase?.summary?.rulingAnswers ?? model?.lastPhase?.rulingAnswers;
      expect(modelAnswers?.find((a) => a.card === ID)).deep.include({player: t.p1.color, card: ID, party: I, production: {megacredits: 2}});
    });

    it('another party enacted raises nothing; the hook judges «becomes» itself', () => {
      const unity = owned();
      cubes(unity, unity.p2, U, 3);
      const before = unity.p1.production.megacredits;
      passToParliament(unity.game);
      settleParliamentGates(unity.game);
      expect(unity.parliament.rulingParty()).eq(U);
      expect(unity.p1.production.megacredits).eq(before);
      expect((answersOf(unity) ?? []).filter((a) => a.card === ID), 'nothing answered — nothing recorded').deep.eq([]);

      const t = owned();
      const prod = t.p1.production.megacredits;
      t.card.onRulingPartyChanged(t.p1, S, S);
      t.card.onRulingPartyChanged(t.p1, U, S);
      expect(t.p1.production.megacredits).eq(prod);
      t.card.onRulingPartyChanged(t.p1, I, S);
      expect(t.p1.production.megacredits).eq(prod + 2);
    });

    it('a RELOAD mid-sitting never raises the production twice', () => {
      const t = owned();
      cubes(t, t.p2, S, 3);
      const prod = t.p1.production.megacredits;
      passToParliament(t.game);
      expect(t.parliament.phase?.step).eq('assembly');
      const game = Game.deserialize(structuredClone(t.game.serialize()));
      settleParliamentGates(game);
      expect(game.parliament!.rulingParty()).eq(S);
      expect(game.getPlayerById(t.p1.id).production.megacredits).eq(prod + 2);
      expect(game.gameLog.filter((m) => m.message === PROMETHEAN_ALLIANCE_PRODUCTION_LINE)).has.length(1);
    });

    it('playing the card while the Scientists ALREADY rule raises nothing («becomes»)', () => {
      const t = table();
      seatEnacted(t.parliament, quietResolutionOf(S));
      t.p1.megaCredits = 20;
      t.p1.cardsInHand.push(t.card);
      const prod = t.p1.production.megacredits;
      t.p1.playCard(t.card, Payment.of({megacredits: 8}));
      runAllActions(t.game);
      expect(t.p1.production.megacredits).eq(prod);
      expect(linesOf(t, ALLIANCE_HOLDS_LINE), 'the play journals the Industrialists it opened').has.length(1);
    });

    it('MarsBot is never asked: outside the party-effects aspect, no pair', () => {
      const [game, , bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      ([S, U, PartyName.MARS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      bot.playedCards.push(new PrometheanAlliance());
      expect(parliament.alliancesOf(bot)).deep.eq([]);
    });
  });

  describe('the preview', () => {
    it('nothing standing: the honest «nothing yet» and the production note; the Scientists rule: «opens the Industrialists»', () => {
      const t = table();
      // A fresh table: the Greens rule by the STARTING rule — no side of this pair is open.
      expect(prometheanAllianceOpenings(t.p1, t.parliament)).deep.eq([]);
      expect(notesOf(t, t.p1)).deep.eq([PROMETHEAN_ALLIANCE_NOTHING_NOTE, PROMETHEAN_ALLIANCE_PRODUCTION_NOTE]);
      seatEnacted(t.parliament, quietResolutionOf(S));
      expect(prometheanAllianceOpenings(t.p1, t.parliament)).deep.eq([{party: I, via: S, road: 'ruling', effectHeld: false}]);
      expect(notesOf(t, t.p1)).deep.eq([ALLIANCE_OPENS_RULING_NOTE, PROMETHEAN_ALLIANCE_PRODUCTION_NOTE]);
    });
  });
});
