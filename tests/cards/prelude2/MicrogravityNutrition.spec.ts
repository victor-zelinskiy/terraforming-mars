import {MicrogravityNutrition} from '../../../src/server/cards/prelude2/MicrogravityNutrition';
import {Luna} from '../../../src/server/colonies/Luna';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestingUtils';
import {cast} from '@/common/utils/utils';
import {expect} from 'chai';
import {Titan} from '../../../src/server/colonies/Titan';
import {Pluto} from '../../../src/server/colonies/Pluto';
import {Colony} from '../../../src/server/colonies/Colony';
import {IPlayer} from '../../../src/server/IPlayer';
import {Game} from '../../../src/server/Game';
import {GameCards} from '../../../src/server/GameCards';
import {PRELUDE2_CARD_MANIFEST} from '../../../src/server/cards/prelude2/Prelude2CardManifest';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {countedPlayEffects} from '../../../src/server/models/actionPreview';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {Resource} from '../../../src/common/Resource';
import {ActionEffect} from '../../../src/common/models/ActionPreviewModel';
import {runAllActions} from '../../TestingUtils';
import {testAutomaGame} from '../../automa/AutomaTestGame';

describe('MicrogravityNutrition', () => {
  let card: MicrogravityNutrition;
  let player: TestPlayer;
  let game: IGame;
  let colony1: Luna;

  beforeEach(() => {
    card = new MicrogravityNutrition();
    [game, player/* , player2 */] = testGame(2, {coloniesExtension: true});

    colony1 = new Luna();
    colony1.colonies.push(player.id);
    game.colonies.push(colony1);
  });

  it('Should play without targets', () => {
    cast(card.play(player), undefined);
    expect(player.production.megacredits).to.eq(1);
  });
});

/**
 * P79 — MICROGRAVITY NUTRITION IN THE PREMIUM SCOPE: the SEVENTEENTH Prelude 2 card adapted IN PLACE
 * (`docs/PRELUDE2_ADAPTATION.md` §3.1, form 3 → 1). The rule did not change; the hand-counted `bespokePlay`
 * (`getColoniesCount` → `production.add`) became the declaration Ecology Research makes —
 * `production: {megacredits: {colonies: {colonies: {}}}}` — so the play preview, the hand plate and «РАСЧЁТ» read
 * the same server count (`Counter`, THE ONE reading of the player's own colony cubes).
 */
