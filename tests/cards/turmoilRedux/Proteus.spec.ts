import {expect} from 'chai';
import {
  PROTEUS_ACTION_DATA, PROTEUS_COLONY_TITLE, PROTEUS_OCEAN_TITLE, PROTEUS_STARTING_DATA, Proteus, matchingPreludeTags,
} from '../../../src/server/cards/turmoilRedux/Proteus';
import {Research} from '../../../src/server/cards/base/Research';
import {SpaceStation} from '../../../src/server/cards/base/SpaceStation';
import {TitaniumMine} from '../../../src/server/cards/base/TitaniumMine';
import {EarthOffice} from '../../../src/server/cards/base/EarthOffice';
import {Asteroid} from '../../../src/server/cards/base/Asteroid';
import {DeimosDown} from '../../../src/server/cards/base/DeimosDown';
import {OrbitalConstructionYard} from '../../../src/server/cards/prelude/OrbitalConstructionYard';
import {Biolab} from '../../../src/server/cards/prelude/Biolab';
import {DomeFarming} from '../../../src/server/cards/prelude/DomeFarming';
import {AlliedBanks} from '../../../src/server/cards/prelude/AlliedBanks';
import {UNMIContractor} from '../../../src/server/cards/prelude/UNMIContractor';
import {ResearchNetwork} from '../../../src/server/cards/prelude/ResearchNetwork';
import {TharsisRepublic} from '../../../src/server/cards/corporation/TharsisRepublic';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {ICard} from '../../../src/server/cards/ICard';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {TURMOIL_REDUX_NEW_CORPORATIONS, newCorporationCardNumber} from '../../../src/common/cards/turmoilReduxCorporations';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectColony} from '../../../src/server/inputs/SelectColony';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionFutility} from '../../../src/server/models/actionFutility';
import {addOcean, maxOutOceans, runAllActions} from '../../TestingUtils';
import {cast} from '../../../src/common/utils/utils';
import {tagReason} from '../../../src/server/cards/effectForecastPreviews';

/**
 * TR82 — PROTEUS: 45 M€ + 2 data here; «after you play a non-wild tag that matches a non-wild tag on your Preludes,
 * add 1 data resource to this card (your Preludes count)» — ONE predicate (`matchingPreludeTags`) for the live hook and
 * its forecast twin; «spend 6 data from here to place a colony or ocean tile». Every rule reading of the card file's
 * header is pinned here.
 */
type Table = {game: IGame, player: TestPlayer, rival: TestPlayer, card: Proteus};

function table(preludes: ReadonlyArray<ICard> = []): Table {
  const [game, player, rival] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true});
  game.phase = Phase.ACTION;
  const card = new Proteus();
  player.playedCards.push(card);
  for (const prelude of preludes) {
    player.playedCards.push(prelude);
  }
  player.megaCredits = 100;
  rival.megaCredits = 100;
  return {game, player, rival, card};
}

function play(t: Table, card: ICard, player: TestPlayer = t.player): void {
  player.playCard(card as never);
  runAllActions(t.game);
}

