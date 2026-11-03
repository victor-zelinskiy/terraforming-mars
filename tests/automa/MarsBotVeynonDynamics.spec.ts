import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {marsBotDividendInfo} from '../../src/common/automa/MarsBotDividendData';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Game} from '../../src/server/Game';
import {AutomaColonies} from '../../src/server/automa/AutomaColonies';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {AutomaResearch} from '../../src/server/automa/AutomaResearch';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {Server} from '../../src/server/models/ServerModel';
import {VeynonDynamics} from '../../src/server/cards/turmoilRedux/VeynonDynamics';
import {
  VEYNON_CARGO, VEYNON_MAX_FLEETS, VEYNON_MECHS_PER_FLEET, VEYNON_STARTING_MECHS,
} from '../../src/server/automa/corps/MarsBotVeynonDynamics';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

const CF2 = MarsBotCorpId.CF2_VEYNON_DYNAMICS;
const BC2 = BonusCardId.BC2_VEYNON_RUN;
const B19 = BonusCardId.B19_SHIPPING_LINES;
const B20 = BonusCardId.B20_EXTENDED_SHIPPING_LINES;

/** A Colonies game with Veynon Dynamics seated (setup + Before Action Phase already run). */
function veynonGame(suffix: string): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation: CF2, coloniesExtension: true}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function inDeck(game: IGame, id: BonusCardId): number {
  return game.automa!.actionDeck.filter((e) => e.kind === 'bonus' && e.id === id).length;
}

