import {expect} from 'chai';
import {NUCLEAR_WARHEAD_ENERGY, NUCLEAR_WARHEAD_VP, NuclearWarheadUtilization} from '../../../src/server/cards/turmoilRedux/NuclearWarheadUtilization';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {Thorgate} from '../../../src/server/cards/corporation/Thorgate';
import {PowerSupplyConsortium} from '../../../src/server/cards/base/PowerSupplyConsortium';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {Server} from '../../../src/server/models/ServerModel';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Resource} from '../../../src/common/Resource';
import {Payment} from '../../../src/common/inputs/Payment';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {resolutionCount} from '../../../src/server/parliament/resolutions/ResolutionCounts';
import {CENTRAL_POWER_GRID_ID} from '../../../src/server/parliament/resolutions/industrialists/CentralPowerGrid';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {answerQuestGate, questGateOf, quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {fakeCard, formatMessage, runAllActions} from '../../TestingUtils';

/**
 * TR55 — NUCLEAR WARHEAD UTILIZATION: the set's first INDUSTRIALISTS' plate
 * over a whole declaration — +9 energy, a fixed 2 VP, a Power tag. Every rule
 * reading of the card file's header is pinned here; the score cell's flight
 * of those 2 VP is the client's (docs/claude/console/score-cell.md).
 */
const I = PartyName.INDUSTRIALISTS;
const COST = 3;
const NW = CardName.NUCLEAR_WARHEAD_UTILIZATION;

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: NuclearWarheadUtilization};

/** A two-seat Redux table in the action phase, the Industrialists RULING, the card in hand and 20 M€. */
function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatEnacted(parliament, quietResolutionOf(I));
  const card = new NuclearWarheadUtilization();
  player.cardsInHand.push(card);
  player.megaCredits = 20;
  return {game, player, opponent, parliament, card};
}

/**
 * The PLAY as the player's OWN action-phase action — the event recorder's
 * root is what the chairman-quest tracker reads (`QuestTracker.eligible`).
 */
function playAsAction(t: Table): void {
  const events = t.game.events;
  events.beginAction(t.player, {kind: 'card', card: NW, owner: t.player.color}, {category: 'card-play'});
  try {
    t.player.playCard(t.card, Payment.of({megacredits: t.player.getCardCost(t.card)}));
  } finally {
    events.endScope();
  }
  runAllActions(t.game);
}

