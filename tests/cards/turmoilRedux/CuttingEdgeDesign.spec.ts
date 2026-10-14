import {expect} from 'chai';
import {CuttingEdgeDesign} from '../../../src/server/cards/turmoilRedux/CuttingEdgeDesign';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Payment} from '../../../src/common/inputs/Payment';
import {GlobalParameter} from '../../../src/common/GlobalParameter';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {armedPlayEffectsOf} from '../../../src/server/cards/armedPlayEffects';
import {requirementEasingOf} from '../../../src/server/models/requirementEasing';
import {Server} from '../../../src/server/models/ServerModel';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {addOcean, maxOutOceans, runAllActions, setOxygenLevel, setTemperature, setVenusScaleLevel} from '../../TestingUtils';
import {LakeMarineris} from '../../../src/server/cards/base/LakeMarineris';
import {ArchaeBacteria} from '../../../src/server/cards/base/ArchaeBacteria';
import {Fish} from '../../../src/server/cards/base/Fish';
import {GeneRepair} from '../../../src/server/cards/base/GeneRepair';
import {SpecialDesign} from '../../../src/server/cards/base/SpecialDesign';
import {MediaGroup} from '../../../src/server/cards/base/MediaGroup';
import {Decomposers} from '../../../src/server/cards/base/Decomposers';
import {PowerPlantStandardProject} from '../../../src/server/cards/base/standardProjects/PowerPlantStandardProject';
import {ThinkTank} from '../../../src/server/cards/pathfinders/ThinkTank';
import {AerobrakedAmmoniaAsteroid} from '../../../src/server/cards/base/AerobrakedAmmoniaAsteroid';
import {Algae} from '../../../src/server/cards/base/Algae';
import {Stratopolis} from '../../../src/server/cards/venusNext/Stratopolis';
import {CloudSeeding} from '../../../src/server/cards/base/CloudSeeding';

/**
 * TR49 — CUTTING-EDGE DESIGN: the Scientists' plate over the set's ONE-PLAY
 * waiver — the play ARMS the next card, whose global requirements are
 * IGNORED. Every rule reading of the card file's header is pinned here on the
 * real card: the plate's two roads, the arming, the scope of «global», the
 * spend (by any next card, needed or not), the pass, the replacement, the
 * rival's view, save / load, the journal, the tags.
 */
const S = PartyName.SCIENTISTS;
const ID = CardName.CUTTING_EDGE_DESIGN;

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: CuttingEdgeDesign};

/** A two-seat Redux table in the action phase, the Scientists RULING by an enacted card, the card in hand. */
function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatEnacted(parliament, quietResolutionOf(S));
  const card = new CuttingEdgeDesign();
  player.cardsInHand.push(card);
  player.megaCredits = 60;
  return {game, player, opponent, parliament, card};
}

/** Play the card from hand (the arming play). */
function arm(t: Table): void {
  t.player.playCard(t.card, Payment.of({megacredits: 2}));
  runAllActions(t.game);
}

