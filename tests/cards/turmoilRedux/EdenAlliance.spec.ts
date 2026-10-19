import {expect} from 'chai';
import {
  EDEN_ALLIANCE_NOTHING_NOTE, EDEN_ALLIANCE_PARTIES, EDEN_ALLIANCE_TR_LINE, EDEN_ALLIANCE_TR_NOTE, EdenAlliance, edenAllianceOpenings,
} from '../../../src/server/cards/turmoilRedux/EdenAlliance';
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
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {ReduxParty} from '../../../src/common/parliament/ParliamentTypes';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {CardRenderSymbolType} from '../../../src/common/cards/render/CardRenderSymbolType';
import {Message} from '../../../src/common/logs/Message';
import {Payment} from '../../../src/common/inputs/Payment';
import {formatMessage, runAllActions} from '../../TestingUtils';
import {passToParliament, quietResolutionOf, seatEnacted, seatResolution, settleParliamentGates} from '../../parliament/parliamentArrange';

/**
 * TR63 — EDEN ALLIANCE: the law of access's fourth road (TR62's class) over the pair [Unity, Greens], and the
 * second answer to a change of power — the owner's rating. TR62's spec pins the road's rules on the shared reading;
 * this one pins what TR63 changes: the pair, the face, the +1 TR at an enactment (measured into the sitting's
 * `rulingAnswers` with the ruling Greens' own answer to the rating) and its «becomes».
 */
const U = PartyName.UNITY;
const G = PartyName.GREENS;
const S = PartyName.SCIENTISTS;
const ID = CardName.EDEN_ALLIANCE;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: EdenAlliance};

/** A two-seat Redux table with three QUIET real resolutions (Scientists · Unity · Mars First) — the Greens rule by the starting rule. */
function table(parties: ReadonlyArray<ReduxParty> = [S, U, PartyName.MARS]): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  parties.forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  return {game, p1, p2, parliament, card: new EdenAlliance()};
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

