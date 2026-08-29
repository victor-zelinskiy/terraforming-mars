import {expect} from 'chai';
import {DeltaWorks} from '../../../src/server/cards/delta/DeltaWorks';
import {DELTA_PROJECT_CARD_MANIFEST} from '../../../src/server/cards/delta/DeltaProjectCardManifest';
import {DeltaProjectExpansion} from '../../../src/server/delta/DeltaProjectExpansion';
import {TradeWithEnergy} from '../../../src/server/player/Colonies';
import {GameCards} from '../../../src/server/GameCards';
import {DEFAULT_GAME_OPTIONS} from '../../../src/server/game/GameOptions';
import {IGame} from '../../../src/server/IGame';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {ColonyName} from '../../../src/common/colonies/ColonyName';
import {SelectAmount} from '../../../src/server/inputs/SelectAmount';
import {cast, toName} from '../../../src/common/utils/utils';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';

function grantPathTags(player: TestPlayer, pos: number): void {
  const tags = [Tag.BUILDING, Tag.POWER, Tag.EARTH, Tag.SPACE, Tag.SCIENCE,
    Tag.PLANT, Tag.MICROBE, Tag.JOVIAN, Tag.ANIMAL].slice(0, Math.min(pos, 9));
  player.playedCards.push(fakeCard({tags}));
}