describe('MarsBot Veynon Dynamics (CF2, the fork\'s own card) — «Mechs in the Hold»', () => {
  describe('the card', () => {
    it('Jovian and Venus tags, a mech store, Colonies only, its own BC2 — setup and effect boxes', () => {
      const info = marsBotCorpInfo(CF2);
      expect(info.original).eq(CardName.VEYNON_DYNAMICS);
      expect(info.cardNumber).eq('CF2');
      expect(info.startingTags).deep.eq([Tag.JOVIAN, Tag.VENUS]);
      expect(info.requiresModules).deep.eq(['colonies']);
      expect(info.resource).eq('mech');
      expect(info.corpBonusCards).deep.eq([BC2]);
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'effect']);
    });

    it('never seated without Colonies; collides with the human Veynon Dynamics', () => {
      const [plain] = testAutomaGame({}, '-vd-plain');
      expect(AutomaCorporations.eligibleCorpIds(plain)).not.contains(CF2);
      const [game, human] = testAutomaGame({coloniesExtension: true}, '-vd-collide');
      expect(AutomaCorporations.eligibleCorpIds(game)).contains(CF2);
      human.pickedCorporationCard = new VeynonDynamics();
      expect(AutomaCorporations.eligibleCorpIds(game)).not.contains(CF2);
    });
  });

  describe('SETUP — the first fleet sails at once, a mech on the card', () => {
    it('Shipping Lines is recurring from generation 1 and dealt into its deck; the starting mech stands', () => {
      const [game] = veynonGame('-vd-setup');
      const automa = game.automa!;
      expect(automa.recurringBonusCards).contains(B19);
      expect(automa.setAsideBonusCards).not.contains(B19);
      const played = automa.lastTurn?.steps.some((s) => s.kind === 'reveal' && s.card.kind === 'bonus' && s.card.id === B19) ? 1 : 0;
      expect(inDeck(game, B19) + played, 'one Shipping Lines in generation 1').eq(1);
      // The starting Jovian tag adds its own mech (Venus does not): starting mech + 1.
      expect(automa.corpStats.veynonMechs).eq(VEYNON_STARTING_MECHS + 1);
    });
  });

  describe('EFFECT — mechs become REAL fleets, up to three', () => {
    it('a Jovian or space tag adds a mech; a Venus or Earth tag does not', () => {
      const [game] = veynonGame('-vd-tags');
      const automa = game.automa!;
      automa.corpResources = 0;
      AutomaCorporations.onTagResolved(game, Tag.SPACE);
      AutomaCorporations.onTagResolved(game, Tag.JOVIAN);
      AutomaCorporations.onTagResolved(game, Tag.VENUS);
      AutomaCorporations.onTagResolved(game, Tag.EARTH);
      expect(automa.corpResources).eq(2);
    });

    it('three mechs assemble the second fleet: the bot\'s player counts two ships, and B20 sails from the next deck', () => {
      const [game, , bot] = veynonGame('-vd-fleet2');
      const automa = game.automa!;
      automa.corpResources = VEYNON_MECHS_PER_FLEET - 1;
      expect(AutomaColonies.botFleetCount(game)).eq(1);
      AutomaCorporations.onTagResolved(game, Tag.SPACE);
      expect(automa.corpResources).eq(0);
      expect(bot.colonies.getFleetSize(), 'the table sees two fleets').eq(2);
      expect(automa.secondFleetUnlocked).is.true;
      AutomaResearch.finishActionDeck(game, []);
      expect(inDeck(game, B20)).eq(1);
      expect(inDeck(game, B19)).eq(1);
    });

    it('the third fleet sails as Veynon Run; the fourth never comes — the mechs wait as cargo', () => {
      const [game, , bot] = veynonGame('-vd-fleet3');
      const automa = game.automa!;
      automa.corpResources = 0;
      for (let i = 0; i < 2 * VEYNON_MECHS_PER_FLEET; i++) {
        AutomaCorporations.onTagResolved(game, Tag.SPACE);
      }
      expect(bot.colonies.getFleetSize()).eq(VEYNON_MAX_FLEETS);
      expect(automa.recurringBonusCards).contains(BC2);
      for (let i = 0; i < VEYNON_MECHS_PER_FLEET; i++) {
        AutomaCorporations.onTagResolved(game, Tag.SPACE);
      }
      expect(bot.colonies.getFleetSize(), 'capped at three').eq(VEYNON_MAX_FLEETS);
      expect(automa.corpResources).eq(VEYNON_MECHS_PER_FLEET);
      AutomaResearch.finishActionDeck(game, []);
      expect([inDeck(game, B19), inDeck(game, B20), inDeck(game, BC2)]).deep.eq([1, 1, 1]);
    });

    it('with every fleet afloat a trade spends a mech for one more resource; before that it spends none', () => {
      const [game] = veynonGame('-vd-cargo');
      const automa = game.automa!;
      game.automa!.trades = 0;
      const colony = game.colonies.find((c) => c.name !== ColonyName.EUROPA && c.name !== ColonyName.TITAN && c.isActive)!;
      game.colonies.forEach((c) => (c.visitor = c === colony ? undefined : 'p-other' as never));
      automa.shippingStorage[colony.name] = 0;
      automa.corpResources = 2;
      game.players.find((p) => p.isMarsBot)!.megaCredits = 10;
      AutomaColonies.botTrade(game);
      expect(automa.corpResources, 'one fleet only: the mechs are parts, not cargo').eq(2);
      expect(automa.trades).eq(1);

      const [full] = veynonGame('-vd-cargo-full');
      const fa = full.automa!;
      fa.corpResources = 0;
      for (let i = 0; i < 2 * VEYNON_MECHS_PER_FLEET + 1; i++) {
        AutomaCorporations.onTagResolved(full, Tag.SPACE);
      }
      const target = full.colonies.find((c) => c.name !== ColonyName.EUROPA && c.name !== ColonyName.TITAN && c.isActive)!;
      full.colonies.forEach((c) => (c.visitor = c === target ? undefined : 'p-other' as never));
      fa.shippingStorage[target.name] = 0;
      full.players.find((p) => p.isMarsBot)!.megaCredits = 10;
      const own = target.colonies.some((id) => id === full.players.find((p) => p.isMarsBot)!.id) ? 1 : 0;
      AutomaColonies.botTrade(full);
      expect(fa.corpResources).eq(0);
      expect(fa.shippingStorage[target.name]).eq(2 + own + VEYNON_CARGO);
    });
  });

  describe('BC2 Veynon Run — the storage area closest to its exchange', () => {
    it('sails past the brightest track to the area one short of its exchange', () => {
      const [game] = veynonGame('-vd-run');
      const automa = game.automa!;
      const tradable = game.colonies.filter((c) => c.isActive && c.name !== ColonyName.EUROPA && c.name !== ColonyName.TITAN);
      expect(tradable.length).to.be.at.least(2);
      const [bright, ready] = tradable;
      game.colonies.forEach((c) => (c.visitor = undefined));
      bright.trackPosition = 6;
      ready.trackPosition = 1;
      for (const c of tradable) {
        automa.shippingStorage[c.name] = 0;
      }
      automa.shippingStorage[ready.name] = 4;
      game.players.find((p) => p.isMarsBot)!.megaCredits = 10;
      expect(resolveBonusCard(game, BC2)).eq('discard');
      runAllActions(game);
      expect(ready.visitor, 'the run went to the area one short of its exchange').is.not.undefined;
      expect(bright.visitor).is.undefined;
      routeBonusCard(game, BC2, 'discard');
    });
  });

  describe('a fleet is a fleet — for every corporation', () => {
    it('the power track\'s #9 grows the bot\'s player fleet too, and the model reports it', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true}, '-vd-power9');
      game.playerIsFinishedWithResearchPhase(human);
      const automa = game.automa!;
      const power = automa.board.getTrackIndexOfRole('power');
      expect(power, 'the map has a power track').is.not.undefined;
      if (power === undefined) {
        return;
      }
      automa.board.tracks[power].position = 8;
      AutomaResolver.advanceTrack(game, power);
      runAllActions(game);
      expect(automa.secondFleetUnlocked).is.true;
      expect(bot.colonies.getFleetSize()).eq(2);
      const model = Server.getPlayerModel(human);
      expect(model.players.find((p) => p.color === bot.color)?.fleetSize).eq(2);
      expect(model.game.automa?.tradeFleets).eq(2);
    });

    it('an OLD save with the flag but a one-ship player still reads two fleets', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true}, '-vd-oldsave');
      game.playerIsFinishedWithResearchPhase(human);
      game.automa!.secondFleetUnlocked = true;
      bot.colonies.setFleetSize(1);
      expect(AutomaColonies.botFleetCount(game)).eq(2);
    });
  });

  describe('the dividend, its goal, the counter', () => {
    it('«Freight Contracts»: 2 VP per colony trade; the goal counts Earth tags; trades survive a save', () => {
      const [game] = veynonGame('-vd-div');
      const corp = AutomaCorporations.corpFor(CF2);
      game.automa!.trades = 7;
      const r = marsBotDividendInfo(CF2).rates;
      expect(corp.dividend(game).vp).eq(7 * r.each);
      const before = corp.goal(game);
      game.automa!.playedPile.push(CardName.LUNAR_BEAM); // Earth + power
      expect(corp.goal(game)).eq(before + 1);
      const copy = Game.deserialize(game.serialize());
      expect(copy.automa!.trades).eq(7);
    });
  });
});
