import {expect} from 'chai';
import {DevelopmentManager} from '../../../src/server/cards/delta/DevelopmentManager';
import {DELTA_PROJECT_CARD_MANIFEST} from '../../../src/server/cards/delta/DeltaProjectCardManifest';
import {DeltaProjectExpansion} from '../../../src/server/delta/DeltaProjectExpansion';
import {getBehaviorExecutor} from '../../../src/server/behavior/BehaviorExecutor';
import {GameCards} from '../../../src/server/GameCards';
import {DEFAULT_GAME_OPTIONS} from '../../../src/server/game/GameOptions';
import {Game} from '../../../src/server/Game';
import {IGame} from '../../../src/server/IGame';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {Resource} from '../../../src/common/Resource';
import {Units} from '../../../src/common/Units';
import {ColonyName} from '../../../src/common/colonies/ColonyName';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {GiantSpaceMirror} from '../../../src/server/cards/base/GiantSpaceMirror';
import {StripMine} from '../../../src/server/cards/base/StripMine';
import {RoboticWorkforce} from '../../../src/server/cards/base/RoboticWorkforce';
import {SmallOpenPitMine} from '../../../src/server/cards/pathfinders/SmallOpenPitMine';
import {MiningOperations} from '../../../src/server/cards/prelude/MiningOperations';
import {cast, toName} from '../../../src/common/utils/utils';
import {fakeCard, runAllActions, setTemperature} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';

/** Every path tag up to `pos`, so the standard rule already admits the step. */
function grantPathTags(player: TestPlayer, pos: number): void {
  const tags = [Tag.BUILDING, Tag.POWER, Tag.EARTH, Tag.SPACE, Tag.SCIENCE,
    Tag.PLANT, Tag.MICROBE, Tag.JOVIAN, Tag.ANIMAL].slice(0, Math.min(pos, 9));
  player.playedCards.push(fakeCard({tags}));
}

/** How many times DP05 has fired so far — the effect-triggered markers are
 * emitted lazily, exactly once per impactful firing, so this IS the trigger
 * count (independent of how the M€ delta happens to aggregate). */
function dp05Triggers(game: IGame): number {
  return game.events.events.filter((e) =>
    e.type === 'effect-triggered' && e.source?.kind === 'card' && e.source.card === CardName.DEVELOPMENT_MANAGER).length;
}