describe('MicrogravityNutrition — the counted production declaration', () => {
  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, card: MicrogravityNutrition};

  /** A two-seat Prelude 2 + Colonies table in the action phase, the card in hand, 20 M€. */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {coloniesExtension: true, prelude2Expansion: true});
    game.phase = Phase.ACTION;
    const card = new MicrogravityNutrition();
    p1.cardsInHand.push(card);
    p1.megaCredits = 20;
    return {game, p1, p2, card};
  }

  /** THE TABLE: the tiles in this order, each with the given seats' cubes on it. */
  function arrangeColonies(game: IGame, rows: Array<[Colony, Array<IPlayer>]>): void {
    game.colonies = rows.map(([colony, owners]) => {
      colony.isActive = true;
      colony.colonies = owners.map((p) => p.id);
      return colony;
    });
  }

  function play(t: Table): void {
    t.p1.playCard(t.card);
    runAllActions(t.game);
  }

  const mcProduction = (effects: ReadonlyArray<ActionEffect>) =>
    effects.find((e) => e.icon === Resource.MEGACREDITS && e.note === 'production');

  it('rule 1 — the printed card: green, 11, Microbe + Plant, 1 VP, no requirement; P79; Colonies; a declaration, no bespoke play', () => {
    const c = new MicrogravityNutrition();
    expect(c.type).eq(CardType.AUTOMATED);
    expect(c.cost).eq(11);
    expect(c.tags).deep.eq([Tag.MICROBE, Tag.PLANT]);
    expect(c.victoryPoints).eq(1);
    expect(c.requirements).deep.eq([]);
    expect(c.metadata.cardNumber).eq('P79');
    expect(c.behavior).deep.eq({production: {megacredits: {colonies: {colonies: {}}}}});
    expect(Object.prototype.hasOwnProperty.call(MicrogravityNutrition.prototype, 'bespokePlay'), 'the count is the declaration\'s').is.false;
    expect(PRELUDE2_CARD_MANIFEST.projectCards[CardName.MICROGRAVITY_NUTRITION]).deep.eq({Factory: MicrogravityNutrition, compatibility: 'colonies'});
  });

  it('rule 1 — paid with M€ only: neither tag takes steel or titanium', () => {
    const t = table();
    const options = t.p1.paymentOptionsForCard(t.card);
    expect(options.steel).is.false;
    expect(options.titanium).is.false;
  });

  describe('rule 2 — +1 M€ production per colony cube of the player\'s', () => {
    it('no colonies: +0 (the card is still played)', () => {
      const t = table();
      arrangeColonies(t.game, [[new Luna(), [t.p2]]]);
      play(t);
      expect(t.p1.production.megacredits).eq(0);
      expect(t.p1.tableau.has(CardName.MICROGRAVITY_NUTRITION)).is.true;
    });

    it('one colony: +1', () => {
      const t = table();
      arrangeColonies(t.game, [[new Luna(), [t.p1]]]);
      play(t);
      expect(t.p1.production.megacredits).eq(1);
    });

    it('two colonies (Luna · Titan): +2; the opponent\'s cubes are not counted', () => {
      const t = table();
      arrangeColonies(t.game, [[new Luna(), [t.p1, t.p2]], [new Titan(), [t.p1]], [new Pluto(), [t.p2]]]);
      play(t);
      expect(t.p1.production.megacredits).eq(2);
      expect(t.p2.production.megacredits).eq(0);
    });

    it('a tile carrying TWO of the player\'s cubes counts twice (as `ColoniesHandler` counts them)', () => {
      const t = table();
      arrangeColonies(t.game, [[new Luna(), [t.p1, t.p1]]]);
      expect(t.p1.getColoniesCount()).eq(2);
      play(t);
      expect(t.p1.production.megacredits).eq(2);
    });

    it('the journal: ONE production event (+2 M€ production), sourced by the card', () => {
      const t = table();
      arrangeColonies(t.game, [[new Luna(), [t.p1]], [new Titan(), [t.p1]]]);
      const from = t.game.events.events.length;
      play(t);
      const prod = t.game.events.events.slice(from).filter((e) => e.player === t.p1.color && e.type === 'production-changed');
      expect(prod.map((e) => e.impact.production?.megacredits), JSON.stringify(prod)).deep.eq([2]);
      expect(prod[0].source).deep.include({card: CardName.MICROGRAVITY_NUTRITION});
    });
  });

  describe('rule 3 — the preview IS the execution (declarative, read-only)', () => {
    it('the play preview: «M€ production 0 → 2» with its basis «Your colonies: 2»; read-only', () => {
      const t = table();
      arrangeColonies(t.game, [[new Luna(), [t.p1]], [new Titan(), [t.p1]]]);
      const before = JSON.stringify(t.game.serialize());
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.kind, 'a declaration — no hook').eq('declarative');
      const effects = preview.branches.flatMap((b) => b.effects);
      expect(mcProduction(effects), JSON.stringify(effects)).deep.include({direction: 'gain', amount: 2, current: 0, resulting: 2});
      expect(mcProduction(effects)?.basis).deep.eq([{count: 2, label: 'Your colonies'}]);
      expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
    });

    it('no colonies: the chip is NAMED «0 → 0 · Your colonies: 0», never silent', () => {
      const t = table();
      arrangeColonies(t.game, [[new Luna(), [t.p2]]]);
      const effects = cardPlayPreview(t.p1, t.card).branches.flatMap((b) => b.effects);
      expect(mcProduction(effects), JSON.stringify(effects)).deep.include({amount: 0, current: 0, resulting: 0});
      expect(mcProduction(effects)?.basis).deep.eq([{count: 0, label: 'Your colonies'}]);
    });

    it('the hand reads the same counted number off the server (`countedPlayEffects` → `CardModel.countedPlay`)', () => {
      const t = table();
      arrangeColonies(t.game, [[new Luna(), [t.p1, t.p1]]]);
      const counted = mcProduction(countedPlayEffects(t.p1, t.card));
      expect(counted?.amount).eq(2);
      expect(counted?.basis?.map((b) => b.count)).deep.eq([2]);
    });
  });

  describe('rule 4 — the deal, save / reload, MarsBot', () => {
    function dealt(opts: Partial<GameOptions>): Array<CardName> {
      return new GameCards({...DEFAULT_GAME_OPTIONS, ...opts}).getProjectCards().map((c) => c.name);
    }

    it('dealt with Prelude 2 + Colonies; absent without Colonies', () => {
      expect(dealt({prelude2Expansion: true, coloniesExtension: true})).include(CardName.MICROGRAVITY_NUTRITION);
      expect(dealt({prelude2Expansion: true, coloniesExtension: false})).not.include(CardName.MICROGRAVITY_NUTRITION);
    });

    it('save / reload: an ordinary played card, the production kept', () => {
      const t = table();
      arrangeColonies(t.game, [[new Luna(), [t.p1]]]);
      play(t);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const owner = reloaded.getPlayerById(t.p1.id);
      expect(owner.tableau.has(CardName.MICROGRAVITY_NUTRITION)).is.true;
      expect(owner.production.megacredits).eq(1);
    });

    it('MarsBot at the table (the card brought in by hand): the human counts only the human\'s cubes', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true});
      game.phase = Phase.ACTION;
      arrangeColonies(game, [[new Luna(), [human, bot]], [new Titan(), [bot]]]);
      const c = new MicrogravityNutrition();
      human.cardsInHand.push(c);
      human.megaCredits = 20;
      const before = human.production.megacredits;
      human.playCard(c);
      runAllActions(game);
      expect(human.production.megacredits).eq(before + 1);
    });
  });
});