describe('Proteus', () => {
  describe('rule 0 — the card as printed', () => {
    it('a corporation for 45 M€, the Wild tag, a data holder, no VP, no first action — TR82, the fifth new corporation', () => {
      const card = new Proteus();
      expect(card.type).eq(CardType.CORPORATION);
      expect(card.startingMegaCredits).eq(45);
      expect(card.tags).deep.eq([Tag.WILD]);
      expect(card.resourceType).eq(CardResource.DATA);
      expect(card.victoryPoints).is.undefined;
      expect(card.initialActionText).is.undefined;
      expect(card.metadata.cardNumber).eq('TR82');
      expect(card.metadata.reimplements).is.undefined;
      expect(newCorporationCardNumber(CardName.PROTEUS)).eq('TR82');
      expect(TURMOIL_REDUX_NEW_CORPORATIONS[4]).deep.include({name: 'Proteus', authored: CardName.PROTEUS});
      expect(TURMOIL_REDUX_CARD_MANIFEST.corporationCards[CardName.PROTEUS]?.compatibility).deep.eq(['prelude', 'colonies']);
    });

    it('the play: 45 M€ and 2 data on the card', () => {
      const [, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true});
      const card = new Proteus();
      player.playCorporationCard(card);
      expect(player.megaCredits).eq(45);
      expect(card.resourceCount).eq(PROTEUS_STARTING_DATA);
    });
  });

  describe('rule 1 — the match predicate', () => {
    it('one match per matching PRINTED tag — duplicates kept, several tags each', () => {
      const t = table([new OrbitalConstructionYard(), new DomeFarming()]);
      expect(matchingPreludeTags(t.player, new SpaceStation())).deep.eq([Tag.SPACE]);
      expect(matchingPreludeTags(t.player, new TitaniumMine())).deep.eq([Tag.BUILDING]);
      // Deimos Down: Space + Event — the Space matches, the event tag is on no Prelude.
      expect(matchingPreludeTags(t.player, new DeimosDown())).deep.eq([Tag.SPACE]);
      expect(matchingPreludeTags(t.player, new Research())).deep.eq([]);
      const biolabTable = table([new Biolab()]);
      expect(matchingPreludeTags(biolabTable.player, new Research()), 'two Science tags → two').deep.eq([Tag.SCIENCE, Tag.SCIENCE]);
    });

    it('the wild tag matches nothing — on the played card or on a Prelude', () => {
      const t = table([new ResearchNetwork()]);
      expect(matchingPreludeTags(t.player, new SpaceStation())).deep.eq([]);
      expect(matchingPreludeTags(t.player, new Proteus())).deep.eq([]);
      const space = table([new OrbitalConstructionYard()]);
      expect(matchingPreludeTags(space.player, new ResearchNetwork())).deep.eq([]);
    });

    it('a Prelude never matches itself — the pool is the OTHER Preludes', () => {
      const yard = new OrbitalConstructionYard();
      const t = table([yard]);
      expect(matchingPreludeTags(t.player, yard)).deep.eq([]);
    });
  });

  describe('rule 2 — the effect: data at once, the owner\'s plays only', () => {
    it('a card with a matching tag: +1 data per tag', () => {
      const t = table([new OrbitalConstructionYard()]);
      play(t, new SpaceStation());
      expect(t.card.resourceCount).eq(1);
    });

    it('two matching tags of two Preludes: +2', () => {
      const t = table([new OrbitalConstructionYard(), new Biolab()]);
      t.card.resourceCount = 0;
      play(t, new Research());
      expect(t.card.resourceCount).eq(2);
    });

    it('an event with a matching tag pays (its tags are played)', () => {
      const t = table([new OrbitalConstructionYard()]);
      play(t, new Asteroid());
      expect(t.card.resourceCount).eq(1);
    });

    it('no matching tag — nothing; a rival\'s matching play — nothing', () => {
      const t = table([new OrbitalConstructionYard()]);
      play(t, new EarthOffice());
      expect(t.card.resourceCount).eq(0);
      play(t, new SpaceStation(), t.rival);
      expect(t.card.resourceCount).eq(0);
    });

    it('«your Preludes count»: the first Prelude pays nothing, the second with a matching tag pays', () => {
      const t = table();
      t.player.playedCards.push(new UNMIContractor());
      // Allied Banks (Earth) — its play is a play of its tag; UNMI Contractor (Earth) is the other Prelude.
      const banks = new AlliedBanks();
      t.player.playCard(banks);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(1);
    });

    it('a lone Prelude matches nothing (the pool is empty without itself)', () => {
      const t = table();
      t.player.playCard(new AlliedBanks());
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(0);
    });

    it('the corporation\'s own play pays nothing (Wild)', () => {
      const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true});
      player.playedCards.push(new OrbitalConstructionYard());
      const card = new Proteus();
      player.playCorporationCard(card);
      runAllActions(game);
      expect(card.resourceCount).eq(PROTEUS_STARTING_DATA);
    });

    it('with Tharsis Republic beside it (multicorp) both corporations answer their own triggers', () => {
      const t = table([new DomeFarming()]);
      t.player.playedCards.push(new TharsisRepublic());
      play(t, new TitaniumMine());
      expect(t.card.resourceCount).eq(1);
    });
  });

  describe('rule 3 — the forecast twin', () => {
    it('ONE exact fact per matching tag: the tag named, block #0, a data on this card', () => {
      const t = table([new OrbitalConstructionYard(), new Biolab()]);
      const trigger = new Research();
      t.player.cardsInHand.push(trigger);
      const facts = effectForecastForPlay(t.player, trigger, cardPlayPreview(t.player, trigger)).facts
        .filter((f) => f.source.name === CardName.PROTEUS);
      expect(facts.map((f) => f.certainty)).deep.eq(['exact', 'exact']);
      expect(facts.map((f) => f.reasonTag)).deep.eq([Tag.SCIENCE, Tag.SCIENCE]);
      expect(facts.map((f) => f.reason)).deep.eq([tagReason(Tag.SCIENCE), tagReason(Tag.SCIENCE)]);
      expect(new Set(facts.map((f) => f.id)).size, 'distinct ids').eq(2);
      for (const fact of facts) {
        expect(fact.source.channel).eq('card-played');
        expect(fact.source.kind).eq('corporation');
        expect(fact.source.printedEffect).eq(0);
        expect(fact.recipient.kind).eq('you');
        expect(fact.effects).to.have.lengthOf(1);
        expect(fact.effects[0]).deep.include({direction: 'gain', amount: 1, note: 'on this card'});
      }
    });

    it('no match forecasts NOTHING — not a «no» fact', () => {
      const t = table([new OrbitalConstructionYard()]);
      const trigger = new EarthOffice();
      t.player.cardsInHand.push(trigger);
      const facts = effectForecastForPlay(t.player, trigger, cardPlayPreview(t.player, trigger)).facts
        .filter((f) => f.source.name === CardName.PROTEUS);
      expect(facts).deep.eq([]);
    });

    it('the second Prelude\'s play forecasts its match', () => {
      const t = table([new UNMIContractor()]);
      const banks = new AlliedBanks();
      const facts = effectForecastForPlay(t.player, banks, cardPlayPreview(t.player, banks)).facts
        .filter((f) => f.source.name === CardName.PROTEUS);
      expect(facts.map((f) => f.reasonTag)).deep.eq([Tag.EARTH]);
    });

    it('a rival is never addressed (the hook answers the owner\'s plays only)', () => {
      const t = table([new OrbitalConstructionYard()]);
      const trigger = new SpaceStation();
      t.rival.cardsInHand.push(trigger);
      const facts = effectForecastForPlay(t.rival, trigger, cardPlayPreview(t.rival, trigger)).facts
        .filter((f) => f.source.name === CardName.PROTEUS);
      expect(facts).deep.eq([]);
    });
  });

  describe('rule 4 — the action: 6 data → a colony OR an ocean', () => {
    it('below 6 data: unavailable, the count and the need named', () => {
      const t = table();
      t.card.resourceCount = PROTEUS_ACTION_DATA - 1;
      expect(t.card.canAct(t.player)).is.false;
      const reasons = actionUnavailableReasons(t.player, t.card);
      expect(reasons.length).to.be.greaterThan(0);
    });

    it('at 6 data: both variants offered as ONE effect-choice prompt (never auto-selected) — the colony', () => {
      const t = table();
      t.card.resourceCount = PROTEUS_ACTION_DATA;
      expect(t.card.canAct(t.player)).is.true;
      t.card.action(t.player);
      runAllActions(t.game);
      expect(t.card.resourceCount, 'the price leaves at once').eq(0);
      const or = cast(t.player.getWaitingFor(), OrOptions);
      expect(or.options.map((o) => o.title)).deep.eq([PROTEUS_COLONY_TITLE, PROTEUS_OCEAN_TITLE]);
      expect(or.choiceContext?.source).deep.include({card: CardName.PROTEUS});
      or.options[0].cb(undefined);
      runAllActions(t.game);
      const select = cast(t.player.getWaitingFor(), SelectColony);
      const colony = select.colonies[0];
      select.cb(colony);
      runAllActions(t.game);
      expect(colony.colonies).to.include(t.player.id);
    });

    it('the ocean variant places an ocean', () => {
      const t = table();
      t.card.resourceCount = PROTEUS_ACTION_DATA;
      t.card.action(t.player);
      runAllActions(t.game);
      const or = cast(t.player.getWaitingFor(), OrOptions);
      or.options[1].cb(undefined);
      runAllActions(t.game);
      const before = t.game.board.getOceanSpaces().length;
      const select = cast(t.player.getWaitingFor(), SelectSpace);
      select.cb(select.spaces[0]);
      runAllActions(t.game);
      expect(t.game.board.getOceanSpaces().length).eq(before + 1);
    });

    it('no colony to build on: the colony variant is unavailable with a reason, the action stays (the ocean)', () => {
      const t = table();
      t.card.resourceCount = PROTEUS_ACTION_DATA;
      t.game.colonies = [];
      expect(t.card.canAct(t.player)).is.true;
      const preview = actionPreview(t.player, t.card);
      const branches = preview.branches ?? [];
      expect(branches).to.have.lengthOf(2);
      expect(branches[0].available).is.false;
      expect(branches[0].unavailableReason).to.not.be.undefined;
      expect(branches[1].available).is.true;
    });

    it('at the ocean ceiling the ocean variant stays EXECUTABLE with the futility verdict on its tile', () => {
      const t = table();
      t.card.resourceCount = PROTEUS_ACTION_DATA;
      maxOutOceans(t.player);
      expect(t.card.canAct(t.player)).is.true;
      const futility = actionFutility(t.player, t.card);
      expect(futility?.branches?.[1]?.futile, 'the ocean tile carries the verdict').is.true;
      expect(futility?.branches?.[1]?.verdict?.kind).eq('parameter-maxed');
      expect(futility?.verdict, 'the colony still has value').is.undefined;
    });

    it('no colony AND the ocean ceiling: the whole action carries the verdict, and stays available (the player may spend a turn)', () => {
      const t = table();
      t.card.resourceCount = PROTEUS_ACTION_DATA;
      t.game.colonies = [];
      maxOutOceans(t.player);
      expect(t.card.canAct(t.player)).is.true;
      const futility = actionFutility(t.player, t.card);
      expect(futility?.verdict?.kind).eq('parameter-maxed');
    });

    it('an ocean placed by `addOcean` counts toward the ceiling (sanity)', () => {
      const t = table();
      const before = t.game.board.getOceanSpaces().length;
      addOcean(t.player);
      expect(t.game.board.getOceanSpaces().length).eq(before + 1);
    });
  });

  describe('rule 5 — the reaction record (the console\'s scene)', () => {
    it('a play with two matches writes ONE record: the corporation, the channel, the cause, one card-resource impact of 2', () => {
      const t = table([new OrbitalConstructionYard(), new Biolab()]);
      t.card.resourceCount = 0;
      play(t, new Research());
      const records = t.game.cardReactions.filter((r) => r.card === CardName.PROTEUS);
      expect(records).to.have.lengthOf(1);
      const record = records[0];
      expect(record.owner).eq(t.player.color);
      expect(record.kind).eq('corporation');
      expect(record.channel).eq('card-played');
      expect(record.cause).deep.eq({card: CardName.RESEARCH});
      expect(record.impacts).deep.eq([{kind: 'card-resource', resource: CardResource.DATA, amount: 2, target: CardName.PROTEUS, to: t.player.color}]);
    });
  });

  describe('rule 6 — the deal and the save', () => {
    it('dealt only with Turmoil Redux, Preludes AND Colonies', () => {
      const [full] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true});
      expect(full.corporationDeck.drawPile.map((c) => c.name)).to.include(CardName.PROTEUS);
      const [noPrelude] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      expect(noPrelude.corporationDeck.drawPile.map((c) => c.name)).to.not.include(CardName.PROTEUS);
      const [classic] = testGame(2, {turmoilExtension: true, coloniesExtension: true, preludeExtension: true});
      expect(classic.corporationDeck.drawPile.map((c) => c.name)).to.not.include(CardName.PROTEUS);
    });

    it('the data survive a save / load', () => {
      const t = table();
      t.card.resourceCount = 5;
      const serialized = t.player.serialize();
      const entry = serialized.playedCards.find((c) => c.name === CardName.PROTEUS);
      expect(entry?.resourceCount).eq(5);
    });
  });
});
