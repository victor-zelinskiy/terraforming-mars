import {expect} from 'chai';
import {SoilStudies} from '../../../src/server/cards/prelude2/SoilStudies';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {fakeCard, runAllActions, setTemperature} from '../../TestingUtils';
import {Luna} from '../../../src/server/colonies/Luna';
import {testGame} from '../../TestGame';
import {range} from '../../../src/common/utils/utils';
import {Titan} from '../../../src/server/colonies/Titan';
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
import {VenusGovernor} from '../../../src/server/cards/venusNext/VenusGovernor';
import {ArcticAlgae} from '../../../src/server/cards/base/ArcticAlgae';
import {testAutomaGame} from '../../automa/AutomaTestGame';

describe('SoilStudies', () => {
  let card: SoilStudies;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new SoilStudies();
    [game, player] = testGame(1);
  });

  it('Can not play', () => {
    setTemperature(game, -2);
    expect(card.canPlay(player)).is.not.true;
  });

  const playRuns = [
    {tags: undefined, colonies: 0, expected: 1},
    {tags: {microbe: 1}, colonies: 0, expected: 1},
    {tags: {venus: 1}, colonies: 0, expected: 2},
    {tags: {wild: 1}, colonies: 0, expected: 2},
    {tags: {plant: 1}, colonies: 0, expected: 2},
    {tags: undefined, colonies: 1, expected: 2},
    {tags: undefined, colonies: 2, expected: 3},
    {tags: {venus: 4, plant: 2, microbe: 2, wild: 1}, colonies: 1, expected: 9},
  ] as const;
  for (const run of playRuns) {
    it('Play ' + JSON.stringify(run), () => {
      player.tagsForTest = run.tags;

      const colony = new Luna();
      game.colonies.push(colony);
      for (const _ of range(run.colonies)) {
        colony.colonies.push(player.id);
      }

      card.play(player);
      expect(player.plants).eq(run.expected);
    });
  }
});

/**
 * P81 — SOIL STUDIES IN THE PREMIUM SCOPE: the EIGHTEENTH Prelude 2 card (`docs/PRELUDE2_ADAPTATION.md` §3.1, form 1 —
 * a declaration). «1 plant per Venus tag, plant tag (INCLUDING THIS ONE) and colony»: a basis of terms summed — a ROW
 * of tags (P85's class) and the colonies (P71) — whose tag term holds the card's own plant tag while it is still in the
 * hand. `Counter` adds that share (`cardIsUnplayed`), so the preview and the play read one number; the basis NAMES it
 * (`ActionEffectBasis.self` — P69's word on a set side, now on a flat term) so «[V][plant] 4» adds up against the three
 * tags the table shows.
 */
