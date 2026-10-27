import {expect} from 'chai';
import {AEROSPACE_COMPANY_KINDS, AerospaceCompany} from '../../../src/server/cards/turmoilRedux/AerospaceCompany';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {EvaMechs} from '../../../src/server/cards/turmoilRedux/EvaMechs';
import {ForestryMechs} from '../../../src/server/cards/turmoilRedux/ForestryMechs';
import {MarsArmyShips} from '../../../src/server/cards/turmoilRedux/MarsArmyShips';
import {Proteus} from '../../../src/server/cards/turmoilRedux/Proteus';
import {SecurityFleet} from '../../../src/server/cards/base/SecurityFleet';
import {MiningOperations} from '../../../src/server/cards/prelude/MiningOperations';
import {OrbitalConstructionYard} from '../../../src/server/cards/prelude/OrbitalConstructionYard';
import {SelfReplicatingRobots} from '../../../src/server/cards/promo/SelfReplicatingRobots';
import {ActivePreludeCard} from '../../../src/server/cards/prelude2/ActivePreludeCard';
import {AddResourcesToCard} from '../../../src/server/deferredActions/AddResourcesToCard';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {ICard} from '../../../src/server/cards/ICard';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {Game} from '../../../src/server/Game';
import {IGame} from '../../../src/server/IGame';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions} from '../../TestingUtils';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {SelectCardModel} from '../../../src/common/models/PlayerInputModel';
import {cast} from '../../../src/common/utils/utils';

/**
 * TRP8 — AEROSPACE COMPANY: a Prelude with no play effect, Space + Building; «Action: add 1 mech or fighter resource
 * to ANY card» — ONE declaration over a LIST of kinds, ONE pick over the union of the holders, the kind of the unit
 * the kind of the chosen card. Every rule reading of the card file's header is pinned here.
 */
type Table = {game: IGame, player: TestPlayer, rival: TestPlayer, card: AerospaceCompany};

function table(): Table {
  const [game, player, rival] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true});
  game.phase = Phase.ACTION;
  const card = new AerospaceCompany();
  player.playedCards.push(card);
  return {game, player, rival, card};
}

/** Take the action and run the queue to its pick. */
function act(t: Table): SelectCard<ICard> {
  expect(t.card.action(t.player)).is.undefined;
  runAllActions(t.game);
  return cast(t.player.popWaitingFor(), SelectCard);
}