describe('NuclearWarheadUtilization', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a green card for 3, Power, the INDUSTRIALISTS\' plate, 2 VP, TR55 — in the Redux manifest without compatibility', () => {
      const card = t.card;
      expect(card.name).eq(NW);
      expect(card.type).eq(CardType.AUTOMATED);
      expect(card.cost).eq(COST);
      expect(card.tags, 'the corner holds one lightning').deep.eq([Tag.POWER]);
      expect(requiredPartyOf(card), 'the MIN plate holds the Industrialists\' cog — a requirement, not a tag').eq(I);
      expect(card.requirements).has.length(1);
      expect(card.victoryPoints, 'the VP badge on the Mars disc: «2»').eq(2);
      expect(NUCLEAR_WARHEAD_VP).eq(2);
      expect(card.resourceType).is.undefined;
      expect(card.behavior).deep.eq({stock: {energy: 9}});
      expect(NUCLEAR_WARHEAD_ENERGY).eq(9);
      expect(card.metadata.cardNumber).eq('TR55');
      expect(card.metadata.description).eq('Requires the Industrialists to be ruling or that you have 2 delegates there. Gain 9 energy resources.');
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[NW];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility, 'only the module\'s icon at the bottom left').is.undefined;
    });

    it('the face reads the scan: ONE row — a «9» digit beside ONE energy icon, never nine icons', () => {
      type Node = {type?: string, amount?: number, showDigit?: boolean};
      const rows = (t.card.metadata.renderData as unknown as {rows: Array<Array<Node | string>>}).rows;
      expect(rows).has.length(1);
      const items = rows[0].filter((n): n is Node => typeof n === 'object');
      expect(items).has.length(1);
      expect(items[0]).deep.include({type: 'energy', amount: 9, showDigit: true});
    });

    it('the structured text is the requirement block + the on-play energy — the VP badge is the face\'s own', () => {
      const info = buildCardInformation(new NuclearWarheadUtilization(), 'turmoilRedux');
      const texts = info?.groups.flatMap((g) => g.blocks.map((b) => b.text)) ?? [];
      expect(texts[0]).eq('Requires Industrialists to be ruling or that you have 2 delegates on its resolution.');
      expect(texts.some((s) => /9 energy/.test(s)), texts.join(' | ')).is.true;
    });
  });

  describe('rule 1 — the requirement: the Industrialists rule, or 2 of your delegates on their resolution', () => {
    beforeEach(() => {
      seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
      expect(t.parliament.rulingParty()).eq(PartyName.REDS);
    });

    function industrialistsCubes(n: number): void {
      let slot = t.parliament.slotOf(I);
      if (slot === undefined) {
        seatResolution(t.parliament, 0, quietResolutionOf(I));
        slot = t.parliament.slotOf(I)!;
      }
      for (let i = 0; i < n; i++) {
        t.parliament.placeVote(t.player, slot, t.parliament.lobby.has(t.player.id) ? 'lobby' : 'reserve');
      }
    }

    it('neither road: the NAMED party reason («their resolution is not on the vote» / «0 of 2»); one cube: «1 of 2»; two: playable', () => {
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [I, '2'], party: I, current: 0,
        partyOffVote: true, requirement: true, requirementKey: 'req:party',
      }]);
      industrialistsCubes(0);
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({party: I, current: 0});
      expect(unplayableReasons(t.player, t.card)[0].partyOffVote, 'their resolution is on the vote now').is.undefined;
      industrialistsCubes(1);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({party: I, current: 1});
      industrialistsCubes(1);
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
    });

    it('the Industrialists ruling: playable with no delegate anywhere', () => {
      seatEnacted(t.parliament, quietResolutionOf(I));
      expect(t.parliament.rulingParty()).eq(I);
      expect(t.player.canPlay(t.card)).is.true;
    });

    it('TR36 Council Seat lowers the EFFECT\'s threshold, never a REQUIREMENT\'s', () => {
      t.player.playedCards.push(new CouncilSeat());
      industrialistsCubes(1);
      expect(t.player.canPlay(t.card)).is.false;
    });
  });

  describe('rules 2–3 — the play: +9 energy into the STOCK, 2 VP in the live score', () => {
    it('+9 energy resources (never production), the cost paid, the journal reads «gained 9 energy»', () => {
      t.player.energy = 2;
      const at = t.game.gameLog.length;
      playAsAction(t);
      expect(t.player.energy).eq(11);
      expect(t.player.production.energy, 'stock, never production').eq(0);
      expect(t.player.megaCredits).eq(20 - COST);
      expect(t.player.playedCards.get(NW)).eq(t.card);
      const lines = t.game.gameLog.slice(at).map((m) => formatMessage(m));
      expect(lines.some((l) => /gained 9 energy/.test(l)), lines.join('\n')).is.true;
    });

    it('the 2 VP join the live score the moment the card lands — one row of `detailsCards`', () => {
      const before = t.player.getVictoryPoints();
      expect(before.detailsCards.find((c) => c.cardName === NW)).is.undefined;
      playAsAction(t);
      const after = t.player.getVictoryPoints();
      expect(after.total - before.total).eq(2);
      expect(after.victoryPoints - before.victoryPoints).eq(2);
      expect(after.detailsCards.find((c) => c.cardName === NW)).deep.include({victoryPoint: 2});
    });

    it('unused energy turns to heat at the production phase — the engine\'s rule, the card changes nothing', () => {
      playAsAction(t);
      t.player.production.override({heat: 0});
      t.player.heat = 0;
      t.player.runProductionPhase();
      expect(t.player.energy).eq(0);
      expect(t.player.heat).eq(9);
    });
  });

  describe('rule 4 — the Power tag', () => {
    it('Thorgate takes 3 M€ off: the card is FREE', () => {
      t.player.playedCards.push(new Thorgate());
      expect(t.player.getCardCost(t.card)).eq(0);
      t.player.megaCredits = 0;
      expect(t.player.canPlay(t.card)).is.true;
      playAsAction(t);
      expect(t.player.energy).eq(9);
    });

    it('another card\'s Power-tag requirement counts it (Power Supply Consortium: 2 power tags)', () => {
      const consortium = new PowerSupplyConsortium();
      t.player.playedCards.push(fakeCard({name: 'power 1' as CardName, tags: [Tag.POWER]}));
      t.player.megaCredits = 60;
      expect(t.player.canPlay(consortium)).is.false;
      playAsAction(t);
      expect(t.player.canPlay(consortium)).is.true;
    });

    it('RX04 Central Power Grid counts it at its enactment (`raw`)', () => {
      expect(resolutionCount(t.player, 'powerTags').count).eq(0);
      playAsAction(t);
      const counted = resolutionCount(t.player, 'powerTags');
      expect(counted.count).eq(1);
      expect(counted.cards).to.include(NW);
    });

    it('RX04\'s chairman quest «play 2 power tags»: 1 → 2 completes it; the gate stands, nothing applied before the answer', () => {
      t.parliament.quest = {definition: {goal: {kind: 'tag', tag: Tag.POWER}, count: 2}, source: CENTRAL_POWER_GRID_ID, generation: t.game.generation, progress: new Map()};
      t.parliament.addQuestProgress(t.player, 1);
      expect(t.parliament.questProgressOf(t.player)).eq(1);
      expect(t.parliament.chairman).is.undefined;
      const agendaBefore = t.parliament.agendaOf(t.player);
      playAsAction(t);
      expect(t.parliament.questProgressOf(t.player)).eq(2);
      expect(t.parliament.quest?.completedBy).eq(t.player.id);
      expect(questGateOf(t.player), 'the chairman-quest gate stands (BACK_OF_THE_LINE)').is.not.undefined;
      expect(t.parliament.chairman, 'not before the answer').is.undefined;
      answerQuestGate(t.game, t.player);
      expect(t.parliament.chairman).eq(t.player.id);
      expect(t.parliament.agendaOf(t.player)).eq(agendaBefore + 1);
    });
  });

  describe('rule 5 — preview = execution', () => {
    it('declarative: «+9 [energy] current → resulting» on the stock', () => {
      t.player.energy = 3;
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.kind).eq('declarative');
      const chip = preview.branches[0].effects.find((e) => e.icon === Resource.ENERGY);
      expect(chip).deep.include({direction: 'gain', amount: 9, current: 3, resulting: 12});
      expect(chip?.note, 'stock, never production').is.undefined;
    });
  });

  describe('rule 7 — a rival sees the +2 VP only with `showOtherPlayersVP`', () => {
    it('hidden by default: the rival\'s model of the player carries the empty breakdown; the player\'s own carries the 2', () => {
      playAsAction(t);
      expect(Server.getPlayer(t.player, true).victoryPointsBreakdown.detailsCards.find((c) => c.cardName === NW)).deep.include({victoryPoint: 2});
      expect(Server.getPlayer(t.player, false).victoryPointsBreakdown.total, 'the hidden-VP contract').eq(0);
    });
  });

  describe('rule 9 — save / load', () => {
    it('an ordinary card: the reloaded tableau scores the same 2 VP', () => {
      playAsAction(t);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const owner = reloaded.getPlayerById(t.player.id);
      expect(owner.playedCards.get(NW)?.name).eq(NW);
      expect(owner.getVictoryPoints().detailsCards.find((c) => c.cardName === NW)).deep.include({victoryPoint: 2});
      expect(owner.energy).eq(9);
    });
  });
});