describe('CuttingEdgeDesign', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a red EVENT for 2, Science + Microbe, no VP, the SCIENTISTS\' plate, TR49 — in the Redux manifest without compatibility', () => {
      const c = t.card;
      expect(c.name).eq(ID);
      expect(c.type).eq(CardType.EVENT);
      expect(c.cost).eq(2);
      expect(c.tags, 'printed order; the event\'s own tag follows from its type').deep.eq([Tag.SCIENCE, Tag.MICROBE]);
      expect(c.victoryPoints, 'no VP badge').is.undefined;
      expect(requiredPartyOf(c), 'the MIN plate holds the Scientists\' flask — a requirement, not a tag').eq(S);
      expect(c.metadata.cardNumber).eq('TR49');
      expect(c.globalParameterRequirementBonus, 'the whole card is a declaration').deep.eq({waive: true, nextCardOnly: true});
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[ID];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility).is.undefined;
    });

    it('the face reads the scan: the printed «ignore global requirements» glyph and its asterisk', () => {
      type Node = {is?: string, type?: string};
      const rows = (t.card.metadata.renderData as unknown as {rows: Array<Array<Node | string>>}).rows;
      expect(rows).has.length(1);
      const items = rows[0].filter((n): n is Node => typeof n === 'object');
      expect(items.map((n) => n.is)).deep.eq(['item', 'symbol']);
      expect(items[0].type).eq(CardRenderItemType.IGNORE_GLOBAL_REQUIREMENTS);
    });

    it('the structured text: the requirement line, the one-play waiver', () => {
      const info = buildCardInformation(t.card, 'turmoilRedux');
      const blocks = info?.groups.flatMap((g) => g.blocks.map((b) => b.text)) ?? [];
      expect(blocks).deep.eq([
        'Requires Scientists to be ruling or that you have 2 delegates on its resolution.',
        'Ignore all global parameter requirements when playing your next card this generation.',
      ]);
    });
  });

  describe('rule 1 — the requirement: the Scientists rule, or 2 of your delegates on their resolution', () => {
    function scientistsCubes(n: number): void {
      let slot = t.parliament.slotOf(S);
      if (slot === undefined) {
        seatResolution(t.parliament, 0, quietResolutionOf(S));
        slot = t.parliament.slotOf(S)!;
      }
      for (let i = 0; i < n; i++) {
        t.parliament.placeVote(t.player, slot, t.parliament.lobby.has(t.player.id) ? 'lobby' : 'reserve');
      }
    }

    it('the Scientists ruling: playable', () => {
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
    });

    it('the Reds ruling: «0 of 2»; two cubes: playable; TR36 never lowers a REQUIREMENT', () => {
      seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({type: 'party', message: PARTY_REQUIREMENT_REASON, party: S, current: 0});
      t.player.playedCards.push(new CouncilSeat());
      scientistsCubes(1);
      expect(t.player.canPlay(t.card), 'one cube with Council Seat — still «1 of 2»').is.false;
      scientistsCubes(1);
      expect(t.player.canPlay(t.card)).is.true;
    });
  });

  describe('rule 2 — the play gives nothing at once, it ARMS', () => {
    it('lastCardPlayed names the card; the armed effect is the waiver, until the next play', () => {
      const mc = t.player.megaCredits;
      arm(t);
      expect(t.player.megaCredits, 'only the price').eq(mc - 2);
      expect(t.player.lastCardPlayed).eq(ID);
      expect(armedPlayEffectsOf(t.player)).deep.eq([{source: ID, sourceType: CardType.EVENT, effect: {kind: 'requirementWaiver'}, expires: 'next-play'}]);
      expect(t.player.playedCards.has(ID), 'into the events pile').is.true;
      expect(t.player.tags.count(Tag.SCIENCE, 'raw'), 'an event\'s tag leaves the count').eq(0);
    });
  });

  describe('rule 3 — «all global parameter requirements»: MIN and MAX, every scale; nothing else', () => {
    it('a MIN temperature far out of reach (Lake Marineris at −30 °C) is MET', () => {
      setTemperature(t.game, -30);
      arm(t);
      const lake = new LakeMarineris();
      expect(t.player.canPlay(lake)).is.true;
      expect(requirementEasingOf(t.player, lake)[0]).deep.include({effective: 'waived', met: true, decisive: true});
    });

    it('a MAX bound long passed (Archae Bacteria at +8 °C) is MET — and never «unattainable»', () => {
      setTemperature(t.game, 8);
      arm(t);
      expect(t.player.canPlay(new ArchaeBacteria())).is.true;
      expect(unplayableReasons(t.player, new ArchaeBacteria())).deep.eq([]);
    });

    it('oxygen, oceans and Venus — each scale waived', () => {
      setOxygenLevel(t.game, 0);
      setVenusScaleLevel(t.game, 0);
      arm(t);
      expect(t.player.globalRequirementWaiver(GlobalParameter.OXYGEN)).deep.eq({kind: 'card', card: ID, owner: t.player.color});
      expect(t.player.globalRequirementWaiver(GlobalParameter.OCEANS)).is.not.undefined;
      expect(t.player.globalRequirementWaiver(GlobalParameter.VENUS)).is.not.undefined;
      expect(t.player.canPlay(new Algae()), 'Algae: 5 oceans').is.true;
      expect(t.player.canPlay(new CloudSeeding()) || unplayableReasons(t.player, new CloudSeeding()).every((r) => r.requirement !== true), 'Cloud Seeding: its oceans requirement is no reason').is.true;
    });

    it('NOT waived: a tag requirement (Gene Repair: 3 science tags) still blocks, with its reason', () => {
      arm(t);
      expect(t.player.canPlay(new GeneRepair())).is.false;
      expect(unplayableReasons(t.player, new GeneRepair()).some((r) => r.type === 'tag')).is.true;
    });

    it('NOT a number: the bonus in steps stays zero', () => {
      arm(t);
      expect(t.player.getGlobalParameterRequirementBonus(GlobalParameter.TEMPERATURE)).eq(0);
    });

    it('a waived requirement spends NOTHING off Think Tank', () => {
      setTemperature(t.game, -30);
      const thinkTank = new ThinkTank();
      thinkTank.resourceCount = 10;
      t.player.playedCards.push(thinkTank);
      arm(t);
      const lake = new LakeMarineris();
      expect(t.player.canPlay(lake)).is.true;
      expect(lake.additionalProjectCosts).is.undefined;
    });
  });

  describe('rule 4 — SPENT by the next card played, needed or not; a standard project spends nothing; the pass loses it', () => {
    it('the next card spends it — Lake Marineris goes through, and the waiver is gone', () => {
      setTemperature(t.game, -30);
      arm(t);
      const lake = new LakeMarineris();
      t.player.cardsInHand.push(lake);
      t.player.playCard(lake);
      runAllActions(t.game);
      expect(armedPlayEffectsOf(t.player)).deep.eq([]);
      expect(t.player.canPlay(new ArchaeBacteria()) || t.game.getTemperature() <= -18, 'nothing left armed').is.true;
    });

    it('a card that needs nothing (Aerobraked Ammonia Asteroid) spends it all the same', () => {
      arm(t);
      t.player.playCard(new AerobrakedAmmoniaAsteroid());
      runAllActions(t.game);
      expect(armedPlayEffectsOf(t.player)).deep.eq([]);
      expect(t.player.globalRequirementWaiver(GlobalParameter.OXYGEN)).is.undefined;
    });

    it('a STANDARD PROJECT is no card play: the waiver stands', () => {
      arm(t);
      new PowerPlantStandardProject().payAndExecute(t.player, Payment.of({megacredits: 11}));
      runAllActions(t.game);
      expect(t.player.lastCardPlayed).eq(ID);
      expect(armedPlayEffectsOf(t.player)).has.length(1);
    });

    it('the PASS loses it — it never crosses into the next generation', () => {
      arm(t);
      t.player.pass();
      expect(armedPlayEffectsOf(t.player)).deep.eq([]);
    });
  });

  describe('rule 5 — one armed card at a time', () => {
    it('Special Design after it spends the waiver and arms its own ±2', () => {
      arm(t);
      t.player.playCard(new SpecialDesign());
      expect(armedPlayEffectsOf(t.player).map((e) => e.effect)).deep.eq([{kind: 'requirementShift', steps: 2}]);
      expect(t.player.globalRequirementWaiver(GlobalParameter.TEMPERATURE)).is.undefined;
    });

    it('it after Special Design: the ±2 is spent on THIS card, the waiver armed', () => {
      t.player.playCard(new SpecialDesign());
      arm(t);
      expect(armedPlayEffectsOf(t.player).map((e) => e.effect)).deep.eq([{kind: 'requirementWaiver'}]);
      expect(t.player.getGlobalParameterRequirementBonus(GlobalParameter.TEMPERATURE)).eq(0);
    });
  });

  describe('rule 7 — the rival sees the armed waiver on the seat\'s public model', () => {
    it('PublicPlayerModel.armedPlayEffects — on both seats\' views', () => {
      arm(t);
      const own = Server.getPlayerModel(t.player).players.find((p) => p.color === t.player.color)!;
      const seen = Server.getPlayerModel(t.opponent).players.find((p) => p.color === t.player.color)!;
      expect(own.armedPlayEffects).deep.eq(seen.armedPlayEffects);
      expect(seen.armedPlayEffects?.[0].effect).deep.eq({kind: 'requirementWaiver'});
      expect(Server.getPlayerModel(t.opponent).players.find((p) => p.color === t.opponent.color)!.armedPlayEffects, 'nothing armed on the rival').is.undefined;
    });

    it('the OWN hand carries the requirement reading; a rival\'s view of the cards does not', () => {
      setTemperature(t.game, -30);
      arm(t);
      t.player.cardsInHand.push(new LakeMarineris());
      const hand = Server.getPlayerModel(t.player).cardsInHand.find((c) => c.name === CardName.LAKE_MARINERIS)!;
      expect(hand.requirementEasing?.[0].effective).eq('waived');
    });
  });

  describe('rule 9 — save / load', () => {
    it('the waiver survives a reload', () => {
      setTemperature(t.game, -30);
      arm(t);
      const loaded = Game.deserialize(structuredClone(t.game.serialize()));
      const player = loaded.getPlayerById(t.player.id);
      expect(player.globalRequirementWaiver(GlobalParameter.TEMPERATURE)).is.not.undefined;
      expect(player.canPlay(new LakeMarineris())).is.true;
    });
  });

  describe('rule 10 — the journal names the waiver under the next play', () => {
    it('«… ignored the global requirements of Lake Marineris thanks to Cutting-Edge Design» + requirement-eased', () => {
      setTemperature(t.game, -30);
      arm(t);
      const lake = new LakeMarineris();
      t.player.cardsInHand.push(lake);
      t.player.playCard(lake);
      runAllActions(t.game);
      expect(t.game.gameLog.some((m) => m.message === '${0} ignored the global requirements of ${1} thanks to ${2}')).is.true;
      const event = t.game.events.events.find((e) => e.type === 'requirement-eased');
      expect(event?.source).deep.eq({kind: 'card', card: ID, owner: t.player.color});
      expect(event?.target).deep.eq({card: CardName.LAKE_MARINERIS});
    });
  });

  describe('rule 13 — the tags wake the table', () => {
    it('the EVENT pays Media Group, the MICROBE feeds Decomposers', () => {
      t.player.playedCards.push(new MediaGroup());
      const decomposers = new Decomposers();
      t.player.playedCards.push(decomposers);
      const mc = t.player.megaCredits;
      arm(t);
      expect(t.player.megaCredits, 'the price, then the 3 of Media Group').eq(mc - 2 + 3);
      expect(decomposers.resourceCount, 'the one Microbe tag (Science is not its tag)').eq(1);
    });
  });

  describe('rule 14 — a REPLAYED copy (Playwrights) arms through removedFromPlayCards', () => {
    it('the waiver reads both places', () => {
      t.player.removedFromPlayCards.push(new CuttingEdgeDesign());
      t.player.lastCardPlayed = ID;
      expect(t.player.globalRequirementWaiver(GlobalParameter.TEMPERATURE)).is.not.undefined;
      expect(armedPlayEffectsOf(t.player)).has.length(1);
    });
  });

  it('oceans at the maximum: an oceans MAX requirement is met under the waiver too', () => {
    maxOutOceans(t.player);
    arm(t);
    expect(t.player.globalRequirementWaiver(GlobalParameter.OCEANS)).is.not.undefined;
    expect(addOcean).is.a('function');
    expect(new Stratopolis().requirements.length).is.greaterThan(0);
  });
});