describe('AerospaceCompany', () => {
  describe('rule 1 — the printed card', () => {
    it('a PRELUDE with an action — Space + Building, no play behavior, no cost, no VP — TRP8', () => {
      const card = new AerospaceCompany();
      expect(card).instanceOf(ActivePreludeCard);
      expect(card.type).eq(CardType.PRELUDE);
      expect(card.tags).deep.eq([Tag.SPACE, Tag.BUILDING]);
      expect(card.behavior).is.undefined;
      expect(card.cost).eq(0);
      expect(card.victoryPoints).is.undefined;
      expect(card.resourceType).is.undefined;
      expect(card.metadata.cardNumber).eq('TRP8');
      expect(card.actionBehavior).deep.eq({addResourcesToAnyCard: {type: [CardResource.MECH, CardResource.FIGHTER], count: 1, mustHaveCard: true}});
      expect(AEROSPACE_COMPANY_KINDS).deep.eq([CardResource.MECH, CardResource.FIGHTER]);
    });

    it('a prelude of the manifest, dealt only beside the Prelude expansion', () => {
      const entry = TURMOIL_REDUX_CARD_MANIFEST.preludeCards[CardName.AEROSPACE_COMPANY];
      expect(entry?.compatibility).eq('prelude');
      expect(TURMOIL_REDUX_CARD_MANIFEST.projectCards[CardName.AEROSPACE_COMPANY]).is.undefined;
    });
  });

  describe('rule 2 — the play', () => {
    it('lays the card down: two tags counted, nothing added, nothing asked', () => {
      const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true});
      const eva = new EvaMechs();
      player.playedCards.push(eva);
      const space = player.tags.count(Tag.SPACE, 'raw');
      const building = player.tags.count(Tag.BUILDING, 'raw');
      const card = new AerospaceCompany();
      expect(card.canPlay(player)).is.true;
      player.playCard(card);
      runAllActions(game);
      expect(player.popWaitingFor()).is.undefined;
      expect(player.tableau.has(CardName.AEROSPACE_COMPANY)).is.true;
      expect(player.tags.count(Tag.SPACE, 'raw')).eq(space + 1);
      expect(player.tags.count(Tag.BUILDING, 'raw')).eq(building + 1);
      expect(eva.resourceCount).eq(0);
      expect(player.actionsThisGeneration.size).eq(0);
    });

    it('is always playable — even with no holder on the table (no play gate → it never burns)', () => {
      const [, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true});
      expect(new AerospaceCompany().canPlay(player)).is.true;
    });

    it('Proteus reads its tags like any prelude\'s — the matches of the OTHER preludes', () => {
      const t = table();
      const proteus = new Proteus();
      t.player.playedCards.push(proteus);
      t.player.playCard(new MiningOperations());
      runAllActions(t.game);
      expect(proteus.resourceCount).eq(1, 'Building matches TRP8');
      t.player.playCard(new OrbitalConstructionYard());
      runAllActions(t.game);
      expect(proteus.resourceCount).eq(2, 'Space matches TRP8');
    });
  });

  describe('rule 3 — available ⇔ a holder of mechs OR fighters', () => {
    it('no holder → unavailable, with the existing reason', () => {
      const t = table();
      expect(t.card.canAct(t.player)).is.false;
      expect(actionUnavailableReasons(t.player, t.card)).deep.eq([{type: 'target', message: 'No card to add the resource to'}]);
    });

    it('one mech holder, or one fighter holder, opens it', () => {
      const mech = table();
      mech.player.playedCards.push(new EvaMechs());
      expect(mech.card.canAct(mech.player)).is.true;
      const fighter = table();
      fighter.player.playedCards.push(new SecurityFleet());
      expect(fighter.card.canAct(fighter.player)).is.true;
      expect(actionUnavailableReasons(fighter.player, fighter.card)).deep.eq([]);
    });

    it('a rival\'s holder never counts; the card is never its own holder', () => {
      const t = table();
      t.rival.playedCards.push(new EvaMechs());
      expect(t.card.canAct(t.player)).is.false;
      expect(new AddResourcesToCard(t.player, AEROSPACE_COMPANY_KINDS).getCards()).deep.eq([]);
    });
  });

  describe('rule 4 — ONE pick over the union, the kind follows the card', () => {
    it('a sole candidate is still ASKED — never applied in silence', () => {
      const t = table();
      const eva = new EvaMechs();
      t.player.playedCards.push(eva);
      const pick = act(t);
      expect(pick.cards.map((c) => c.name)).deep.eq([CardName.EVA_MECHS]);
      expect(eva.resourceCount).eq(0);
    });

    it('the union in tableau order, each once; a fighter lands on the fighter holder', () => {
      const t = table();
      const eva = new EvaMechs();
      const ships = new MarsArmyShips();
      const forestry = new ForestryMechs();
      const fleet = new SecurityFleet();
      t.player.playedCards.push(eva, ships, forestry, fleet, new SelfReplicatingRobots());
      const pick = act(t);
      expect(pick.cards.map((c) => c.name)).deep.eq([CardName.EVA_MECHS, CardName.MARS_ARMY_SHIPS, CardName.FORESTRY_MECHS, CardName.SECURITY_FLEET]);
      const model = pick.toModel(t.player) as SelectCardModel;
      expect(model.resourceGainPrompt?.cardResources).deep.eq(['mech', 'fighter']);
      expect(model.resourceGainPrompt?.cardResource).is.undefined;
      expect(model.resourceGainPrompt?.cardResourceByCard).deep.eq({
        [CardName.EVA_MECHS]: 'mech',
        [CardName.MARS_ARMY_SHIPS]: 'fighter',
        [CardName.FORESTRY_MECHS]: 'mech',
        [CardName.SECURITY_FLEET]: 'fighter',
      });
      pick.cb([ships]);
      runAllActions(t.game);
      expect(ships.resourceCount).eq(1);
      expect([eva, forestry, fleet].map((c) => c.resourceCount)).deep.eq([0, 0, 0]);
    });

    it('the pick\'s title names BOTH kinds — never the raw word «resources»', () => {
      const t = table();
      t.player.playedCards.push(new EvaMechs(), new SecurityFleet());
      const pick = act(t);
      const title = pick.title;
      expect(typeof title).not.eq('string');
      if (typeof title !== 'string') {
        expect(title.message).eq('Select a card — ${1} or ${2}: +${0}');
        expect(title.data.map((d) => d.value)).deep.eq(['1', CardResource.MECH, CardResource.FIGHTER]);
      }
    });

    it('a one-kind pick keeps its title byte for byte', () => {
      const t = table();
      t.player.playedCards.push(new EvaMechs(), new ForestryMechs());
      const pick = new AddResourcesToCard(t.player, CardResource.MECH, {autoSelect: false}).execute();
      const title = cast(pick, SelectCard).title;
      if (typeof title === 'string') {
        expect.fail('a Message title');
      } else {
        expect(title.message).eq('Select a card — ${1}: +${0}');
      }
    });
  });

  describe('rule 5 — the preview is the execution', () => {
    it('declarative: ONE chip naming both kinds, the pick over the SAME candidates', () => {
      const t = table();
      t.player.playedCards.push(new EvaMechs(), new MarsArmyShips());
      const preview = actionPreview(t.player, t.card);
      expect(preview.kind).eq('declarative');
      expect(preview.branches).length(1);
      const [branch] = preview.branches;
      expect(branch.available).is.true;
      expect(branch.effects).deep.eq([{direction: 'gain', icon: 'resources', icons: ['mech', 'fighter'], amount: 1, note: 'to a card'}]);
      expect(branch.steps.map((s) => s.kind)).deep.eq(['input']);
      const step = branch.steps[0];
      if (step.kind !== 'input') {
        expect.fail('an input step');
      } else {
        expect(step.cardResource).is.undefined;
        expect((step.input as SelectCardModel).cards.map((c) => c.name)).deep.eq([CardName.EVA_MECHS, CardName.MARS_ARMY_SHIPS]);
      }
    });

    it('with no holder the branch is unavailable with the same reason', () => {
      const t = table();
      const [branch] = actionPreview(t.player, t.card).branches;
      expect(branch.available).is.false;
    });
  });

  describe('rule 6 — the card holds nothing; the unit obeys its holder', () => {
    it('a mech lands on the chosen mech holder and is that card\'s resource', () => {
      const t = table();
      const eva = new EvaMechs();
      t.player.playedCards.push(eva);
      act(t).cb([eva]);
      runAllActions(t.game);
      expect(eva.resourceCount).eq(1);
      expect(t.card.resourceCount).eq(0);
      expect(t.player.getResourceCards().map((c) => c.name)).not.includes(CardName.AEROSPACE_COMPANY);
    });
  });

  describe('rule 7 — the action is used; save / reload', () => {
    it('playActionCard marks it for the generation; the flag and the card survive a reload', () => {
      const t = table();
      const fleet = new SecurityFleet();
      t.player.playedCards.push(fleet);
      expect(t.player.getPlayableActionCards().map((c) => c.name)).includes(CardName.AEROSPACE_COMPANY);
      t.player.playActionCard().process({type: 'card', cards: [CardName.AEROSPACE_COMPANY]}, t.player);
      runAllActions(t.game);
      cast(t.player.popWaitingFor(), SelectCard).cb([fleet]);
      runAllActions(t.game);
      expect(fleet.resourceCount).eq(1);
      expect(t.player.actionsThisGeneration.has(CardName.AEROSPACE_COMPANY)).is.true;
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const again = reloaded.getPlayerById(t.player.id);
      expect(again.tableau.has(CardName.AEROSPACE_COMPANY)).is.true;
      expect(again.actionsThisGeneration.has(CardName.AEROSPACE_COMPANY)).is.true;
    });
  });
});