describe('EdenAlliance', () => {
  it('registers with source-backed metadata (the scan: 8 · Plant + Earth · blue · no requirement · no VP · the pair in this file)', () => {
    const card = new EdenAlliance();
    expect(card.name).eq(ID);
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(8);
    expect(card.tags).deep.eq([Tag.PLANT, Tag.EARTH]);
    expect(card.metadata.cardNumber).eq('TR63');
    expect(card.requirements, 'the MIN plate is empty').deep.eq([]);
    expect(card.victoryPoints, 'no VP badge').is.undefined;
    expect(card.behavior, 'the play puts nothing on the table').is.undefined;
    expect(card.partyAlliance, 'the pair, declared here').deep.eq([U, G]);
    expect(EDEN_ALLIANCE_PARTIES).deep.eq([U, G]);
    const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
    const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[ID];
    expect(entry, 'in the Redux manifest').is.not.undefined;
    expect(entry.compatibility, 'only the module\'s icon at the bottom left').is.undefined;
    // The graphic: TWO effect rows — «[Unity] = [Greens]» and «[Unity][Greens] RULING : [TR]».
    type Node = {is?: string, type?: string, amount?: number, party?: PartyName, stacked?: true, innerText?: string, rows?: Array<Array<Node | string>>};
    const rows = (card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
    const boxes = rows.flat().filter((n) => n.is === 'effect');
    expect(boxes).has.length(2);
    const [pair, rating] = boxes;
    expect((pair.rows![0] as Array<Node>)[0]).deep.include({type: CardRenderItemType.PARTY_SEAL, party: U});
    expect((pair.rows![1] as Array<Node>)[0]).deep.include({type: CardRenderSymbolType.EQUALS});
    expect((pair.rows![2] as Array<Node>)[0]).deep.include({type: CardRenderItemType.PARTY_SEAL, party: G});
    const cause = rating.rows![0] as Array<Node>;
    expect(cause[0]).deep.include({type: CardRenderItemType.PARTY_SEAL, party: U});
    expect(cause[1]).deep.include({type: CardRenderItemType.PARTY_SEAL, party: G, stacked: true, innerText: 'Ruling'});
    expect((rating.rows![2] as Array<Node>)[0]).deep.include({type: CardRenderItemType.TR, amount: 1});
    expect(rating.rows![2]).deep.include('Effect: Gain 1 TR when either of those parties becomes ruling.');
  });

  describe('the fourth road over this pair', () => {
    it('Unity rules → the Greens\' effect AND requirement are the owner\'s, by the alliance road; and vice versa', () => {
      const t = owned();
      seatEnacted(t.parliament, quietResolutionOf(U));
      expect(t.parliament.access(t.p1, G)).deep.include({hasEffect: true, satisfiesRequirement: true});
      expect(t.parliament.access(t.p1, G).allied).deep.eq([{via: U, source: ID, road: 'ruling'}]);
      expect(t.parliament.access(t.p2, G), 'the rival has no pair').deep.include({hasEffect: false, satisfiesRequirement: false});
      const back = owned([S, G, PartyName.MARS]);
      seatEnacted(back.parliament, quietResolutionOf(G));
      expect(back.parliament.access(back.p1, U).allied).deep.eq([{via: G, source: ID, road: 'ruling'}]);
    });

    it('two own cubes on Unity open the Greens; one cube under Council Seat does not (the printed road only)', () => {
      const t = owned();
      t.p1.playedCards.push(new CouncilSeat());
      cubes(t, t.p1, U, 1);
      expect(t.parliament.hasPartyEffect(t.p1, U), 'Unity\'s effect by the lowered threshold').is.true;
      expect(t.parliament.access(t.p1, G).allied).deep.eq([]);
      cubes(t, t.p1, U, 1);
      expect(t.parliament.access(t.p1, G).allied).deep.eq([{via: U, source: ID, road: 'delegates'}]);
    });
  });

  describe('«becomes ruling» → +1 TR, at the enactment', () => {
    it('Unity enacted: the owner\'s rating +1 under this card\'s source, the journal names the party, the sitting MEASURES it; the rival gains nothing', () => {
      const t = owned();
      cubes(t, t.p2, U, 3);
      const tr = t.p1.terraformRating;
      const rival = t.p2.terraformRating;
      passToParliament(t.game);
      settleParliamentGates(t.game);
      expect(t.parliament.rulingParty()).eq(U);
      expect(t.p1.terraformRating, 'one TR').eq(tr + 1);
      expect(t.p2.terraformRating, 'the rival holds no alliance').eq(rival);
      expect(linesOf(t, EDEN_ALLIANCE_TR_LINE)).has.length(1);
      expect(formatMessage(linesOf(t, EDEN_ALLIANCE_TR_LINE)[0])).match(/gains 1 TR: Unity is the new ruling party \(Eden Alliance\)/);
      // Unity rules → the Greens are the owner's BY THE ALLIANCE, so their passive (+2 M€ per TR step) answers the very
      // rating the card raised — inside the same call, measured into the same record.
      expect(answersOf(t)).deep.eq([{player: t.p1.id, card: ID, party: U, tr: 1, stock: {megacredits: 2}}]);
      const source = t.p1.terraformRatingSources.at(-1);
      expect(source, 'the rating is attributed to the card').deep.include({amount: 1, sourceName: ID});
    });

    it('the Greens enacted: +1 TR — and the ruling Greens\' own answer to the rating (+2 M€) rides the same record', () => {
      const t = owned([S, G, PartyName.MARS]);
      seatEnacted(t.parliament, quietResolutionOf(U));
      cubes(t, t.p2, G, 3);
      const tr = t.p1.terraformRating;
      const mc = t.p1.megaCredits;
      passToParliament(t.game);
      settleParliamentGates(t.game);
      expect(t.parliament.rulingParty()).eq(G);
      expect(t.p1.terraformRating).eq(tr + 1);
      const answer = (answersOf(t) ?? []).find((a) => a.card === ID);
      expect(answer).deep.include({party: G, tr: 1});
      expect(answer?.stock?.megacredits, 'the Greens pay 2 M€ for the step').eq(2);
      expect(t.p1.megaCredits - mc, 'the M€ the record names was paid').gte(2);
      // The model carries the record to the client, by colour.
      const model = getParliamentModel(t.game, t.p1);
      const modelAnswers = model?.phase?.summary?.rulingAnswers ?? model?.lastPhase?.rulingAnswers;
      expect(modelAnswers?.[0]).deep.include({player: t.p1.color, card: ID, party: G, tr: 1});
    });

    it('another party enacted raises nothing; the hook judges «becomes» itself', () => {
      const sci = owned();
      cubes(sci, sci.p2, S, 3);
      const before = sci.p1.terraformRating;
      passToParliament(sci.game);
      settleParliamentGates(sci.game);
      expect(sci.parliament.rulingParty()).eq(S);
      expect(sci.p1.terraformRating).eq(before);
      expect(answersOf(sci), 'nothing answered — nothing recorded').is.undefined;

      const t = owned();
      const tr = t.p1.terraformRating;
      t.card.onRulingPartyChanged(t.p1, U, U);
      t.card.onRulingPartyChanged(t.p1, S, U);
      expect(t.p1.terraformRating).eq(tr);
      t.card.onRulingPartyChanged(t.p1, G, U);
      expect(t.p1.terraformRating).eq(tr + 1);
    });

    it('a RELOAD mid-sitting never raises the rating twice', () => {
      const t = owned();
      cubes(t, t.p2, U, 3);
      const tr = t.p1.terraformRating;
      passToParliament(t.game);
      expect(t.parliament.phase?.step).eq('assembly');
      const game = Game.deserialize(structuredClone(t.game.serialize()));
      settleParliamentGates(game);
      expect(game.parliament!.rulingParty()).eq(U);
      expect(game.getPlayerById(t.p1.id).terraformRating).eq(tr + 1);
      expect(game.gameLog.filter((m) => m.message === EDEN_ALLIANCE_TR_LINE)).has.length(1);
    });

    it('playing the card while Unity ALREADY rules raises nothing («becomes»)', () => {
      const t = table();
      seatEnacted(t.parliament, quietResolutionOf(U));
      t.p1.megaCredits = 20;
      t.p1.cardsInHand.push(t.card);
      const tr = t.p1.terraformRating;
      t.p1.playCard(t.card, Payment.of({megacredits: 8}));
      runAllActions(t.game);
      expect(t.p1.terraformRating).eq(tr);
      expect(linesOf(t, ALLIANCE_HOLDS_LINE), 'the play journals the Greens it opened').has.length(1);
    });

    it('MarsBot is never asked: outside the party-effects aspect, no pair', () => {
      const [game, , bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      ([S, U, PartyName.MARS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      bot.playedCards.push(new EdenAlliance());
      expect(parliament.alliancesOf(bot)).deep.eq([]);
    });
  });

  describe('the preview', () => {
    it('nothing standing: the honest «nothing yet» and the rating note; Unity rules: «opens the Greens»', () => {
      const t = table();
      // A fresh table: the Greens rule by the STARTING rule — the play already opens Unity through them.
      expect(edenAllianceOpenings(t.p1, t.parliament)).deep.eq([{party: U, via: G, road: 'ruling', effectHeld: false}]);
      seatEnacted(t.parliament, quietResolutionOf(S));
      expect(notesOf(t, t.p1)).deep.eq([EDEN_ALLIANCE_NOTHING_NOTE, EDEN_ALLIANCE_TR_NOTE]);
      seatEnacted(t.parliament, quietResolutionOf(U));
      expect(edenAllianceOpenings(t.p1, t.parliament)).deep.eq([{party: G, via: U, road: 'ruling', effectHeld: false}]);
      expect(notesOf(t, t.p1)).deep.eq([ALLIANCE_OPENS_RULING_NOTE, EDEN_ALLIANCE_TR_NOTE]);
    });
  });
});