describe('SoilStudies — one count for the preview and the play, «including this one» named', () => {
  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, card: SoilStudies};

  /** The upstream table above, read twice: the hand's forecast and the play. */
  const runs = [
    {tags: undefined, colonies: 0, expected: 1},
    {tags: {microbe: 1}, colonies: 0, expected: 1},
    {tags: {venus: 1}, colonies: 0, expected: 2},
    {tags: {wild: 1}, colonies: 0, expected: 2},
    {tags: {plant: 1}, colonies: 0, expected: 2},
    {tags: undefined, colonies: 1, expected: 2},
    {tags: undefined, colonies: 2, expected: 3},
    {tags: {venus: 4, plant: 2, microbe: 2, wild: 1}, colonies: 1, expected: 9},
  ] as const;

  /** A two-seat Venus + Colonies + Prelude 2 table in the action phase, the card in hand, 20 M€, −30 °C. */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {venusNextExtension: true, coloniesExtension: true, prelude2Expansion: true});
    game.phase = Phase.ACTION;
    const card = new SoilStudies();
    p1.cardsInHand.push(card);
    p1.megaCredits = 20;
    return {game, p1, p2, card};
  }

  function arrangeColonies(game: IGame, rows: Array<[Colony, Array<IPlayer>]>): void {
    game.colonies = rows.map(([colony, owners]) => {
      colony.isActive = true;
      colony.colonies = owners.map((p) => p.id);
      return colony;
    });
  }

  /** The stand's table: Venus Governor (2 Venus), Arctic Algae (1 plant), a cube on Luna → 2 + 1 + 1 (this) + 1 = 5. */
  function standTable(): Table {
    const t = table();
    t.p1.playedCards.push(new VenusGovernor(), new ArcticAlgae());
    arrangeColonies(t.game, [[new Luna(), [t.p1]], [new Titan(), [t.p2]]]);
    return t;
  }

  function play(t: Table): void {
    t.p1.playCard(t.card);
    runAllActions(t.game);
  }

  const plants = (effects: ReadonlyArray<ActionEffect>) => effects.find((e) => e.icon === Resource.PLANTS && e.note === undefined);
  const previewPlants = (t: Table) => plants(cardPlayPreview(t.p1, t.card).branches.flatMap((b) => b.effects));

  it('rule 1 — the printed card: red, 13, Microbe + Plant, no VP, max −4 °C; P81; Venus + Colonies; a declaration; M€ only', () => {
    const c = new SoilStudies();
    expect(c.type).eq(CardType.EVENT);
    expect(c.cost).eq(13);
    expect(c.tags).deep.eq([Tag.MICROBE, Tag.PLANT]);
    expect(c.victoryPoints).is.undefined;
    expect(c.metadata.cardNumber).eq('P81');
    expect(c.behavior).deep.eq({stock: {plants: {tag: [Tag.VENUS, Tag.PLANT], colonies: {colonies: {}}}}});
    expect(Object.prototype.hasOwnProperty.call(SoilStudies.prototype, 'bespokePlay')).is.false;
    expect(PRELUDE2_CARD_MANIFEST.projectCards[CardName.SOIL_STUDIES]).deep.eq({Factory: SoilStudies, compatibility: ['venus', 'colonies']});
    const options = table().p1.paymentOptionsForCard(c);
    expect(options.steel, 'no Building tag').is.false;
    expect(options.titanium, 'no Space tag').is.false;
  });

  it('rule 4 — the requirement: −2 °C locks the card, −4 °C plays it', () => {
    const t = table();
    setTemperature(t.game, -2);
    expect(t.card.canPlay(t.p1)).is.false;
    setTemperature(t.game, -4);
    expect(t.card.canPlay(t.p1)).is.true;
  });

  describe('rule 2 — +1 plant per Venus tag, plant tag (this one included), wild tag once, and colony cube', () => {
    it('the stand\'s table: 2 Venus + 1 plant + this card + 1 colony = +5', () => {
      const t = standTable();
      play(t);
      expect(t.p1.plants).eq(5);
    });

    it('nothing on the table: this card alone → +1', () => {
      const t = table();
      arrangeColonies(t.game, [[new Luna(), [t.p2]]]);
      play(t);
      expect(t.p1.plants).eq(1);
    });

    it('a played EVENT with a plant tag does not count; a tile with two of the player\'s cubes counts 2', () => {
      const t = table();
      t.p1.playedCards.push(fakeCard({name: 'plant event' as CardName, type: CardType.EVENT, tags: [Tag.PLANT]}));
      arrangeColonies(t.game, [[new Luna(), [t.p1, t.p1]]]);
      play(t);
      expect(t.p1.plants).eq(1 + 2);
    });

    it('a wild tag counts ONCE, not once per named tag', () => {
      const t = table();
      t.p1.playedCards.push(fakeCard({name: 'wild own' as CardName, tags: [Tag.WILD]}));
      arrangeColonies(t.game, [[new Luna(), [t.p2]]]);
      play(t);
      expect(t.p1.plants).eq(2);
    });
  });

  describe('rule 3 — the preview IS the play: the same number, its share of this card NAMED', () => {
    for (const run of runs) {
      it('preview ≡ hand ≡ play ' + JSON.stringify(run), () => {
        const t = table();
        t.p1.tagsForTest = run.tags;
        arrangeColonies(t.game, [[new Luna(), range(run.colonies).map(() => t.p1)]]);
        const forecast = previewPlants(t)?.amount;
        const counted = plants(countedPlayEffects(t.p1, t.card))?.amount;
        play(t);
        expect([forecast, counted, t.p1.plants]).deep.eq([run.expected, run.expected, run.expected]);
      });
    }

    it('the stand\'s basis: the ROW [V][plant] 4 «incl. this card 1» + Your colonies 1 → +5; read-only', () => {
      const t = standTable();
      const before = JSON.stringify(t.game.serialize());
      const chip = previewPlants(t);
      expect(chip).deep.include({direction: 'gain', amount: 5, current: 0, resulting: 5});
      expect(chip?.basis).deep.eq([
        {count: 4, label: 'Your tags', tags: [Tag.VENUS, Tag.PLANT], self: 1},
        {count: 1, label: 'Your colonies'},
      ]);
      expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
    });

    it('a wild tag is its own share beside this card\'s: [V][plant] 2 «incl. wild 1 · this card 1»', () => {
      const t = table();
      t.p1.playedCards.push(fakeCard({name: 'wild own' as CardName, tags: [Tag.WILD]}));
      arrangeColonies(t.game, [[new Luna(), [t.p2]]]);
      expect(previewPlants(t)?.basis).deep.eq([
        {count: 2, label: 'Your tags', tags: [Tag.VENUS, Tag.PLANT], wild: 1, self: 1},
        {count: 0, label: 'Your colonies'},
      ]);
    });

    it('once the card is ON the table there is no «this card» share (an event\'s tags are gone from the count)', () => {
      const t = standTable();
      t.p1.playedCards.push(t.card);
      const term = previewPlants(t)?.basis?.[0];
      expect(term?.count).eq(3);
      expect(term?.self).is.undefined;
    });

    it('the hand reads the same counted number and basis (`countedPlayEffects`)', () => {
      const t = standTable();
      const counted = plants(countedPlayEffects(t.p1, t.card));
      expect(counted?.amount).eq(5);
      expect(counted?.basis?.map((b) => [b.count, b.self])).deep.eq([[4, 1], [1, undefined]]);
    });
  });

  describe('rule 4 — the deal, save / reload, MarsBot', () => {
    function dealt(opts: Partial<GameOptions>): Array<CardName> {
      return new GameCards({...DEFAULT_GAME_OPTIONS, ...opts}).getProjectCards().map((c) => c.name);
    }

    it('dealt with Prelude 2 + Venus + Colonies; absent without either', () => {
      expect(dealt({prelude2Expansion: true, venusNextExtension: true, coloniesExtension: true})).include(CardName.SOIL_STUDIES);
      expect(dealt({prelude2Expansion: true, venusNextExtension: false, coloniesExtension: true})).not.include(CardName.SOIL_STUDIES);
      expect(dealt({prelude2Expansion: true, venusNextExtension: true, coloniesExtension: false})).not.include(CardName.SOIL_STUDIES);
    });

    it('save / reload: an ordinary played event, the plants kept', () => {
      const t = standTable();
      play(t);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const owner = reloaded.getPlayerById(t.p1.id);
      expect(owner.tableau.has(CardName.SOIL_STUDIES)).is.true;
      expect(owner.plants).eq(5);
    });

    it('MarsBot at the table (the card brought in by hand): the human counts only the human\'s tags and cubes', () => {
      const [game, human, bot] = testAutomaGame({venusNextExtension: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      arrangeColonies(game, [[new Luna(), [human, bot]], [new Titan(), [bot]]]);
      const c = new SoilStudies();
      human.cardsInHand.push(c);
      human.megaCredits = 20;
      const before = human.plants;
      human.playCard(c);
      runAllActions(game);
      expect(human.plants, 'this card + one cube').eq(before + 2);
    });
  });
});