describe('DevelopmentManager', () => {
  let card: DevelopmentManager;
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;

  beforeEach(() => {
    card = new DevelopmentManager();
    [game, player, opponent] = testGame(2, {deltaProjectExpansion: true});
    player.playedCards.push(card);
  });

  describe('metadata', () => {
    it('matches the printed card', () => {
      expect(card.name).to.eq(CardName.DEVELOPMENT_MANAGER);
      expect(card.type).to.eq(CardType.ACTIVE);
      expect(card.cost).to.eq(8);
      expect(card.tags).to.deep.eq([Tag.EARTH]);
      expect(card.metadata.cardNumber).to.eq('DP05');
      expect(card.requirements).to.deep.eq([]);
      expect(card.getVictoryPoints(player)).to.eq(0);
    });

    it('is registered in the Delta Project set and gated by the expansion', () => {
      expect(DELTA_PROJECT_CARD_MANIFEST.projectCards[CardName.DEVELOPMENT_MANAGER]).is.not.undefined;
      const on = new GameCards({...DEFAULT_GAME_OPTIONS, deltaProjectExpansion: true}).getProjectCards().map(toName);
      const off = new GameCards({...DEFAULT_GAME_OPTIONS, deltaProjectExpansion: false}).getProjectCards().map(toName);
      expect(on.filter((n) => n === CardName.DEVELOPMENT_MANAGER)).to.have.length(1);
      expect(off).to.not.contain(CardName.DEVELOPMENT_MANAGER);
    });
  });

  describe('production threshold', () => {
    for (const resource of [Resource.MEGACREDITS, Resource.STEEL, Resource.TITANIUM, Resource.PLANTS, Resource.ENERGY, Resource.HEAT]) {
      it(`+2 ${resource} production is one trigger`, () => {
        player.production.add(resource, 2, {log: false});
        expect(player.megaCredits).to.eq(2);
        expect(dp05Triggers(game)).to.eq(1);
      });
    }

    it('+1 is below the threshold', () => {
      player.production.add(Resource.ENERGY, 1, {log: false});
      expect(player.megaCredits).to.eq(0);
      expect(dp05Triggers(game)).to.eq(0);
    });

    it('the threshold is a gate, not a multiplier: +3 and +4 are still ONE trigger each', () => {
      player.production.add(Resource.ENERGY, 3, {log: false});
      expect(player.megaCredits).to.eq(2);
      player.production.add(Resource.HEAT, 4, {log: false});
      expect(player.megaCredits).to.eq(4);
      expect(dp05Triggers(game)).to.eq(2);
    });

    it('a decrease never triggers, whatever its size', () => {
      player.production.override(Units.of({energy: 5}));
      player.production.add(Resource.ENERGY, -3, {log: false});
      expect(player.megaCredits).to.eq(0);
      expect(dp05Triggers(game)).to.eq(0);
    });

    it('a zero delta never triggers', () => {
      player.production.add(Resource.ENERGY, 0, {log: false});
      expect(dp05Triggers(game)).to.eq(0);
    });

    it('M€ production from -5 to -3 IS an increase of 2', () => {
      player.production.override(Units.of({megacredits: -5}));
      player.production.add(Resource.MEGACREDITS, 2, {log: false});
      expect(player.production.megacredits).to.eq(-3);
      expect(player.megaCredits).to.eq(2);
      expect(dp05Triggers(game)).to.eq(1);
    });

    it('gaining plain resources is not a production increase', () => {
      player.stock.add(Resource.PLANTS, 5, {log: false});
      player.stock.add(Resource.MEGACREDITS, 3, {log: false});
      expect(dp05Triggers(game)).to.eq(0);
    });

    it('gaining card resources is not a production increase', () => {
      const host = fakeCard({resourceType: CardResource.MICROBE, resourceCount: 0});
      player.playedCards.push(host);
      player.addResourceTo(host, 3);
      expect(dp05Triggers(game)).to.eq(0);
    });

    it('the end-of-generation energy-to-heat conversion is not a production increase', () => {
      player.production.override(Units.of({energy: 2, heat: 1}));
      player.energy = 3;
      player.runProductionPhase();
      expect(player.heat).to.be.greaterThan(0);
      expect(dp05Triggers(game)).to.eq(0);
    });

    it('test/setup overrides bypass the pipeline and never trigger', () => {
      player.production.override(Units.of({energy: 4, steel: 4}));
      expect(dp05Triggers(game)).to.eq(0);
    });
  });

  describe('event boundaries', () => {
    it('one declarative multi-resource change triggers once PER TYPE meeting the threshold', () => {
      getBehaviorExecutor().execute({production: {energy: 2, heat: 2}}, player, fakeCard());
      expect(player.megaCredits).to.eq(4);
      expect(dp05Triggers(game)).to.eq(2);
    });

    it('three qualifying types in one effect are three triggers', () => {
      getBehaviorExecutor().execute({production: {energy: 2, heat: 2, plants: 2}}, player, fakeCard());
      expect(player.megaCredits).to.eq(6);
      expect(dp05Triggers(game)).to.eq(3);
    });

    it('+1 of one type plus +2 of another is exactly one trigger', () => {
      getBehaviorExecutor().execute({production: {energy: 1, steel: 2}}, player, fakeCard());
      expect(player.megaCredits).to.eq(2);
      expect(dp05Triggers(game)).to.eq(1);
    });

    it('two INDEPENDENT +1 changes of the same type never accumulate', () => {
      player.production.add(Resource.ENERGY, 1, {log: false});
      player.production.add(Resource.ENERGY, 1, {log: false});
      expect(player.production.energy).to.eq(2);
      expect(player.megaCredits).to.eq(0);
      expect(dp05Triggers(game)).to.eq(0);
    });

    it('two independent +2 changes of the same type are two triggers', () => {
      player.production.add(Resource.ENERGY, 2, {log: false});
      player.production.add(Resource.ENERGY, 2, {log: false});
      expect(player.megaCredits).to.eq(4);
      expect(dp05Triggers(game)).to.eq(2);
    });

    it('two separate threshold bonuses are two events, even when they land together (+1 heat at -24 °C and at -20 °C)', () => {
      // One temperature action crosses BOTH heat-production thresholds: the
      // rules grant two separate +1 bonuses, and the pipeline applies them as
      // two adds of 1 — so the card must NOT read them as one +2.
      setTemperature(game, -26);
      game.increaseTemperature(player, 3);
      expect(player.production.heat).to.eq(2);
      expect(player.megaCredits).to.eq(0);
      expect(dp05Triggers(game)).to.eq(0);
    });
  });

  describe('sources', () => {
    it('a project card played through the declarative behavior pipeline', () => {
      const mirror = new GiantSpaceMirror();
      cast(mirror.play(player), undefined);
      expect(player.production.energy).to.eq(3);
      expect(player.megaCredits).to.eq(2);
      expect(dp05Triggers(game)).to.eq(1);
    });

    it('a prelude resolved while the card is already in the tableau', () => {
      game.phase = Phase.PRELUDES;
      const prelude = new MiningOperations();
      cast(prelude.play(player), undefined);
      runAllActions(game);
      expect(player.production.steel).to.eq(2);
      expect(player.megaCredits).to.eq(2);
      expect(dp05Triggers(game)).to.eq(1);
    });

    it('a "raise one of your productions" choice resolves through the chosen branch', () => {
      const mine = new SmallOpenPitMine();
      cast(mine.play(player), undefined);
      runAllActions(game);
      const choice = cast(player.popWaitingFor(), OrOptions);
      choice.options[0].cb(undefined); // +2 steel production
      expect(player.production.steel).to.eq(2);
      expect(player.megaCredits).to.eq(2);
      expect(dp05Triggers(game)).to.eq(1);
    });

    it('a copied production box (Robotic Workforce) fires per qualifying type of the copy', () => {
      // Strip Mine's box is {energy: -2, steel: +2, titanium: +1}: only the
      // steel line meets the threshold, the decrease and the +1 never do.
      player.production.override(Units.of({energy: 2}));
      player.playedCards.push(new StripMine());
      const workforce = new RoboticWorkforce();
      cast(workforce.play(player), undefined);
      runAllActions(game);
      const select = cast(player.popWaitingFor(), SelectCard);
      select.cb([player.playedCards.get(CardName.STRIP_MINE)!]);
      runAllActions(game);
      expect(player.production.steel).to.eq(2);
      expect(player.production.energy).to.eq(0);
      expect(player.megaCredits).to.eq(2);
      expect(dp05Triggers(game)).to.eq(1);
    });

    it('a colony build bonus that raises production by 2 (Luna)', () => {
      const [colonyGame, colonist] = testGame(2, {
        deltaProjectExpansion: true,
        coloniesExtension: true,
        customColoniesList: [ColonyName.LUNA, ColonyName.PLUTO, ColonyName.IAPETUS, ColonyName.IO, ColonyName.EUROPA],
      });
      colonist.playedCards.push(new DevelopmentManager());
      const luna = colonyGame.colonies.find((c) => c.name === ColonyName.LUNA)!;
      const before = colonist.megaCredits;
      luna.addColony(colonist);
      runAllActions(colonyGame);
      expect(colonist.production.megacredits).to.eq(2);
      expect(colonist.megaCredits - before).to.eq(2);
      expect(dp05Triggers(colonyGame)).to.eq(1);
    });
  });

  describe('ownership', () => {
    it('an opponent\'s production increase never pays the card owner', () => {
      opponent.production.add(Resource.ENERGY, 2, {log: false});
      expect(player.megaCredits).to.eq(0);
      expect(opponent.megaCredits).to.eq(0);
      expect(dp05Triggers(game)).to.eq(0);
    });

    it('the affected player is authoritative — an opponent\'s copy watches THEIR production only', () => {
      opponent.playedCards.push(new DevelopmentManager());
      player.production.add(Resource.ENERGY, 2, {log: false});
      expect(player.megaCredits).to.eq(2);
      expect(opponent.megaCredits).to.eq(0);
    });

    it('a card still in hand has no effect', () => {
      const idle = new DevelopmentManager();
      opponent.cardsInHand.push(idle);
      opponent.production.add(Resource.ENERGY, 2, {log: false});
      expect(opponent.megaCredits).to.eq(0);
    });
  });

  describe('Hydronetwork movement', () => {
    it('a single 1-step move is below the threshold', () => {
      grantPathTags(player, 1);
      player.energy = 1;
      DeltaProjectExpansion.advance(player, 1);
      expect(player.megaCredits).to.eq(0);
      expect(dp05Triggers(game)).to.eq(0);
    });

    it('a single 2-step move is one trigger', () => {
      grantPathTags(player, 2);
      player.energy = 2;
      DeltaProjectExpansion.advance(player, 2);
      expect(player.deltaProjectData!.position).to.eq(2);
      expect(player.megaCredits).to.eq(2);
      expect(dp05Triggers(game)).to.eq(1);
    });

    it('a longer single move is STILL one movement trigger (4 steps)', () => {
      grantPathTags(player, 4);
      player.energy = 4;
      DeltaProjectExpansion.advance(player, 4);
      // One movement trigger (+2). The landing reward (+1 titanium production)
      // is below the production threshold, and no intermediate rewards exist.
      expect(player.megaCredits).to.eq(2);
      expect(player.production.titanium).to.eq(1);
      expect(dp05Triggers(game)).to.eq(1);
    });

    it('two separate 1-step moves never accumulate — including a standard move plus a bonus move', () => {
      grantPathTags(player, 2);
      player.energy = 1;
      DeltaProjectExpansion.advance(player, 1);
      // The DP03/DP04-style bonus context: one free step through the same pipeline.
      DeltaProjectExpansion.advance(player, 1, {maxSteps: 1, free: true});
      expect(player.deltaProjectData!.position).to.eq(2);
      expect(player.megaCredits).to.eq(0);
      expect(dp05Triggers(game)).to.eq(0);
    });

    it('two separate qualifying moves are two triggers', () => {
      grantPathTags(player, 4);
      player.energy = 4;
      DeltaProjectExpansion.advance(player, 2);
      DeltaProjectExpansion.advance(player, 2);
      expect(player.deltaProjectData!.position).to.eq(4);
      expect(player.megaCredits).to.eq(4);
      expect(dp05Triggers(game)).to.eq(2);
    });

    it('the landing choice reward (+1 production) does not add a second trigger', () => {
      grantPathTags(player, 2);
      player.energy = 2;
      DeltaProjectExpansion.advance(player, 2);
      runAllActions(game);
      cast(player.popWaitingFor(), OrOptions).options[0].cb(undefined); // +1 energy production
      runAllActions(game);
      expect(player.production.energy).to.eq(1);
      expect(player.megaCredits).to.eq(2);
      expect(dp05Triggers(game)).to.eq(1);
    });

    it('no intermediate rewards: a 2-step move pays the far stage only, plus the movement bonus', () => {
      grantPathTags(player, 2);
      player.energy = 2;
      const steelBefore = player.steel;
      const plantsBefore = player.plants;
      DeltaProjectExpansion.advance(player, 2);
      // Position 1's steel/plants reward must NOT have been granted.
      expect(player.steel).to.eq(steelBefore);
      expect(player.plants).to.eq(plantsBefore);
      expect(player.megaCredits).to.eq(2);
    });

    it('a rejected advance mutates nothing and never triggers', () => {
      // No tags, no energy: validation throws BEFORE any mutation.
      player.energy = 0;
      expect(() => DeltaProjectExpansion.advance(player, 2)).to.throw();
      expect(player.deltaProjectData!.position).to.eq(0);
      expect(player.megaCredits).to.eq(0);
      expect(dp05Triggers(game)).to.eq(0);
    });

    it('an opponent\'s move never pays the card owner', () => {
      grantPathTags(opponent, 2);
      opponent.energy = 2;
      DeltaProjectExpansion.advance(opponent, 2);
      expect(player.megaCredits).to.eq(0);
      expect(opponent.megaCredits).to.eq(0);
      expect(dp05Triggers(game)).to.eq(0);
    });

    it('a move made before the card was played never pays retroactively', () => {
      grantPathTags(opponent, 2);
      opponent.energy = 2;
      DeltaProjectExpansion.advance(opponent, 2);
      opponent.playedCards.push(new DevelopmentManager());
      expect(opponent.megaCredits).to.eq(0);
    });

    it('jumping the occupied 2 VP position still counts its logical steps (9 → 11 is 2 steps)', () => {
      grantPathTags(player, 9);
      player.energy = 2;
      player.deltaProjectData!.position = 9;
      opponent.deltaProjectData!.position = 10;
      DeltaProjectExpansion.advance(player, 2);
      expect(player.deltaProjectData!.position).to.eq(11);
      expect(player.megaCredits).to.eq(2);
      expect(dp05Triggers(game)).to.eq(1);
    });
  });

  describe('combined causes', () => {
    it('a qualifying production change AND a qualifying move in one resolution are two triggers', () => {
      getBehaviorExecutor().execute({production: {energy: 2}}, player, fakeCard());
      grantPathTags(player, 2);
      player.energy = 2;
      DeltaProjectExpansion.advance(player, 2);
      expect(player.megaCredits).to.eq(4);
      expect(dp05Triggers(game)).to.eq(2);
    });

    it('a move whose landing reward is itself a +2 production change cascades into two ordered triggers', () => {
      // Position 3 (Earth) grants +2 M€ production synchronously inside the
      // advance: the movement trigger fires first, the production trigger
      // second — 4 M€ total from one press.
      grantPathTags(player, 3);
      player.energy = 3;
      DeltaProjectExpansion.advance(player, 3);
      expect(player.production.megacredits).to.eq(2);
      expect(player.megaCredits).to.eq(4);
      expect(dp05Triggers(game)).to.eq(2);

      const markers = game.events.events.filter((e) =>
        e.type === 'effect-triggered' && e.source?.kind === 'card' && e.source.card === CardName.DEVELOPMENT_MANAGER);
      expect(markers.map((m) => m.trigger)).to.deep.eq(['delta-advance', 'production-gain']);
    });

    it('the card\'s own M€ reward is a STOCK gain and can never re-enter the production pipeline', () => {
      player.production.add(Resource.MEGACREDITS, 2, {log: false});
      // One trigger: +2 M€ production caused it; the +2 M€ stock it paid out
      // raised no production and fired nothing further.
      expect(player.production.megacredits).to.eq(2);
      expect(player.megaCredits).to.eq(2);
      expect(dp05Triggers(game)).to.eq(1);
    });
  });

  describe('persistence, idempotency and undo', () => {
    it('a save/load round-trip neither re-fires the effect nor duplicates the reward', () => {
      // Real cards only — fake tag carriers cannot survive deserialization.
      // Path tags 1..3: building (Strip Mine), power (Giant Space Mirror),
      // earth (Development Manager itself).
      player.playedCards.push(new StripMine(), new GiantSpaceMirror());
      player.energy = 3;
      DeltaProjectExpansion.advance(player, 3);
      runAllActions(game);
      const mcBefore = player.megaCredits;
      const journalBefore = game.gameLog.length;

      const restored = Game.deserialize(JSON.parse(JSON.stringify(game.serialize())));
      const restoredPlayer = restored.getPlayerById(player.id);
      expect(restoredPlayer.megaCredits).to.eq(mcBefore);
      expect(restoredPlayer.production.megacredits).to.eq(2);
      expect(restoredPlayer.deltaProjectData!.position).to.eq(3);
      expect(dp05Triggers(restored as unknown as IGame)).to.eq(2);
      expect(restored.gameLog.length).to.eq(journalBefore);
    });

    it('undo (snapshot restore) rolls the cause and the DP05 reward back together', () => {
      const snapshot = JSON.parse(JSON.stringify(game.serialize()));
      grantPathTags(player, 3);
      player.energy = 3;
      DeltaProjectExpansion.advance(player, 3);
      expect(player.megaCredits).to.eq(4);

      const restored = Game.deserialize(snapshot);
      const restoredPlayer = restored.getPlayerById(player.id);
      expect(restoredPlayer.megaCredits).to.eq(0);
      expect(restoredPlayer.production.megacredits).to.eq(0);
      expect(restoredPlayer.deltaProjectData!.position).to.eq(0);
      expect(dp05Triggers(restored as unknown as IGame)).to.eq(0);
    });
  });
});