describe('DeltaWorks', () => {
  let card: DeltaWorks;
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;

  beforeEach(() => {
    card = new DeltaWorks();
    [game, player, opponent] = testGame(2, {deltaProjectExpansion: true, coloniesExtension: true,
      customColoniesList: [ColonyName.LUNA, ColonyName.PLUTO, ColonyName.IAPETUS, ColonyName.IO, ColonyName.EUROPA]});
    player.playedCards.push(card);
  });

  describe('metadata and gating', () => {
    it('matches the printed card', () => {
      expect(card.name).to.eq(CardName.DELTA_WORKS);
      expect(card.type).to.eq(CardType.ACTIVE);
      expect(card.cost).to.eq(4);
      expect(card.tags).to.deep.eq([Tag.BUILDING]);
      expect(card.metadata.cardNumber).to.eq('DP06');
      expect(card.requirements).to.deep.eq([]);
      expect(card.getVictoryPoints(player)).to.eq(0);
    });

    it('needs BOTH expansions: deltaProject (module) and colonies (compatibility)', () => {
      expect(DELTA_PROJECT_CARD_MANIFEST.projectCards[CardName.DELTA_WORKS]).is.not.undefined;
      const both = new GameCards({...DEFAULT_GAME_OPTIONS, deltaProjectExpansion: true, coloniesExtension: true}).getProjectCards().map(toName);
      const deltaOnly = new GameCards({...DEFAULT_GAME_OPTIONS, deltaProjectExpansion: true, coloniesExtension: false}).getProjectCards().map(toName);
      const coloniesOnly = new GameCards({...DEFAULT_GAME_OPTIONS, deltaProjectExpansion: false, coloniesExtension: true}).getProjectCards().map(toName);
      expect(both.filter((n) => n === CardName.DELTA_WORKS)).to.have.length(1);
      expect(deltaOnly).to.not.contain(CardName.DELTA_WORKS);
      expect(coloniesOnly).to.not.contain(CardName.DELTA_WORKS);
    });
  });

  describe('substitution availability', () => {
    it('is the steel stock while the card is in the tableau, else 0', () => {
      player.steel = 4;
      expect(DeltaWorks.steelSubstituteAvailable(player)).to.eq(4);
      expect(DeltaWorks.steelSubstituteAvailable(opponent)).to.eq(0);
      opponent.cardsInHand.push(new DeltaWorks());
      expect(DeltaWorks.steelSubstituteAvailable(opponent)).to.eq(0);
    });
  });

  describe('the Hydronetwork action', () => {
    it('0 energy + 2 steel reaches a 2-step destination and pays in steel', () => {
      grantPathTags(player, 2);
      player.energy = 0;
      player.steel = 2;
      expect(DeltaProjectExpansion.getValidAdvanceSteps(player)).to.deep.eq([1, 2]);
      DeltaProjectExpansion.advance(player, 2, undefined, {payment: {energy: 0, steel: 2}});
      expect(player.deltaProjectData!.position).to.eq(2);
      expect(player.steel).to.eq(0);
      expect(player.energy).to.eq(0);
    });

    for (const [energy, steel] of [[3, 0], [2, 1], [1, 2], [0, 3]] as const) {
      it(`a cost-3 move accepts the ${energy}E + ${steel}S mix exactly`, () => {
        grantPathTags(player, 3);
        player.energy = 3;
        player.steel = 3;
        DeltaProjectExpansion.advance(player, 3, undefined, {payment: {energy, steel}});
        expect(player.energy).to.eq(3 - energy);
        expect(player.steel).to.eq(3 - steel);
        expect(player.deltaProjectData!.position).to.eq(3);
      });
    }

    it('the default (no requested mix) is energy-first: steel covers only the deficit', () => {
      grantPathTags(player, 3);
      player.energy = 2;
      player.steel = 5;
      DeltaProjectExpansion.advance(player, 3);
      expect(player.energy).to.eq(0);
      expect(player.steel).to.eq(4);
    });

    it('rejects under/over-payment, steel without the card, and unaffordable mixes — atomically', () => {
      grantPathTags(player, 2);
      player.energy = 2;
      player.steel = 2;
      expect(() => DeltaProjectExpansion.advance(player, 2, undefined, {payment: {energy: 2, steel: 1}})).to.throw(/does not equal/);
      expect(() => DeltaProjectExpansion.advance(player, 2, undefined, {payment: {energy: 0, steel: 1}})).to.throw(/does not equal/);
      expect(() => DeltaProjectExpansion.advance(player, 2, undefined, {payment: {energy: 3, steel: -1}})).to.throw(/non-negative/);
      expect(() => DeltaProjectExpansion.advance(player, 2, undefined, {payment: {energy: 0, steel: 2}})).to.not.throw;
      // Nothing was spent by the rejections above.
      expect(player.energy).to.eq(2);
      expect(player.steel).to.eq(2);
      expect(player.deltaProjectData!.position).to.eq(0);

      grantPathTags(opponent, 2);
      opponent.energy = 0;
      opponent.steel = 2;
      // No Delta Works: steel is not a budget (no valid steps at all) and an
      // explicit steel mix is refused before any mutation.
      expect(DeltaProjectExpansion.getValidAdvanceSteps(opponent)).to.deep.eq([]);
      expect(() => DeltaProjectExpansion.advance(opponent, 1, undefined, {payment: {energy: 0, steel: 1}})).to.throw();
      expect(opponent.steel).to.eq(2);
    });

    it('a free bonus/card move never takes steel — its toll stays energy-only', () => {
      grantPathTags(player, 1);
      player.energy = 1;
      player.steel = 5;
      DeltaProjectExpansion.advance(player, 1, {maxSteps: 1, free: true, energyToll: 1}, {payment: {energy: 0, steel: 1}});
      // The requested mix is ignored for a free context: the toll came from energy.
      expect(player.energy).to.eq(0);
      expect(player.steel).to.eq(5);
    });

    it('the preview grades affordability by the combined budget and names the source card', () => {
      grantPathTags(player, 3);
      player.energy = 1;
      player.steel = 1;
      const preview = DeltaProjectExpansion.getPreview(player);
      expect(preview.availableSteelSubstitute).to.eq(1);
      expect(preview.steelSubstituteCard).to.eq(CardName.DELTA_WORKS);
      expect(preview.maxEnergySteps).to.eq(2);
      expect(preview.destinations[1].affordable).is.true;
      expect(preview.destinations[2].affordable).is.false;
      expect(preview.destinations[2].energyDeficit).to.eq(1);
    });
  });

  describe('the colony trade energy family', () => {
    it('canUse is the combined pool; the M€/titanium families are untouched', () => {
      player.energy = 1;
      player.steel = 2;
      expect(new TradeWithEnergy(player).canUse()).is.true;
      player.steel = 1;
      expect(new TradeWithEnergy(player).canUse()).is.false;
      expect(new TradeWithEnergy(opponent).canUse()).is.false;
    });

    it('with a real choice the server asks ONE linked steel amount and pays the chosen mix', () => {
      const luna = game.colonies.find((c) => c.name === ColonyName.LUNA)!;
      player.energy = 2;
      player.steel = 2;
      new TradeWithEnergy(player).trade(luna);
      runAllActions(game);
      const mix = cast(player.popWaitingFor(), SelectAmount);
      expect(mix.min).to.eq(1); // the deficit
      expect(mix.max).to.eq(2);
      mix.cb(2); // all the steel the cost allows
      runAllActions(game);
      expect(player.energy).to.eq(1);
      expect(player.steel).to.eq(0);
      expect(luna.visitor).to.eq(player.id);
    });

    it('a single valid mix is paid silently — shown, never asked', () => {
      const luna = game.colonies.find((c) => c.name === ColonyName.LUNA)!;
      player.energy = 0;
      player.steel = 3;
      new TradeWithEnergy(player).trade(luna);
      runAllActions(game);
      expect(player.popWaitingFor()).is.undefined;
      expect(player.steel).to.eq(0);
      expect(luna.visitor).to.eq(player.id);
    });

    it('without Delta Works the energy path behaves exactly as before', () => {
      const luna = game.colonies.find((c) => c.name === ColonyName.LUNA)!;
      opponent.energy = 3;
      opponent.steel = 5;
      new TradeWithEnergy(opponent).trade(luna);
      runAllActions(game);
      expect(opponent.popWaitingFor()).is.undefined;
      expect(opponent.energy).to.eq(0);
      expect(opponent.steel).to.eq(5);
    });
  });
});
